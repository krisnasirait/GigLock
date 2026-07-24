import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { zeroAddress, type Address } from "viem";

const testState = vi.hoisted(() => ({
  writeContractAsync: vi.fn(),
  switchChain: vi.fn(),
  openConnectModal: vi.fn(),
  wallet: {
    address: undefined as Address | undefined,
    chainId: undefined as number | undefined,
  },
  publicClient: {
    getBalance: vi.fn(),
    readContract: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
  },
  loaders: {
    all: vi.fn(),
    worker: vi.fn(),
  },
}));

const account = "0x1111111111111111111111111111111111111111" as Address;
const { writeContractAsync, switchChain, openConnectModal, wallet, publicClient, loaders } = testState;

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: testState.wallet.address, isConnected: testState.wallet.address !== undefined }),
  useChainId: () => testState.wallet.chainId,
  useSwitchChain: () => ({ switchChain: testState.switchChain }),
  useWriteContract: () => ({ writeContractAsync: testState.writeContractAsync }),
}));

vi.mock("@rainbow-me/rainbowkit", () => ({
  useConnectModal: () => ({ openConnectModal: testState.openConnectModal }),
}));

vi.mock("../../../lib/wagmi.js", () => ({
  ACTIVE_CHAIN_ID: 91342,
  publicClient: testState.publicClient,
}));

vi.mock("../queries.js", async () => {
  const actual = await vi.importActual<typeof import("../queries.js")>("../queries.js");
  return {
    ...actual,
    loadAllJobs: testState.loaders.all,
    loadWorkerJobs: testState.loaders.worker,
  };
});

import { AppDashboardPage } from "../../../pages/AppDashboardPage.js";
import { jobsKeys } from "../queries.js";
import { TransactionProgress } from "./TransactionProgress.js";
import { JobCard } from "./JobCard.js";
import { faucetKeys } from "./faucet.js";

