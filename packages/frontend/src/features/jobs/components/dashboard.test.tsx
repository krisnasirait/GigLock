import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function renderDashboard(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AppDashboardPage />
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

  it("does not show a cancelled escrow as a completed transaction path", () => {
    const { container } = render(<TransactionProgress status={4} milestones={[]} />);

    expect(container.querySelector(".transaction-step.is-complete")).toBeNull();
  });
});
