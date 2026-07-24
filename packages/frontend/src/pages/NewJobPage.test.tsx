import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "viem";

const testState = vi.hoisted(() => ({
  wallet: {
    address: "0x1111111111111111111111111111111111111111" as Address | undefined,
    canWrite: true,
  },
  writeContractAsync: vi.fn(),
  uploadJobMetadata: vi.fn(),
  runCreate: vi.fn(),
  runApprove: vi.fn(),
  runFund: vi.fn(),
  fetchJobMetadata: vi.fn(),
  chainJobExists: false,
  jobStatus: 0,
  publicClient: {
    readContract: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
  },
}));

vi.mock("wagmi", () => ({
  useWriteContract: () => ({ writeContractAsync: testState.writeContractAsync }),
}));

vi.mock("../features/jobs/components/WalletGate.js", () => ({
  WalletGate: () => <div>Wallet gate</div>,
  useWalletWriteAccess: () => testState.wallet,
}));

vi.mock("../features/jobs/ipfs.js", () => ({
  uploadJobMetadata: testState.uploadJobMetadata,
  fetchJobMetadata: testState.fetchJobMetadata,
}));

vi.mock("../features/jobs/transactions.js", async () => {
  const actual = await vi.importActual<typeof import("../features/jobs/transactions.js")>("../features/jobs/transactions.js");
  return { ...actual, runCreate: testState.runCreate, runApprove: testState.runApprove, runFund: testState.runFund };
});

vi.mock("../lib/wagmi.js", () => ({ ACTIVE_CHAIN_ID: 91342, publicClient: testState.publicClient }));

import { NewJobPage } from "./NewJobPage.js";

const jobAddress = "0x2222222222222222222222222222222222222222" as Address;
const metadataCid = "bafybeigdyrzt5v6xk4nfhj3x5w4y2w7brqv5aqhfvxbsqj4r2m5sjuyd2e";
const metadata = {
  schema: "giglock/job@1" as const,
  title: "Illustrate the protocol update",
  description: "Create a focused illustration for the upcoming protocol update announcement.",
  skills: ["Illustration", "Figma"],
  createdAt: "2026-07-24T00:00:00.000Z",
  milestones: [{
    title: "Create the final visual",
    description: "Deliver an original illustration as high-resolution source assets.",
    amountUsdc: "25.25",
  }],
};

function renderPage(initialEntries = ["/app/jobs/new"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    queryClient,
    ...render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}><NewJobPage /></MemoryRouter>
    </QueryClientProvider>,
    ),
  };
}

async function fillValidForm(user = userEvent.setup()) {
  await user.type(screen.getByLabelText("Job title"), "Illustrate the protocol update");
  await user.type(screen.getByLabelText("Job description"), "Create a focused illustration for the upcoming protocol update announcement.");
  await user.type(screen.getByLabelText("Skills"), "Illustration, Figma");
  await user.type(screen.getByLabelText("Milestone 1 title"), "Create the final visual");
  await user.type(screen.getByLabelText("Milestone 1 description"), "Deliver an original illustration as high-resolution source assets.");
  await user.type(screen.getByLabelText("Milestone 1 amount in USDC"), "25.25");
  return user;
}

