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
}));

vi.mock("../features/jobs/transactions.js", async () => {
  const actual = await vi.importActual<typeof import("../features/jobs/transactions.js")>("../features/jobs/transactions.js");
  return { ...actual, runCreate: testState.runCreate, runApprove: testState.runApprove, runFund: testState.runFund };
});

vi.mock("../lib/wagmi.js", () => ({ ACTIVE_CHAIN_ID: 91342, publicClient: testState.publicClient }));

import { NewJobPage } from "./NewJobPage.js";

const jobAddress = "0x2222222222222222222222222222222222222222" as Address;

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><NewJobPage /></MemoryRouter>
    </QueryClientProvider>,
  );
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
    testState.uploadJobMetadata.mockResolvedValue({ cid: "bafybeigdyrzt5v6xk4nfhj3x5w4y2w7brqv5aqhfvxbsqj4r2m5sjuyd2e", url: "https://gateway.test/metadata" });
    testState.runCreate.mockResolvedValue({ hash: "0xcreate", jobAddress });
    testState.runApprove.mockResolvedValue({ hash: "0xapprove" });
    testState.runFund.mockResolvedValue({ hash: "0xfund" });
    testState.publicClient.readContract.mockResolvedValue(0n);
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
});
