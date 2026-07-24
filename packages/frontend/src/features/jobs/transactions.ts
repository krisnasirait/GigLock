import { JobFactoryAbi } from "@giglock/shared";
import {
  decodeEventLog,
  isAddressEqual,
  type Address,
  type Hash,
  type TransactionReceipt,
} from "viem";
import { jobsKeys } from "./queries.js";

export type CreateWorkflowState = {
  metadataCid?: string;
  jobAddress?: Address;
  allowance: bigint;
};

export type CreateStep = "metadata" | "create" | "approve" | "fund";
export type WorkflowAction =
  "claim" | "create" | "approve" | "fund" | "accept" | "submit-proof" | "confirm";
export type WorkflowPhase = "idle" | "wallet" | "submitted" | "confirming" | "success" | "error";
export type WorkflowEvent =
  | { type: "submit" }
  | { type: "submitted"; hash: Hash }
  | { type: "confirmed" }
  | { type: "failed" };
export type WorkflowState = { action: WorkflowAction; phase: WorkflowPhase; hash?: Hash };

type ContractWriter = (request: Record<string, unknown>) => Promise<Hash>;
type ReceiptWaiter = (parameters: { hash: Hash }) => Promise<TransactionReceipt>;
type Invalidator = {
  invalidateQueries: (filters: {
    queryKey: readonly unknown[];
    exact?: boolean;
  }) => Promise<unknown>;
};

export function nextCreateStep(state: CreateWorkflowState, total: bigint): CreateStep {
  if (state.metadataCid === undefined || state.metadataCid.length === 0) return "metadata";
  if (state.jobAddress === undefined) return "create";
  if (state.allowance < total) return "approve";
  return "fund";
}

export function reduceWorkflow(state: WorkflowState, event: WorkflowEvent): WorkflowState {
  switch (event.type) {
    case "submit":
      return { ...state, phase: "wallet" };
    case "submitted":
      return { ...state, phase: "confirming", hash: event.hash };
    case "confirmed":
      return state.phase === "confirming" ? { ...state, phase: "success" } : state;
    case "failed":
      return { ...state, phase: "error" };
  }
}

export const workflowReducers: Record<WorkflowAction, typeof reduceWorkflow> = {
  claim: reduceWorkflow,
  create: reduceWorkflow,
  approve: reduceWorkflow,
  fund: reduceWorkflow,
  accept: reduceWorkflow,
  "submit-proof": reduceWorkflow,
  confirm: reduceWorkflow,
};

export function decodeCreatedJobAddress(
  receipt: Pick<TransactionReceipt, "logs">,
  factory: Address,
): Address {
  for (const log of receipt.logs) {
    if (!isAddressEqual(log.address, factory)) continue;
    if (log.topics.length === 0) continue;
    try {
      const decoded = decodeEventLog({
        abi: JobFactoryAbi,
        data: log.data,
        topics: log.topics,
        strict: true,
      });
      if (decoded.eventName === "JobCreated") return decoded.args.jobContract;
    } catch {
      // An unrelated factory log is not a JobCreated event.
    }
  }
  throw new Error(
    "Confirmed create receipt does not contain JobCreated from the configured factory.",
  );
}

export async function invalidateJobQueries(
  queryClient: Invalidator,
  input: { jobAddress?: Address; accounts?: Address[] },
): Promise<void> {
  const invalidations: Array<{ queryKey: readonly unknown[]; exact?: boolean }> = [
    { queryKey: jobsKeys.all, exact: true },
    ...(input.jobAddress === undefined ? [] : [{ queryKey: jobsKeys.detail(input.jobAddress), exact: true }]),
    ...(input.accounts ?? []).map((account) => ({ queryKey: jobsKeys.balances(account), exact: true })),
  ];
  await Promise.all(invalidations.map((entry) => queryClient.invalidateQueries(entry)));
}

async function runConfirmedTransaction(input: {
  writeContract: ContractWriter;
  waitForReceipt: ReceiptWaiter;
  request: Record<string, unknown>;
}): Promise<{ hash: Hash; receipt: TransactionReceipt }> {
  const hash = await input.writeContract(input.request);
  const receipt = await input.waitForReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction ${hash} did not receive a successful receipt.`);
  }
  return { hash, receipt };
}

export async function runCreate(input: {
  writeContract: ContractWriter;
  waitForReceipt: ReceiptWaiter;
  request: Record<string, unknown>;
  factory: Address;
}): Promise<{ hash: Hash; receipt: TransactionReceipt; jobAddress: Address }> {
  const { hash, receipt } = await runConfirmedTransaction(input);
  return { hash, receipt, jobAddress: decodeCreatedJobAddress(receipt, input.factory) };
}

export const runClaim = runConfirmedTransaction;
export const runApprove = runConfirmedTransaction;
export const runFund = runConfirmedTransaction;
export const runAccept = runConfirmedTransaction;
export const runSubmitProof = runConfirmedTransaction;
export const runConfirm = runConfirmedTransaction;