describe("NewJobPage", () => {
  beforeEach(() => {
    testState.wallet.address = "0x1111111111111111111111111111111111111111" as Address;
    testState.wallet.canWrite = true;
    testState.chainJobExists = false;
    testState.jobStatus = 0;
    testState.uploadJobMetadata.mockResolvedValue({ cid: metadataCid, url: "https://gateway.test/metadata" });
    testState.fetchJobMetadata.mockResolvedValue(metadata);
    testState.runCreate.mockImplementation(async () => {
      testState.chainJobExists = true;
      return { hash: "0xcreate", jobAddress };
    });
    testState.runApprove.mockResolvedValue({ hash: "0xapprove" });
    testState.runFund.mockResolvedValue({ hash: "0xfund" });
    testState.publicClient.readContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "getJobsByClient") return Promise.resolve(testState.chainJobExists ? [jobAddress] : []);
      if (functionName === "client") return Promise.resolve(testState.wallet.address);
      if (functionName === "metadataCid") return Promise.resolve(metadataCid);
      if (functionName === "totalAmount") return Promise.resolve(25_250_000n);
      if (functionName === "status") return Promise.resolve(testState.jobStatus);
      if (functionName === "allowance") return Promise.resolve(0n);
      return Promise.resolve(0n);
    });
    testState.publicClient.waitForTransactionReceipt.mockResolvedValue({ status: "success" });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("enforces one to ten milestone rows and calculates the exact USDC total", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getAllByRole("group", { name: /Milestone \d+/ })).toHaveLength(1);
    expect((screen.getByRole("button", { name: "Remove milestone 1" }) as HTMLButtonElement).disabled).toBe(true);
    for (let index = 0; index < 9; index += 1) await user.click(screen.getByRole("button", { name: "Add milestone" }));
    expect(screen.getAllByRole("group", { name: /Milestone \d+/ })).toHaveLength(10);
    expect((screen.getByRole("button", { name: "Add milestone" }) as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByLabelText("Milestone 1 amount in USDC"), "12.345678");
    expect(screen.getByText("Total escrow: 12.345678 USDC")).toBeTruthy();
  });

  it("reports the exact field validation limits before uploading", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Job title"), "no");
    await user.type(screen.getByLabelText("Job description"), "short");
    await user.type(screen.getByLabelText("Milestone 1 title"), "no");
    await user.type(screen.getByLabelText("Milestone 1 amount in USDC"), "0.0000001");
    await user.click(screen.getByRole("button", { name: "Create and fund escrow" }));

    expect(await screen.findByText("Title must be 3–100 characters.")).toBeTruthy();
    expect(screen.getByText("Description must be 10–4,000 characters.")).toBeTruthy();
    expect(screen.getByText("Milestone 1 amount supports at most six decimals.")).toBeTruthy();
    expect(testState.uploadJobMetadata).not.toHaveBeenCalled();
  });

  it("rejects a milestone total that exceeds uint256 before uploading", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Add milestone" }));
    await user.type(screen.getByLabelText("Milestone 2 title"), "Deliver the source files");
    await user.type(screen.getByLabelText("Milestone 2 description"), "Deliver the editable source files to complete the handoff.");
    const maxUsdc = "115792089237316195423570985008687907853269984665640564039457584007913129.639935";
    await user.clear(screen.getByLabelText("Milestone 1 amount in USDC"));
    await user.type(screen.getByLabelText("Milestone 1 amount in USDC"), maxUsdc);
    await user.type(screen.getByLabelText("Milestone 2 amount in USDC"), maxUsdc);
    await user.click(screen.getByRole("button", { name: "Create and fund escrow" }));

    expect(await screen.findByText("Total escrow must fit uint256.")).toBeTruthy();
    expect(testState.uploadJobMetadata).not.toHaveBeenCalled();
  });

  it("retries a failed metadata upload without losing fields and pins once after it succeeds", async () => {
    testState.uploadJobMetadata.mockRejectedValueOnce(new Error("IPFS unavailable"));
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Create and fund escrow" }));
    expect(await screen.findByText("Metadata upload failed. Your form is still here; retry when ready.")).toBeTruthy();
    expect((screen.getByLabelText("Job title") as HTMLInputElement).value).toBe("Illustrate the protocol update");

    await user.click(screen.getByRole("button", { name: "Retry metadata upload" }));
    await screen.findByText("Escrow funded on GIWA Sepolia.");
    expect(testState.uploadJobMetadata).toHaveBeenCalledTimes(2);
    expect(testState.runCreate).toHaveBeenCalledTimes(1);
  });

  it("uses the confirmed create receipt address, then recovers through approval to funding without recreating", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Create and fund escrow" }));
    await screen.findByText("Escrow funded on GIWA Sepolia.");

    expect(testState.runCreate).toHaveBeenCalledWith(expect.objectContaining({
      factory: expect.any(String),
      request: expect.objectContaining({ functionName: "createJob", args: [[25_250_000n], expect.any(String)] }),
    }));
    expect(testState.runApprove).toHaveBeenCalledWith(expect.objectContaining({
      request: expect.objectContaining({ functionName: "approve", args: [expect.any(String), 25_250_000n] }),
    }));
    expect(testState.runFund).toHaveBeenCalledWith(expect.objectContaining({
      request: expect.objectContaining({ address: jobAddress, functionName: "fundJob" }),
    }));
    expect(screen.getByText(jobAddress)).toBeTruthy();
    expect(screen.getByRole("link", { name: "View create transaction on GIWA Explorer" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View approval transaction on GIWA Explorer" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View funding transaction on GIWA Explorer" })).toBeTruthy();
  });

  it("does not create a second job after a funding failure and distinguishes wallet cancellation", async () => {
    testState.runFund.mockRejectedValueOnce({ name: "UserRejectedRequestError", code: 4001 });
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Create and fund escrow" }));

    expect(await screen.findByText("You cancelled funding in your wallet. Your created job is ready to finish funding.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Finish funding" }));
    await screen.findByText("Escrow funded on GIWA Sepolia.");
    expect(testState.runCreate).toHaveBeenCalledTimes(1);
    expect(testState.runFund).toHaveBeenCalledTimes(2);
  });

  it("treats a funding receipt interruption as terminal when the authoritative escrow status is Funded", async () => {
    testState.writeContractAsync.mockResolvedValueOnce("0xfundpending");
    testState.runFund.mockImplementationOnce(async ({ writeContract }) => {
      await writeContract({});
      testState.jobStatus = 1;
      throw new Error("receipt RPC timed out");
    });
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Create and fund escrow" }));
    await screen.findByText("Escrow funded on GIWA Sepolia.");

    expect(testState.runFund).toHaveBeenCalledTimes(1);
    const fundedButton = screen.getByRole("button", { name: "Escrow funded" }) as HTMLButtonElement;
    expect(fundedButton).toHaveProperty("disabled", true);
    fireEvent.submit(fundedButton.closest("form")!);
    await waitFor(() => expect(testState.runFund).toHaveBeenCalledTimes(1));
    expect(testState.runCreate).toHaveBeenCalledTimes(1);
  });

  it("recovers a reloaded fund transaction as terminal when the verified escrow is already Funded", async () => {
    testState.chainJobExists = true;
    testState.jobStatus = 1;
    renderPage([`/app/jobs/new?job=${jobAddress}&cid=${metadataCid}&fundTx=0xfundpending`]);

    await screen.findByText("Escrow funded on GIWA Sepolia.");
    expect(screen.getByText(jobAddress)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Escrow funded" }) as HTMLButtonElement).toHaveProperty("disabled", true);
    expect(testState.runCreate).not.toHaveBeenCalled();
    expect(testState.runFund).not.toHaveBeenCalled();
  });

  it("releases a pending funding transaction only after an explicit reverted receipt", async () => {
    testState.chainJobExists = true;
    testState.publicClient.waitForTransactionReceipt.mockResolvedValueOnce({ status: "reverted" });
    const user = userEvent.setup();
    renderPage([`/app/jobs/new?job=${jobAddress}&cid=${metadataCid}&fundTx=0xfundpending`]);

    await user.click(screen.getByRole("button", { name: "Check submitted funding" }));
    expect(await screen.findByText("Funding transaction was reverted on GIWA Sepolia. You can try funding again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Finish funding" })).toBeTruthy();
  });

  it("resumes a direct-navigation created escrow from verified chain data without validating an empty form", async () => {
    testState.publicClient.readContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "getJobsByClient") return Promise.resolve([jobAddress]);
      if (functionName === "client") return Promise.resolve(testState.wallet.address);
      if (functionName === "metadataCid") return Promise.resolve(metadataCid);
      if (functionName === "totalAmount") return Promise.resolve(25_250_000n);
      if (functionName === "status") return Promise.resolve(0);
      if (functionName === "allowance") return Promise.resolve(0n);
      return Promise.resolve(0n);
    });
    const user = userEvent.setup();
    renderPage([`/app/jobs/new?job=${jobAddress}`]);

    expect(await screen.findByText(jobAddress)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Finish funding" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Finish funding" }));

    await screen.findByText("Escrow funded on GIWA Sepolia.");
    expect(testState.runCreate).not.toHaveBeenCalled();
    expect(testState.uploadJobMetadata).not.toHaveBeenCalled();
    expect(testState.runApprove).toHaveBeenCalledWith(expect.objectContaining({
      request: expect.objectContaining({ args: [jobAddress, 25_250_000n] }),
    }));
  });

  it("resolves a just-created chain job by CID before retrying an interrupted create receipt", async () => {
    let chainJobExists = false;
    testState.publicClient.readContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "getJobsByClient") return Promise.resolve(chainJobExists ? [jobAddress] : []);
      if (functionName === "client") return Promise.resolve(testState.wallet.address);
      if (functionName === "metadataCid") return Promise.resolve(metadataCid);
      if (functionName === "totalAmount") return Promise.resolve(25_250_000n);
      if (functionName === "status") return Promise.resolve(0);
      if (functionName === "allowance") return Promise.resolve(0n);
      return Promise.resolve(0n);
    });
    testState.runCreate.mockImplementationOnce(async () => {
      chainJobExists = true;
      throw new Error("receipt RPC timed out");
    });
    const user = userEvent.setup();
    renderPage();
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Create and fund escrow" }));
    await screen.findByText("Escrow funded on GIWA Sepolia.");
    expect(testState.runCreate).toHaveBeenCalledTimes(1);
  });

  it("resumes a reloaded pending create by its original CID before validating or uploading a replacement", async () => {
    testState.publicClient.waitForTransactionReceipt.mockImplementationOnce(async () => {
      testState.chainJobExists = true;
      throw new Error("receipt RPC timed out");
    });
    const user = userEvent.setup();
    renderPage([`/app/jobs/new?cid=${metadataCid}&createTx=0xpending`]);

    await user.click(screen.getByRole("button", { name: "Check submitted creation" }));
    await screen.findByText("Escrow funded on GIWA Sepolia.");

    expect(testState.publicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: "0xpending" });
    expect(testState.uploadJobMetadata).not.toHaveBeenCalled();
    expect(testState.runCreate).not.toHaveBeenCalled();
    expect(testState.runApprove).toHaveBeenCalledWith(expect.objectContaining({
      request: expect.objectContaining({ args: [jobAddress, 25_250_000n] }),
    }));
  });

  it("keeps an interrupted pending creation locked instead of allowing the original CID to be replaced", async () => {
    testState.publicClient.waitForTransactionReceipt.mockRejectedValueOnce(new Error("receipt RPC timed out"));
    const user = userEvent.setup();
    renderPage([`/app/jobs/new?cid=${metadataCid}&createTx=0xpending`]);

    await user.click(screen.getByRole("button", { name: "Check submitted creation" }));
    expect(await screen.findByText("Creation is still pending or its receipt is unavailable. Check the submitted transaction before trying again.")).toBeTruthy();

    expect((screen.getByLabelText("Job title") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole("group", { name: "Milestone 1" }).hasAttribute("disabled")).toBe(true);
    expect(testState.uploadJobMetadata).not.toHaveBeenCalled();
    expect(testState.runCreate).not.toHaveBeenCalled();
  });

  it("shows the verified escrow total and read-only metadata state when its IPFS metadata is unavailable", async () => {
    testState.chainJobExists = true;
    testState.fetchJobMetadata.mockRejectedValueOnce(new Error("gateway unavailable"));
    const user = userEvent.setup();
    renderPage([`/app/jobs/new?job=${jobAddress}`]);

    expect(await screen.findByText("Metadata is unavailable from IPFS. The verified on-chain escrow amount is shown below; this job is read-only.")).toBeTruthy();
    expect(screen.getByText("Total escrow: 25.25 USDC")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Finish funding" }));

    await screen.findByText("Escrow funded on GIWA Sepolia.");
    expect(testState.runApprove).toHaveBeenCalledWith(expect.objectContaining({
      request: expect.objectContaining({ args: [jobAddress, 25_250_000n] }),
    }));
  });

  it("does not replace a new job draft with an unrelated created escrow without a recovery hint", async () => {
    testState.chainJobExists = true;
    renderPage();

    await waitFor(() => expect(testState.publicClient.readContract).not.toHaveBeenCalled());
    expect((screen.getByLabelText("Job title") as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Create and fund escrow" })).toBeTruthy();
  });

  it("invalidates client job data immediately after creation even if funding is rejected", async () => {
    testState.runFund.mockRejectedValueOnce({ name: "UserRejectedRequestError", code: 4001 });
    const user = userEvent.setup();
    const { queryClient } = renderPage();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Create and fund escrow" }));

    await screen.findByText("You cancelled funding in your wallet. Your created job is ready to finish funding.");
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["jobs", 91342], exact: true });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["jobs", 91342, "detail", jobAddress], exact: true });
  });

  it("cancels an unconfirmed workflow when the connected account changes", async () => {
    let resolveUpload: (value: { cid: string; url: string }) => void;
    testState.uploadJobMetadata.mockImplementationOnce(() => new Promise((resolve) => { resolveUpload = resolve; }));
    const user = userEvent.setup();
    const rendered = renderPage();
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Create and fund escrow" }));

    testState.wallet.address = "0x3333333333333333333333333333333333333333" as Address;
    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <MemoryRouter><NewJobPage /></MemoryRouter>
      </QueryClientProvider>,
    );
    resolveUpload!({ cid: metadataCid, url: "https://gateway.test/metadata" });

    await waitFor(() => expect(testState.runCreate).not.toHaveBeenCalled());
  });
});
