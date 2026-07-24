import { describe, expect, it } from "vitest";
import { zeroAddress } from "viem";
import {
  deriveJobActions,
  JOB_STATUS,
  MILESTONE_STATUS,
  normalizeMilestone,
  parseJobMetadata,
  parseUsdcAmount,
  serializeJobMetadata,
  type JobMetadataV1,
  type JobSnapshot,
} from "./model.js";

const client = "0x00000000000000000000000000000000000000aa";
const worker = "0x00000000000000000000000000000000000000bb";
const stranger = "0x00000000000000000000000000000000000000cc";

const validInput: JobMetadataV1 = {
  schema: "giglock/job@1",
  title: "Build a polished landing page",
  description: "Create a responsive landing page with clear conversion paths.",
  skills: ["React", "TypeScript"],
  createdAt: "2026-07-24T00:00:00.000Z",
  milestones: [
    {
      title: "Design and implementation",
      description: "Deliver the approved responsive landing page implementation.",
      amountUsdc: "12.345678",
    },
  ],
};

function jobSnapshot(overrides: Partial<JobSnapshot> = {}): JobSnapshot {
  return {
    client,
    worker: zeroAddress,
    status: JOB_STATUS.Created,
    milestones: [],
    ...overrides,
  };
}

describe("parseUsdcAmount", () => {
  it("converts a positive USDC decimal value to six-decimal units", () => {
    expect(parseUsdcAmount("12.345678")).toBe(12_345_678n);
  });

  it("rejects zero and values with more than six decimal places", () => {
    expect(() => parseUsdcAmount("0")).toThrow("greater than zero");
    expect(() => parseUsdcAmount("0.000000")).toThrow("greater than zero");
    expect(() => parseUsdcAmount("1.0000001")).toThrow("six decimals");
  });

  it("rejects non-canonical decimal strings before parsing units", () => {
    for (const amount of ["", " 1", ".1", "1.", "01", "+1", "-1", "1e2"]) {
      expect(() => parseUsdcAmount(amount)).toThrow("USDC amount");
    }
  });

  it("rejects values that cannot fit in a uint256", () => {
    expect(() => parseUsdcAmount("1".repeat(80))).toThrow("uint256");
  });
});

describe("job metadata validation", () => {
  it("serializes and parses a valid version-one document", () => {
    expect(parseJobMetadata(JSON.parse(serializeJobMetadata(validInput)))).toEqual(validInput);
  });

  it("requires the supported schema discriminator", () => {
    expect(() => parseJobMetadata({ schema: "wrong" })).toThrow("Unsupported job metadata");
  });

  it("safely rejects values that are not metadata objects", () => {
    for (const value of [null, [], "metadata", 42, { schema: "giglock/job@1" }]) {
      expect(() => parseJobMetadata(value)).toThrow();
    }
  });

  it("enforces title and description boundaries", () => {
    expect(parseJobMetadata({ ...validInput, title: "abc" }).title).toBe("abc");
    expect(parseJobMetadata({ ...validInput, title: "t".repeat(100) }).title).toHaveLength(100);
    expect(() => parseJobMetadata({ ...validInput, title: "ab" })).toThrow("title");
    expect(() => parseJobMetadata({ ...validInput, title: "t".repeat(101) })).toThrow("title");

    expect(
      parseJobMetadata({ ...validInput, description: "d".repeat(10) }).description,
    ).toHaveLength(10);
    expect(
      parseJobMetadata({ ...validInput, description: "d".repeat(4_000) }).description,
    ).toHaveLength(4_000);
    expect(() => parseJobMetadata({ ...validInput, description: "short" })).toThrow("description");
    expect(() => parseJobMetadata({ ...validInput, description: "d".repeat(4_001) })).toThrow(
      "description",
    );
  });

  it("enforces skill count and each skill length", () => {
    expect(
      parseJobMetadata({ ...validInput, skills: Array.from({ length: 10 }, () => "x") }).skills,
    ).toHaveLength(10);
    expect(parseJobMetadata({ ...validInput, skills: ["s".repeat(32)] }).skills[0]).toHaveLength(
      32,
    );
    expect(() =>
      parseJobMetadata({ ...validInput, skills: Array.from({ length: 11 }, () => "x") }),
    ).toThrow("skills");
    expect(() => parseJobMetadata({ ...validInput, skills: [""] })).toThrow("skill");
    expect(() => parseJobMetadata({ ...validInput, skills: ["s".repeat(33)] })).toThrow("skill");
  });

  it("enforces milestone count, field limits, individual amounts, and uint256 totals", () => {
    const milestone = validInput.milestones[0]!;
    const maxWholeUsdc = ((1n << 256n) - 1n) / 1_000_000n;
    expect(
      parseJobMetadata({
        ...validInput,
        milestones: Array.from({ length: 10 }, () => milestone),
      }).milestones,
    ).toHaveLength(10);
    expect(
      parseJobMetadata({
        ...validInput,
        milestones: [{ ...milestone, title: "abc", description: "d".repeat(1_000) }],
      }).milestones[0],
    ).toMatchObject({ title: "abc", description: "d".repeat(1_000) });
    expect(
      parseJobMetadata({
        ...validInput,
        milestones: [{ ...milestone, title: "t".repeat(100) }],
      }).milestones[0]?.title,
    ).toHaveLength(100);
    expect(() => parseJobMetadata({ ...validInput, milestones: [] })).toThrow("milestones");
    expect(() =>
      parseJobMetadata({
        ...validInput,
        milestones: Array.from({ length: 11 }, () => milestone),
      }),
    ).toThrow("milestones");
    expect(() =>
      parseJobMetadata({
        ...validInput,
        milestones: [{ ...milestone, title: "ab" }],
      }),
    ).toThrow("milestone title");
    expect(() =>
      parseJobMetadata({
        ...validInput,
        milestones: [{ ...milestone, title: "t".repeat(101) }],
      }),
    ).toThrow("milestone title");
    expect(() =>
      parseJobMetadata({
        ...validInput,
        milestones: [{ ...milestone, description: "d".repeat(1_001) }],
      }),
    ).toThrow("milestone description");
    expect(() =>
      parseJobMetadata({
        ...validInput,
        milestones: [{ ...milestone, amountUsdc: "0" }],
      }),
    ).toThrow("greater than zero");
    expect(() =>
      parseJobMetadata({
        ...validInput,
        milestones: [
          { ...milestone, amountUsdc: maxWholeUsdc.toString() },
          { ...milestone, amountUsdc: "1" },
        ],
      }),
    ).toThrow("total");
  });
});

