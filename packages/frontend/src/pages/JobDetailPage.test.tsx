import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { JOB_STATUS, MILESTONE_STATUS } from "../features/jobs/model.js";

const client = "0x1111111111111111111111111111111111111111" as Address;
const worker = "0x2222222222222222222222222222222222222222" as Address;
const stranger = "0x3333333333333333333333333333333333333333" as Address;
const jobAddress = "0x4444444444444444444444444444444444444444" as Address;
const cid = "bafybeigdyrzt5sfp7udm7hu76rvv6igish4bntkyg5sw3m3wo4q";
const proofHash = `0x${"ab".repeat(32)}` as `0x${string}`;

const testState = vi.hoisted(() => ({
  wallet: { address: undefined as Address | undefined, canWrite: true },
  snapshot: undefined as unknown,
  writeContractAsync: vi.fn(),
  runFund: vi.fn(),
  runAccept: vi.fn(),
  runSubmitProof: vi.fn(),
  runConfirm: vi.fn(),
  uploadEvidence: vi.fn(),
  publicClient: { waitForTransactionReceipt: vi.fn() },
}));

vi.mock("wagmi", () => ({
  useWriteContract: () => ({ writeContractAsync: testState.writeContractAsync }),
}));

vi.mock("../features/jobs/components/WalletGate.js", () => ({
  WalletGate: () => <div>Wallet gate</div>,
  useWalletWriteAccess: () => testState.wallet,
}));

vi.mock("../features/jobs/queries.js", () => ({
  jobsKeys: { detail: (address: Address) => ["jobs", 91342, "detail", address] },
  loadJob: () => Promise.resolve(testState.snapshot),
}));

vi.mock("../features/jobs/ipfs.js", () => ({
  uploadEvidence: testState.uploadEvidence,
  ipfsUrl: (value: string) => {
    if (value === "not-a-valid-cid") throw new Error("Invalid IPFS CID");
    return `https://w3s.link/ipfs/${value}`;
  },
}));

vi.mock("../features/jobs/transactions.js", () => ({
  runFund: testState.runFund,
  runAccept: testState.runAccept,
  runSubmitProof: testState.runSubmitProof,
  runConfirm: testState.runConfirm,
  invalidateJobQueries: vi.fn(),
}));

vi.mock("../lib/wagmi.js", () => ({ ACTIVE_CHAIN_ID: 91342, publicClient: testState.publicClient }));

import { JobDetailPage } from "./JobDetailPage.js";

