import { isAddressEqual, parseUnits, zeroAddress, type Address, type Hex } from "viem";

const JOB_METADATA_SCHEMA = "giglock/job@1" as const;
const USDC_DECIMALS = 6;
const MAX_UINT256 = (1n << 256n) - 1n;
const USDC_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;

export const JOB_STATUS = {
  Created: 0,
  Funded: 1,
  InProgress: 2,
  Completed: 3,
  Cancelled: 4,
} as const;

export const MILESTONE_STATUS = {
  Pending: 0,
  Submitted: 1,
  Confirmed: 2,
  Disputed: 3,
  Released: 4,
  Refunded: 5,
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];
export type MilestoneStatus = (typeof MILESTONE_STATUS)[keyof typeof MILESTONE_STATUS];

export type JobMetadataV1 = {
  schema: typeof JOB_METADATA_SCHEMA;
  title: string;
  description: string;
  skills: string[];
  createdAt: string;
  milestones: Array<{
    title: string;
    description: string;
    amountUsdc: string;
  }>;
};

export type MilestoneTuple = readonly [
  amount: bigint,
  status: number,
  proofHash: Hex,
  proofCid: string,
  submittedAt: bigint,
  confirmDeadline: bigint,
];

export type MilestoneView = {
  id: number;
  title: string;
  description: string;
  amount: bigint;
  amountUsdc: string;
  status: number;
  proofHash: Hex;
  proofCid: string;
  submittedAt: bigint;
  confirmDeadline: bigint;
};

export type JobSnapshot = {
  client: Address;
  worker: Address;
  status: number;
  milestones: ReadonlyArray<Pick<MilestoneView, "status">>;
};

export type JobAction = "fund" | "accept" | "submit-proof" | "confirm";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function characterCount(value: string): number {
  return Array.from(value).length;
}

function parseText(value: unknown, field: string, minimum: number, maximum: number): string {
  if (typeof value !== "string") throw new Error(`Invalid ${field}`);

  const length = characterCount(value);
  if (length < minimum || length > maximum) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function parseSkills(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 10) {
    throw new Error("Invalid skills");
  }
  return value.map((skill) => parseText(skill, "skill", 1, 32));
}

function parseMilestone(value: unknown): JobMetadataV1["milestones"][number] {
  if (!isRecord(value)) throw new Error("Invalid milestone");

  return {
    title: parseText(value.title, "milestone title", 3, 100),
    description: parseText(value.description, "milestone description", 0, 1_000),
    amountUsdc: parseAmount(value.amountUsdc),
  };
}

function parseAmount(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid USDC amount");
  parseUsdcAmount(value);
  return value;
}

export function parseUsdcAmount(value: string): bigint {
  if (/^\d+\.\d{7,}$/.test(value)) {
    throw new Error("USDC amount supports at most six decimals");
  }
  if (!USDC_DECIMAL_PATTERN.test(value)) {
    throw new Error("Invalid USDC amount");
  }

  const amount = parseUnits(value, USDC_DECIMALS);
  if (amount <= 0n) throw new Error("USDC amount must be greater than zero");
  if (amount > MAX_UINT256) throw new Error("USDC amount must fit uint256");
  return amount;
}

export function parseJobMetadata(value: unknown): JobMetadataV1 {
  if (!isRecord(value)) throw new Error("Invalid job metadata");
  if (value.schema !== JOB_METADATA_SCHEMA) {
    throw new Error("Unsupported job metadata schema");
  }
  if (typeof value.createdAt !== "string") throw new Error("Invalid createdAt");
  if (
    !Array.isArray(value.milestones) ||
    value.milestones.length < 1 ||
    value.milestones.length > 10
  ) {
    throw new Error("Invalid milestones");
  }

  const milestones = value.milestones.map(parseMilestone);
  const total = milestones.reduce(
    (sum, milestone) => sum + parseUsdcAmount(milestone.amountUsdc),
    0n,
  );
  if (total > MAX_UINT256) throw new Error("Milestone total must fit uint256");

  return {
    schema: JOB_METADATA_SCHEMA,
    title: parseText(value.title, "title", 3, 100),
    description: parseText(value.description, "description", 10, 4_000),
    skills: parseSkills(value.skills),
    createdAt: value.createdAt,
    milestones,
  };
}

export function serializeJobMetadata(input: JobMetadataV1): string {
  return JSON.stringify(parseJobMetadata(input));
}

function isSameAddress(account: Address | undefined, expected: Address): boolean {
  return account !== undefined && isAddressEqual(account, expected);
}

export function deriveJobActions(snapshot: JobSnapshot, account: Address | undefined): JobAction[] {
  const isClient = isSameAddress(account, snapshot.client);
  const isWorker = isSameAddress(account, snapshot.worker);

  if (isClient) {
    if (snapshot.status === JOB_STATUS.Created) return ["fund"];
    if (
      snapshot.status === JOB_STATUS.InProgress &&
      snapshot.milestones.some((milestone) => milestone.status === MILESTONE_STATUS.Submitted)
    ) {
      return ["confirm"];
    }
    return [];
  }

  if (snapshot.status === JOB_STATUS.Funded && isAddressEqual(snapshot.worker, zeroAddress)) {
    return account === undefined ? [] : ["accept"];
  }

  if (
    isWorker &&
    snapshot.status === JOB_STATUS.InProgress &&
    snapshot.milestones.some((milestone) => milestone.status === MILESTONE_STATUS.Pending)
  ) {
    return ["submit-proof"];
  }

  return [];
}

export function normalizeMilestone(
  tuple: MilestoneTuple,
  metadata: JobMetadataV1,
  index: number,
): MilestoneView {
  const metadataMilestone = metadata.milestones[index];
  if (metadataMilestone === undefined) {
    throw new Error("Missing milestone metadata");
  }

  const [amount, status, proofHash, proofCid, submittedAt, confirmDeadline] = tuple;
  return {
    id: index,
    title: metadataMilestone.title,
    description: metadataMilestone.description,
    amount,
    amountUsdc: metadataMilestone.amountUsdc,
    status,
    proofHash,
    proofCid,
    submittedAt,
    confirmDeadline,
  };
}
