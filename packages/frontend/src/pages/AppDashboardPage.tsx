import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MockUSDCAbi, MockUSDCFaucetAbi, addressesByChain } from "@giglock/shared";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { type Address, type Hash } from "viem";
import { useWriteContract } from "wagmi";
import { ACTIVE_CHAIN_ID, publicClient } from "../lib/wagmi.js";
import { JOB_STATUS } from "../features/jobs/model.js";
import { jobsKeys, loadAllJobs, loadWorkerJobs, type JobChainSnapshot } from "../features/jobs/queries.js";
import { runClaim, type WorkflowState } from "../features/jobs/transactions.js";
import { BalanceCard } from "../features/jobs/components/BalanceCard.js";
import { JobCard } from "../features/jobs/components/JobCard.js";
import { WalletGate, useWalletWriteAccess } from "../features/jobs/components/WalletGate.js";
import {
  deriveFaucetEligibility,
  faucetErrorMessage,
  faucetKeys,
  faucetTransactionUrl,
} from "../features/jobs/components/faucet.js";

type DashboardTab = "available" | "client" | "worker";

const dashboardTabs: Array<{ value: DashboardTab; label: string }> = [
  { value: "available", label: "Available" },
  { value: "client", label: "My client jobs" },
  { value: "worker", label: "My worker jobs" },
];

const giwaAddresses = addressesByChain[91342]!;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load this data from the network.";
}

function formatBalance(value: bigint | undefined, decimals: number, symbol: string): string {
  if (value === undefined) return "—";
  const rendered = Number(value) / 10 ** decimals;
  return `${rendered.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`;
}

function filterAvailable(jobs: JobChainSnapshot[]): JobChainSnapshot[] {
  return jobs.filter((job) => job.status === JOB_STATUS.Funded && /^0x0{40}$/i.test(job.worker));
}

function JobList({
  jobs,
  isLoading,
  error,
  empty,
}: {
  jobs: JobChainSnapshot[];
  isLoading: boolean;
  error: unknown;
  empty: string;
}) {
  if (isLoading) return <p className="dashboard-feedback" role="status">Loading on-chain jobs…</p>;
  if (error) return <p className="dashboard-feedback dashboard-feedback-error" role="alert">{errorMessage(error)} Refresh to try the chain read again.</p>;
  if (jobs.length === 0) return <p className="dashboard-feedback">{empty}</p>;

  return <div className="job-list">{jobs.map((job) => <JobCard key={job.address} job={job} />)}</div>;
}

function nextClaimDetail(eligibility: { eligible: boolean; eligibleAt: bigint } | undefined): ReactNode {
  if (eligibility === undefined) return "Checking faucet availability…";
  if (eligibility.eligible) return "Eligible to claim test USDC now";
  const eligibleAt = new Date(Number(eligibility.eligibleAt) * 1_000);
  return <>Next claim: <time dateTime={eligibleAt.toISOString()}>{eligibleAt.toLocaleString()}</time></>;
}