describe("deriveJobActions", () => {
  it("derives only permitted actions from role, state, and milestone status", () => {
    const createdJob = jobSnapshot();
    const fundedJob = jobSnapshot({ status: JOB_STATUS.Funded });
    const inProgressPendingJob = jobSnapshot({
      worker,
      status: JOB_STATUS.InProgress,
      milestones: [{ status: MILESTONE_STATUS.Pending }],
    });
    const inProgressSubmittedJob = jobSnapshot({
      worker,
      status: JOB_STATUS.InProgress,
      milestones: [{ status: MILESTONE_STATUS.Submitted }],
    });

    expect(deriveJobActions(createdJob, client)).toEqual(["fund"]);
    expect(deriveJobActions(fundedJob, stranger)).toEqual(["accept"]);
    expect(deriveJobActions(inProgressPendingJob, worker)).toEqual(["submit-proof"]);
    expect(deriveJobActions(inProgressSubmittedJob, client)).toEqual(["confirm"]);
    expect(deriveJobActions(inProgressPendingJob, stranger)).toEqual([]);
  });

  it("matches wallet addresses case-insensitively", () => {
    expect(deriveJobActions(jobSnapshot(), "0x00000000000000000000000000000000000000AA")).toEqual([
      "fund",
    ]);
  });

  it("does not offer acceptance to the client or after a worker is assigned", () => {
    expect(deriveJobActions(jobSnapshot({ status: JOB_STATUS.Funded }), client)).toEqual([]);
    expect(deriveJobActions(jobSnapshot({ status: JOB_STATUS.Funded, worker }), stranger)).toEqual(
      [],
    );
  });
});

describe("normalizeMilestone", () => {
  it("combines an ABI tuple with its metadata and preserves the proof CID", () => {
    expect(
      normalizeMilestone(
        [12_345_678n, MILESTONE_STATUS.Submitted, `0x${"ab".repeat(32)}`, "bafy-proof", 100n, 200n],
        validInput,
        0,
      ),
    ).toEqual({
      id: 0,
      title: "Design and implementation",
      description: "Deliver the approved responsive landing page implementation.",
      amount: 12_345_678n,
      amountUsdc: "12.345678",
      status: MILESTONE_STATUS.Submitted,
      proofHash: `0x${"ab".repeat(32)}`,
      proofCid: "bafy-proof",
      submittedAt: 100n,
      confirmDeadline: 200n,
    });
  });

  it("rejects an ABI tuple without corresponding metadata", () => {
    expect(() =>
      normalizeMilestone(
        [1n, MILESTONE_STATUS.Pending, `0x${"00".repeat(32)}`, "", 0n, 0n],
        validInput,
        1,
      ),
    ).toThrow("metadata");
  });
});