function renderDashboard(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AppDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe("AppDashboardPage", () => {
  beforeEach(() => {
    wallet.address = undefined;
    wallet.chainId = undefined;
    loaders.all.mockResolvedValue([]);
    loaders.worker.mockResolvedValue([]);
    publicClient.getBalance.mockResolvedValue(0n);
    publicClient.readContract.mockResolvedValue(0n);
    publicClient.waitForTransactionReceipt.mockResolvedValue({ status: "success" });
    writeContractAsync.mockResolvedValue("0x1234");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps available jobs visible while prompting a disconnected wallet to connect", async () => {
    loaders.all.mockResolvedValue([
      {
        address: "0x2222222222222222222222222222222222222222",
        status: 1,
        client: account,
        worker: zeroAddress,
        totalAmount: 2_500_000n,
        metadataCid: "bafy-job",
        milestones: [],
        metadata: {
          schema: "giglock/job@1",
          title: "Illustrate release notes",
          description: "Create a concise visual release note for the next protocol update.",
          skills: ["Illustration"],
          createdAt: "2026-07-24T00:00:00.000Z",
          milestones: [],
        },
      },
    ]);

    renderDashboard();

    expect(screen.getByText("Connect a wallet to claim test USDC or post a job.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeTruthy();
    expect(await screen.findByText("Illustrate release notes")).toBeTruthy();
  });

  it("offers one GIWA switch action for a connected wallet on the wrong network", async () => {
    wallet.address = account;
    wallet.chainId = 1;
    renderDashboard();

    const switchButton = await screen.findByRole("button", { name: "Switch to GIWA Sepolia" });
    fireEvent.click(switchButton);

    expect(switchChain).toHaveBeenCalledWith({ chainId: 91342 });
    expect(screen.queryByRole("button", { name: "Claim 1,000 test USDC" })).toBeNull();
  });

  it("explains the empty state for each dashboard tab", async () => {
    wallet.address = account;
    wallet.chainId = 91342;
    renderDashboard();

    expect(await screen.findByText("No funded jobs available right now.")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "My client jobs" }));
    expect(await screen.findByText("No client jobs yet. Post a job to start an escrow.")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "My worker jobs" }));
    expect(await screen.findByText("No worker jobs yet. Accept a funded job to begin.")).toBeTruthy();
  });

  it("confirms the faucet receipt before invalidating the exact balance query", async () => {
    wallet.address = account;
    wallet.chainId = 91342;
    const { queryClient } = renderDashboard();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    fireEvent.click(await screen.findByRole("button", { name: "Claim 1,000 test USDC" }));

    expect(await screen.findByText("Claim confirmed. Your USDC balance is refreshing.")).toBeTruthy();
    expect(publicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: "0x1234" });
    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: jobsKeys.balances(account),
        exact: true,
      }),
    );
  });

  it("links a submitted claim hash to the GIWA explorer until and after receipt confirmation", async () => {
    wallet.address = account;
    wallet.chainId = 91342;
    let resolveReceipt: (receipt: { status: "success" }) => void;
    publicClient.waitForTransactionReceipt.mockImplementationOnce(
      () => new Promise((resolve) => { resolveReceipt = resolve; }),
    );
    renderDashboard();

    fireEvent.click(await screen.findByRole("button", { name: "Claim 1,000 test USDC" }));

    const explorerLink = await screen.findByRole("link", { name: "View claim on GIWA Explorer" });
    expect(explorerLink.getAttribute("href")).toBe("https://sepolia-explorer.giwa.io/tx/0x1234");
    expect(explorerLink.getAttribute("target")).toBe("_blank");
    expect(explorerLink.getAttribute("rel")).toBe("noreferrer");

    resolveReceipt!({ status: "success" });
    await screen.findByText("Claim confirmed. Your USDC balance is refreshing.");
    expect(screen.getByRole("link", { name: "View claim on GIWA Explorer" })).toBeTruthy();
  });

  it("shows the on-chain next claim timestamp and disables an ineligible faucet action", async () => {
    wallet.address = account;
    wallet.chainId = 91342;
    publicClient.readContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "lastClaimedAt") return Promise.resolve(2_000_000_000n);
      if (functionName === "COOLDOWN") return Promise.resolve(86_400n);
      return Promise.resolve(0n);
    });
    renderDashboard();

    const timestamp = await screen.findByText("Next claim:");
    expect(timestamp.parentElement?.querySelector("time")?.dateTime).toBe("2033-05-19T03:33:20.000Z");
    expect((screen.getByRole("button", { name: "Claim 1,000 test USDC" }) as HTMLButtonElement).disabled).toBe(true);
    expect(writeContractAsync).not.toHaveBeenCalled();
  });

  it("distinguishes a wallet rejection from a faucet cooldown and an RPC failure", async () => {
    wallet.address = account;
    wallet.chainId = 91342;
    writeContractAsync.mockRejectedValueOnce({ name: "UserRejectedRequestError", code: 4001 });
    const { queryClient, rerender } = renderDashboard();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    fireEvent.click(await screen.findByRole("button", { name: "Claim 1,000 test USDC" }));
    expect(await screen.findByText("You cancelled the faucet claim in your wallet.")).toBeTruthy();
    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: faucetKeys.eligibility(account),
        exact: true,
      }),
    );

    writeContractAsync.mockRejectedValueOnce(new Error("faucet: wait 24h between claims"));
    fireEvent.click(screen.getByRole("button", { name: "Claim 1,000 test USDC" }));
    expect(await screen.findByText("This wallet has already claimed test USDC. Check the next claim time.")).toBeTruthy();

    writeContractAsync.mockRejectedValueOnce(new Error("network unavailable"));
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <AppDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Claim 1,000 test USDC" }));
    expect(await screen.findByText("The faucet could not reach GIWA Sepolia. Try again.")).toBeTruthy();
  });

  it("moves focus and selection across tabs with roving keyboard controls", async () => {
    wallet.address = account;
    wallet.chainId = 91342;
    renderDashboard();

    const available = screen.getByRole("tab", { name: "Available" });
    const client = screen.getByRole("tab", { name: "My client jobs" });
    const worker = screen.getByRole("tab", { name: "My worker jobs" });
    available.focus();
    fireEvent.keyDown(available, { key: "ArrowRight" });
    expect(document.activeElement).toBe(client);
    expect(client.getAttribute("aria-selected")).toBe("true");
    expect(client.getAttribute("aria-controls")).toBe("client-panel");
    fireEvent.keyDown(client, { key: "End" });
    expect(document.activeElement).toBe(worker);
    fireEvent.keyDown(worker, { key: "Home" });
    expect(document.activeElement).toBe(available);
  });

  it("does not count a disputed milestone as complete on a job card", () => {
    render(
      <MemoryRouter>
        <JobCard
          job={{
            address: "0x2222222222222222222222222222222222222222",
            status: 2,
            client: account,
            worker: account,
            totalAmount: 1_000_000n,
            metadataCid: "bafy-job",
            milestones: [[1_000_000n, 3, ("0x" + "00".repeat(32)) as `0x${string}`, "", 0n, 0n]],
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("0/1 complete")).toBeTruthy();
  });

  it("links every job card to its details and Created jobs to funding recovery", () => {
    const jobAddress = "0x2222222222222222222222222222222222222222";
    render(
      <MemoryRouter>
        <JobCard
          job={{
            address: jobAddress,
            status: 0,
            client: account,
            worker: zeroAddress,
            totalAmount: 1_000_000n,
            metadataCid: "bafy-job",
            milestones: [],
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "View job" }).getAttribute("href")).toBe(`/app/jobs/${jobAddress}`);
    expect(screen.getByRole("link", { name: "Recover funding" }).getAttribute("href")).toBe(`/app/jobs/new?job=${jobAddress}`);
  });

  it("does not show a cancelled escrow as a completed transaction path", () => {
    const { container } = render(<TransactionProgress status={4} milestones={[]} />);

    expect(container.querySelector(".transaction-step.is-complete")).toBeNull();
  });
});