function snapshot(status: number, milestoneStatus: number = MILESTONE_STATUS.Pending, proofCid = "") {
  return {
    address: jobAddress,
    status,
    client,
    worker: status === JOB_STATUS.Funded ? "0x0000000000000000000000000000000000000000" : worker,
    totalAmount: 25_250_000n,
    metadataCid: cid,
    metadata: {
      schema: "giglock/job@1" as const,
      title: "Illustrate the protocol update",
      description: "Create a focused illustration for the protocol update announcement.",
      skills: ["Illustration"],
      createdAt: "2026-07-24T00:00:00.000Z",
      milestones: [{ title: "Final visual", description: "Deliver a high-resolution final asset.", amountUsdc: "25.25" }],
    },
    milestones: [[25_250_000n, milestoneStatus, milestoneStatus === MILESTONE_STATUS.Submitted ? proofHash : `0x${"00".repeat(32)}`, proofCid, 0n, 0n]],
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/app/jobs/${jobAddress}`]}>
        <Routes><Route path="/app/jobs/:address" element={<JobDetailPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("JobDetailPage action visibility", () => {
  beforeEach(() => {
    testState.wallet.address = client;
    testState.wallet.canWrite = true;
    testState.snapshot = snapshot(JOB_STATUS.Created);
    testState.runFund.mockResolvedValue({ hash: "0xfund" });
    testState.runAccept.mockResolvedValue({ hash: "0xaccept" });
    testState.runSubmitProof.mockResolvedValue({ hash: "0xproof" });
    testState.runConfirm.mockResolvedValue({ hash: "0xconfirm" });
    testState.uploadEvidence.mockResolvedValue({ pin: { cid, url: `https://w3s.link/ipfs/${cid}` }, proofHash });
  });

  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("shows the client a recovery-safe funding route only for a Created escrow", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "Fund escrow" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Accept job|Submit evidence|Confirm release/ })).toBeNull();
  });

  it("shows a stranger the accept action only for an unclaimed Funded escrow", async () => {
    testState.wallet.address = stranger;
    testState.snapshot = snapshot(JOB_STATUS.Funded);
    renderPage();
    expect(await screen.findByRole("button", { name: "Accept job" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Fund escrow|Submit evidence|Confirm release/ })).toBeNull();
  });

  it("shows the assigned worker a 10 MiB evidence submission action for a pending milestone", async () => {
    testState.wallet.address = worker;
    testState.snapshot = snapshot(JOB_STATUS.InProgress);
    renderPage();
    expect(await screen.findByLabelText("Evidence for Final visual", { selector: "input" })).toBeTruthy();
    expect(screen.getByText(/Maximum file size: 10 MiB/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit evidence" })).toBeTruthy();
  });

  it("shows the client proof CID, gateway, and exact hash before enabling confirmation", async () => {
    testState.snapshot = snapshot(JOB_STATUS.InProgress, MILESTONE_STATUS.Submitted, cid);
    renderPage();
    expect(await screen.findByText(proofHash)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open evidence in IPFS gateway" }).getAttribute("href")).toBe(`https://w3s.link/ipfs/${cid}`);
    expect(screen.getByRole("button", { name: "Confirm release" })).toBeTruthy();
  });

  it("keeps confirmation usable when an on-chain proof CID has no safe gateway URL", async () => {
    testState.snapshot = snapshot(JOB_STATUS.InProgress, MILESTONE_STATUS.Submitted, "not-a-valid-cid");
    renderPage();
    expect(await screen.findByText("not-a-valid-cid")).toBeTruthy();
    expect(screen.getByText("Gateway unavailable for this CID.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm release" })).toBeTruthy();
  });

  it("does not expose active job actions to an irrelevant wallet", async () => {
    testState.wallet.address = stranger;
    testState.snapshot = snapshot(JOB_STATUS.InProgress);
    renderPage();
    await screen.findByText("Illustrate the protocol update");
    expect(screen.queryByRole("button", { name: /Fund escrow|Accept job|Submit evidence|Confirm release/ })).toBeNull();
  });

  it("uploads the selected file before submitting its exact CID and raw-byte hash to the escrow", async () => {
    testState.wallet.address = worker;
    testState.snapshot = snapshot(JOB_STATUS.InProgress);
    renderPage();
    const file = new File(["final delivery"], "delivery.txt", { type: "text/plain" });
    fireEvent.change(await screen.findByLabelText("Evidence for Final visual", { selector: "input" }), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Submit evidence" }));

    await waitFor(() => expect(testState.uploadEvidence).toHaveBeenCalledWith(file));
    expect(testState.runSubmitProof).toHaveBeenCalledWith(expect.objectContaining({
      request: expect.objectContaining({
        functionName: "submitMilestone",
        args: [0n, proofHash, cid],
        chainId: 91342,
      }),
    }));
  });

  it("keeps on-chain participants, amounts, and milestones visible when IPFS metadata fails", async () => {
    testState.wallet.address = stranger;
    testState.snapshot = { ...snapshot(JOB_STATUS.InProgress), metadata: undefined, metadataError: "gateway timeout" };
    renderPage();
    expect(await screen.findByText("Escrowed")).toBeTruthy();
    expect(screen.getAllByText("25.25 USDC")).toHaveLength(2);
    expect(screen.getByText("Milestone 1")).toBeTruthy();
    expect(screen.getByText(/Metadata is temporarily unavailable/)).toBeTruthy();
  });
});
