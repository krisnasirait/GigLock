import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EscrowJobAbi } from "@giglock/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { formatUnits, isAddress, type Address, type Hash, type Hex } from "viem";
import { useWriteContract } from "wagmi";
import { ACTIVE_CHAIN_ID, publicClient } from "../lib/wagmi.js";
import { EvidencePanel } from "../features/jobs/components/EvidencePanel.js";
import { JobStatusBadge } from "../features/jobs/components/JobStatusBadge.js";
import { MilestoneTimeline } from "../features/jobs/components/MilestoneTimeline.js";
import { WalletGate, useWalletWriteAccess } from "../features/jobs/components/WalletGate.js";
import {
  deriveJobActions,
  MILESTONE_STATUS,
  type JobAction,
} from "../features/jobs/model.js";
import { uploadEvidence } from "../features/jobs/ipfs.js";
import { jobsKeys, loadJob } from "../features/jobs/queries.js";
import {
  invalidateJobQueries,
  runAccept,
  runConfirm,
  runFund,
  runSubmitProof,
  type WorkflowAction,
} from "../features/jobs/transactions.js";
import { faucetTransactionUrl } from "../features/jobs/components/faucet.js";

type PendingAction = { action: WorkflowAction; hash: Hash };

function compactAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function transactionError(action: WorkflowAction, error: unknown): string {
  if (
    typeof error === "object" && error !== null &&
    (("name" in error && (error as { name?: unknown }).name === "UserRejectedRequestError") ||
      ("code" in error && (error as { code?: unknown }).code === 4001))
  ) return `You cancelled ${action.replace("-", " ")} in your wallet.`;
  const message = error instanceof Error ? error.message : "";
  if (/did not receive a successful receipt|revert|reverted/i.test(message)) {
    return `${action === "fund" ? "Funding" : action === "accept" ? "Acceptance" : action === "confirm" ? "Release confirmation" : "Evidence submission"} was reverted on GIWA Sepolia. The on-chain job state has not changed.`;
  }
  return `${action === "fund" ? "Funding" : action === "accept" ? "Acceptance" : action === "confirm" ? "Release confirmation" : "Evidence submission"} is still pending or its receipt is unavailable. Check the transaction before retrying.`;
}

function hasDefinitiveRevert(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /did not receive a successful receipt|revert|reverted/i.test(message);
}

function pendingFromSearch(search: string): PendingAction | undefined {
  const params = new URLSearchParams(search);
  const action = params.get("action");
  const hash = params.get("tx");
  if (
    (action === "fund" || action === "accept" || action === "submit-proof" || action === "confirm") &&
    hash?.startsWith("0x")
  ) return { action, hash: hash as Hash };
  return undefined;
}

function actionLabel(action: JobAction): string {
  switch (action) {
    case "fund": return "Fund escrow";
    case "accept": return "Accept job";
    case "confirm": return "Confirm release";
    case "submit-proof": return "Submit evidence";
  }
}