export function AppDashboardPage() {
  const [tab, setTab] = useState<DashboardTab>("available");
  const [claimState, setClaimState] = useState<WorkflowState>({ action: "claim", phase: "idle" });
  const [claimError, setClaimError] = useState<string | undefined>();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { address, canWrite } = useWalletWriteAccess();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();

  const allJobsQuery = useQuery({
    queryKey: jobsKeys.all,
    queryFn: loadAllJobs,
    staleTime: 15_000,
  });
  const workerJobsQuery = useQuery({
    queryKey: jobsKeys.worker(address!),
    queryFn: () => loadWorkerJobs(address!),
    enabled: tab === "worker" && address !== undefined,
    staleTime: 15_000,
  });
  const usdcBalanceQuery = useQuery({
    queryKey: address === undefined ? [...jobsKeys.all, "balances", "disconnected"] : jobsKeys.balances(address),
    queryFn: () => publicClient.readContract({
      address: giwaAddresses.mockUsdc,
      abi: MockUSDCAbi,
      functionName: "balanceOf",
      args: [address!],
    }),
    enabled: address !== undefined,
  });
  const ethBalanceQuery = useQuery({
    queryKey: ["wallet", ACTIVE_CHAIN_ID, "native-balance", address] as const,
    queryFn: () => publicClient.getBalance({ address: address! }),
    enabled: address !== undefined,
  });
  const faucetEligibilityQuery = useQuery({
    queryKey: address === undefined
      ? ["faucet", 91342, "eligibility", "disconnected"]
      : faucetKeys.eligibility(address),
    queryFn: async () => {
      const [lastClaimedAt, cooldown] = await Promise.all([
        publicClient.readContract({
          address: giwaAddresses.mockUsdcFaucet,
          abi: MockUSDCFaucetAbi,
          functionName: "lastClaimedAt",
          args: [address!],
        }),
        publicClient.readContract({
          address: giwaAddresses.mockUsdcFaucet,
          abi: MockUSDCFaucetAbi,
          functionName: "COOLDOWN",
        }),
      ]);
      return deriveFaucetEligibility(lastClaimedAt, cooldown, BigInt(Math.floor(Date.now() / 1_000)));
    },
    enabled: address !== undefined,
    refetchInterval: 30_000,
  });

  const jobs = allJobsQuery.data ?? [];
  const clientJobs = address === undefined ? [] : jobs.filter((job) => job.client.toLowerCase() === address.toLowerCase());
  const workerJobs = workerJobsQuery.data ?? [];
  async function claimFaucet() {
    if (
      !address ||
      !canWrite ||
      faucetEligibilityQuery.data?.eligible !== true ||
      claimState.phase === "wallet" ||
      claimState.phase === "confirming"
    ) return;
    setClaimState({ action: "claim", phase: "wallet" });
    let submittedHash: Hash | undefined;

    try {
      await runClaim({
        writeContract: async (request) => {
          const hash = await writeContractAsync(request as never);
          submittedHash = hash;
          setClaimState({ action: "claim", phase: "confirming", hash });
          return hash;
        },
        waitForReceipt: publicClient.waitForTransactionReceipt,
        request: {
          address: giwaAddresses.mockUsdcFaucet,
          abi: MockUSDCFaucetAbi,
          functionName: "claim",
          chainId: 91342,
        },
      });
      await queryClient.invalidateQueries({ queryKey: jobsKeys.balances(address), exact: true });
      await queryClient.invalidateQueries({ queryKey: faucetKeys.eligibility(address), exact: true });
      setClaimState({ action: "claim", phase: "success", hash: submittedHash });
    } catch (error) {
      await queryClient.invalidateQueries({ queryKey: faucetKeys.eligibility(address), exact: true });
      setClaimState({ action: "claim", phase: "error", hash: submittedHash });
      setClaimError(faucetErrorMessage(error));
    }
  }

  const claimPending = claimState.phase === "wallet" || claimState.phase === "confirming";
  const claimDisabled =
    claimPending ||
    faucetEligibilityQuery.isLoading ||
    faucetEligibilityQuery.isError ||
    faucetEligibilityQuery.data?.eligible !== true;
  const claimLabel = faucetEligibilityQuery.isLoading
    ? "Checking faucet…"
    : claimState.phase === "wallet"
    ? "Confirm in wallet…"
    : claimState.phase === "confirming"
      ? "Confirming claim…"
      : "Claim 1,000 test USDC";

  function selectTab(index: number) {
    const selected = dashboardTabs[index];
    if (selected === undefined) return;
    setTab(selected.value);
    tabRefs.current[index]?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % dashboardTabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + dashboardTabs.length) % dashboardTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = dashboardTabs.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectTab(nextIndex);
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-overline">Testnet escrow workspace</p>
          <h1>Jobs in motion</h1>
          <p>Track funded work, wallet balances, and the on-chain escrow path from one place.</p>
        </div>
        <p className="dashboard-network"><span aria-hidden="true" /> GIWA Sepolia · Chain 91342</p>
      </header>

      <WalletGate />

      <section className="balance-summary" aria-label="Wallet balances">
        <BalanceCard
          label="MockUSDC"
          value={formatBalance(usdcBalanceQuery.data, 6, "USDC")}
          detail={address ? nextClaimDetail(faucetEligibilityQuery.data) : "Connect a wallet to read your balance"}
          isLoading={usdcBalanceQuery.isLoading}
          error={usdcBalanceQuery.isError
            ? "USDC balance is unavailable."
            : faucetEligibilityQuery.isError
              ? "Faucet availability is unavailable. Try refreshing the page."
              : undefined}
          action={canWrite ? { label: claimLabel, onClick: claimFaucet, disabled: claimDisabled } : undefined}
        />
        <BalanceCard
          label="GIWA ETH"
          value={formatBalance(ethBalanceQuery.data, 18, "ETH")}
          detail={address ? "Used to pay testnet gas" : "Connect a wallet to read your balance"}
          isLoading={ethBalanceQuery.isLoading}
          error={ethBalanceQuery.isError ? "GIWA ETH balance is unavailable." : undefined}
        />
      </section>

      <div className="claim-feedback" aria-live="polite">
        {claimState.phase === "wallet" ? "Confirm the claim in your wallet." : null}
        {claimState.phase === "confirming" ? "Claim submitted. Waiting for the GIWA receipt…" : null}
        {claimState.phase === "success" ? "Claim confirmed. Your USDC balance is refreshing." : null}
        {claimState.phase === "error" ? claimError : null}
        {claimState.hash ? (
          <a href={faucetTransactionUrl(claimState.hash)} target="_blank" rel="noreferrer" aria-label="View claim on GIWA Explorer">
            View claim on GIWA Explorer
          </a>
        ) : null}
      </div>

      <section className="dashboard-jobs" aria-labelledby="job-list-heading">
        <div className="dashboard-jobs-heading">
          <div>
            <h2 id="job-list-heading">Job board</h2>
            <p>Listings read directly from GIWA Sepolia, even before a wallet is connected.</p>
          </div>
          <div className="dashboard-tabs" role="tablist" aria-label="Job lists">
            {dashboardTabs.map(({ value, label }, index) => (
              <button
                aria-controls={`${value}-panel`}
                aria-selected={tab === value}
                className={tab === value ? "dashboard-tab is-active" : "dashboard-tab"}
                id={`${value}-tab`}
                key={value}
                onClick={() => setTab(value)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                ref={(element) => { tabRefs.current[index] = element; }}
                role="tab"
                tabIndex={tab === value ? 0 : -1}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {dashboardTabs.map(({ value }) => {
          const selected = tab === value;
          const panelJobs = value === "available" ? filterAvailable(jobs) : value === "client" ? clientJobs : workerJobs;
          const isWorkerTab = value === "worker";
          const panelLoading = selected && (isWorkerTab ? workerJobsQuery.isLoading : allJobsQuery.isLoading);
          const panelError = selected ? (isWorkerTab ? workerJobsQuery.error : allJobsQuery.error) : null;
          const empty = value === "available"
            ? "No funded jobs available right now."
            : value === "client"
              ? "No client jobs yet. Post a job to start an escrow."
              : address === undefined
                ? "Connect a wallet to view jobs you have accepted."
                : "No worker jobs yet. Accept a funded job to begin.";
          return (
            <div id={`${value}-panel`} key={value} role="tabpanel" aria-labelledby={`${value}-tab`} hidden={!selected}>
              <JobList jobs={panelJobs} isLoading={panelLoading} error={panelError} empty={empty} />
            </div>
          );
        })}
      </section>
    </div>
  );
}