export function JobDetailPage() {
  const { address: routeAddress } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { address: account, canWrite } = useWalletWriteAccess();
  const { writeContractAsync } = useWriteContract();
  const walletGeneration = useRef(0);
  const accountRef = useRef(account);
  const canWriteRef = useRef(canWrite);
  const jobAddress = routeAddress && isAddress(routeAddress) ? routeAddress : undefined;
  const jobQuery = useQuery({
    queryKey: jobAddress ? jobsKeys.detail(jobAddress) : ["jobs", ACTIVE_CHAIN_ID, "detail", "invalid"],
    queryFn: () => loadJob(jobAddress!),
    enabled: jobAddress !== undefined,
    staleTime: 15_000,
  });
  const [pending, setPending] = useState<PendingAction | undefined>(() => pendingFromSearch(location.search));
  const [feedback, setFeedback] = useState<string | undefined>();
  const [lastHash, setLastHash] = useState<Hash | undefined>();

  useEffect(() => {
    if (accountRef.current !== account || canWriteRef.current !== canWrite) {
      walletGeneration.current += 1;
      accountRef.current = account;
      canWriteRef.current = canWrite;
    }
  }, [account, canWrite]);

  const job = jobQuery.data;
  const actions = useMemo(
    () => job === undefined ? [] : deriveJobActions({
      client: job.client,
      worker: job.worker,
      status: job.status,
      milestones: job.milestones.map((milestone) => ({ status: milestone[1] })),
    }, account),
    [account, job],
  );
  const pendingMilestone = job?.milestones.findIndex((milestone) => milestone[1] === MILESTONE_STATUS.Pending) ?? -1;
  const submittedMilestone = job?.milestones.findIndex((milestone) => milestone[1] === MILESTONE_STATUS.Submitted) ?? -1;

  function updatePending(next: PendingAction | undefined) {
    setPending(next);
    const params = new URLSearchParams(location.search);
    if (next) {
      params.set("action", next.action);
      params.set("tx", next.hash);
    } else {
      params.delete("action");
      params.delete("tx");
    }
    navigate({ pathname: location.pathname, search: params.size ? `?${params.toString()}` : "" }, { replace: true });
  }

  async function refreshAfterSuccess(hash: Hash, action: WorkflowAction) {
    setLastHash(hash);
    updatePending(undefined);
    const accounts = [
      ...(account ? [account] : []),
      ...(action === "confirm" ? [job?.worker] : []),
    ].filter((value): value is Address => value !== undefined);
    await invalidateJobQueries(queryClient, {
      jobAddress,
      accounts,
      workers: action === "accept" && account ? [account] : [],
    });
    await jobQuery.refetch();
  }

  useEffect(() => {
    if (!pending || !jobAddress) return;
    const recovered = pending;
    let cancelled = false;
    async function recoverPending() {
      setFeedback(`Checking the submitted ${recovered.action.replace("-", " ")} transaction on GIWA Sepolia…`);
      try {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: recovered.hash });
        if (cancelled) return;
        if (receipt.status !== "success") {
          updatePending(undefined);
          setFeedback(transactionError(recovered.action, new Error("reverted receipt")));
          return;
        }
        await refreshAfterSuccess(recovered.hash, recovered.action);
        if (!cancelled) setFeedback("Transaction confirmed on GIWA Sepolia. Job data has refreshed.");
      } catch (error) {
        if (!cancelled) setFeedback(transactionError(recovered.action, error));
      }
    }
    void recoverPending();
    return () => { cancelled = true; };
  }, [pending?.action, pending?.hash, jobAddress]);

  async function runAction(
    action: Exclude<JobAction, "submit-proof">,
    request: Record<string, unknown>,
  ) {
    if (!job || !jobAddress || !account || !canWrite || pending) return;
    setFeedback(undefined);
    let hash: Hash | undefined;
    const input = {
      writeContract: async (writeRequest: Record<string, unknown>) => {
        hash = await writeContractAsync(writeRequest as never);
        updatePending({ action, hash });
        return hash;
      },
      waitForReceipt: publicClient.waitForTransactionReceipt,
      request,
    };
    try {
      const result = action === "fund" ? await runFund(input) : action === "accept" ? await runAccept(input) : await runConfirm(input);
      await refreshAfterSuccess(result.hash, action);
      setFeedback("Transaction confirmed on GIWA Sepolia. Job data has refreshed.");
    } catch (error) {
      if (hash) setLastHash(hash);
      if (hasDefinitiveRevert(error)) updatePending(undefined);
      setFeedback(transactionError(action, error));
    }
  }

  async function submitEvidence(file: File) {
    if (!job || !jobAddress || !account || !canWrite || pending || pendingMilestone < 0) return;
    setFeedback(undefined);
    const uploadAccount = account;
    const uploadGeneration = walletGeneration.current;
    const { pin, proofHash } = await uploadEvidence(file);
    if (
      walletGeneration.current !== uploadGeneration ||
      accountRef.current !== uploadAccount ||
      !canWriteRef.current
    ) {
      const message = "Your wallet or network changed while evidence was uploading. Reconnect and try again.";
      setFeedback(message);
      throw new Error(message);
    }
    let hash: Hash | undefined;
    try {
      const result = await runSubmitProof({
        writeContract: async (writeRequest: Record<string, unknown>) => {
          hash = await writeContractAsync(writeRequest as never);
          updatePending({ action: "submit-proof", hash });
          return hash;
        },
        waitForReceipt: publicClient.waitForTransactionReceipt,
        request: {
          address: jobAddress,
          abi: EscrowJobAbi,
          functionName: "submitMilestone",
          args: [BigInt(pendingMilestone), proofHash, pin.cid],
          chainId: 91342,
        },
      });
      await refreshAfterSuccess(result.hash, "submit-proof");
      setFeedback(`Evidence CID ${pin.cid} is confirmed on-chain.`);
    } catch (error) {
      if (hash) setLastHash(hash);
      if (hasDefinitiveRevert(error)) updatePending(undefined);
      throw new Error(transactionError("submit-proof", error));
    }
  }

  if (!jobAddress) return <div className="dashboard-page"><p className="dashboard-feedback dashboard-feedback-error" role="alert">This job address is invalid.</p></div>;
  if (jobQuery.isLoading) return <div className="dashboard-page"><p className="dashboard-feedback" role="status">Loading job from GIWA Sepolia…</p></div>;
  if (jobQuery.isError || !job) return <div className="dashboard-page"><p className="dashboard-feedback dashboard-feedback-error" role="alert">This on-chain job could not be loaded. Refresh to try the chain read again.</p></div>;

  const title = job.metadata?.title ?? `Escrow ${compactAddress(job.address)}`;
  const selectedPending = pendingMilestone >= 0 ? job.milestones[pendingMilestone] : undefined;
  const selectedSubmitted = submittedMilestone >= 0 ? job.milestones[submittedMilestone] : undefined;
  const pendingTitle = pendingMilestone >= 0 ? job.metadata?.milestones[pendingMilestone]?.title ?? `Milestone ${pendingMilestone + 1}` : "Milestone";
  const submittedTitle = submittedMilestone >= 0 ? job.metadata?.milestones[submittedMilestone]?.title ?? `Milestone ${submittedMilestone + 1}` : "Milestone";
  const actionPending = pending !== undefined;

  return (
    <div className="dashboard-page job-detail-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-overline">On-chain escrow · {compactAddress(job.address)}</p>
          <h1>{title}</h1>
          <p>{job.metadata?.description ?? "The IPFS job brief is unavailable, but this escrow’s participants, milestones, amounts, and state are read directly from GIWA Sepolia."}</p>
        </div>
        <JobStatusBadge status={job.status} />
      </header>

      <WalletGate />

      <section className="job-detail-facts" aria-label="Escrow details">
        <div><span>Escrowed</span><strong>{formatUnits(job.totalAmount, 6)} USDC</strong></div>
        <div><span>Client</span><code title={job.client}>{compactAddress(job.client)}</code></div>
        <div><span>Worker</span><code title={job.worker}>{/^0x0{40}$/i.test(job.worker) ? "Unassigned" : compactAddress(job.worker)}</code></div>
        <div><span>Metadata CID</span><code>{job.metadataCid}</code></div>
      </section>

      {job.metadataError ? <p className="job-detail-warning" role="status">Metadata is temporarily unavailable. The information above and milestone states below are authoritative on-chain data.</p> : null}

      <section className="job-detail-section" aria-labelledby="milestone-heading">
        <div className="job-detail-section-heading"><h2 id="milestone-heading">Release timeline</h2><p>Each milestone moves from proof to receipt-confirmed release.</p></div>
        <MilestoneTimeline milestones={job.milestones} metadata={job.metadata} />
      </section>

      {selectedPending && actions.includes("submit-proof") ? (
        <EvidencePanel
          milestoneTitle={pendingTitle}
          proofCid=""
          proofHash={selectedPending[2] as Hex}
          canSubmit
          pending={actionPending}
          onSubmit={submitEvidence}
        />
      ) : null}

      {selectedSubmitted ? (
        <EvidencePanel
          milestoneTitle={submittedTitle}
          proofCid={selectedSubmitted[3]}
          proofHash={selectedSubmitted[2] as Hex}
          canSubmit={false}
          pending={actionPending}
          onSubmit={async () => undefined}
        />
      ) : null}

      {actions.filter((action) => action !== "submit-proof" && action !== "fund").length > 0 || actions.includes("fund") ? (
        <section className="job-detail-action" aria-label="Available job action">
          {actions.includes("fund") ? <Link className="btn-primary" to={`/app/jobs/new?job=${jobAddress}`}>Recover funding</Link> : null}
          {actions.filter((action) => action !== "submit-proof" && action !== "fund").map((action) => (
            <button
              className="btn-primary"
              disabled={!canWrite || actionPending}
              key={action}
              type="button"
              onClick={() => void runAction(action, {
                address: jobAddress,
                abi: EscrowJobAbi,
                functionName: action === "accept" ? "acceptJob" : "confirmMilestone",
                args: action === "confirm" && submittedMilestone >= 0 ? [BigInt(submittedMilestone)] : undefined,
                chainId: 91342,
              })}
            >
              {actionPending ? "Waiting for GIWA receipt…" : actionLabel(action)}
            </button>
          ))}
          {!canWrite ? <p>Connect the authorized wallet on GIWA Sepolia to continue.</p> : null}
        </section>
      ) : null}

      <div className="job-detail-feedback" aria-live="polite">
        {feedback ? <p role={/reverted|cancelled|pending/i.test(feedback) ? "alert" : "status"}>{feedback}</p> : null}
        {(pending?.hash ?? lastHash) ? <a href={faucetTransactionUrl(pending?.hash ?? lastHash!)} target="_blank" rel="noreferrer" aria-label="View job transaction on GIWA Explorer">View transaction on GIWA Explorer</a> : null}
      </div>
    </div>
  );
}
