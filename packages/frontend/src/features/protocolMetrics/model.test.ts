import { describe, expect, it } from "vitest";
import {
  aggregateProtocolMetrics,
  formatDuration,
  formatUsdc,
  type ProtocolMetricsInput,
} from "./model.js";

const now = 1_753_334_400;
const jobOne = "0x0000000000000000000000000000000000000001";
const jobTwo = "0x0000000000000000000000000000000000000002";
const jobThree = "0x0000000000000000000000000000000000000003";

describe("aggregateProtocolMetrics", () => {
  it("returns the genuine empty protocol state", () => {
    expect(aggregateProtocolMetrics({ now, jobs: [], events: [] })).toEqual({
      tvl: 0n,
      lockedJobs: 0,
      totalJobs: 0,
      totalTransactions: 0,
      activeJobs: 0,
      activePercent: 0,
      averagePaymentSeconds: null,
      transactionSparkline: [0, 0, 0, 0, 0, 0, 0],
      transactionChangePercent: null,
    });
  });

  it("sums balances, classifies active jobs, and deduplicates transactions", () => {
    const input: ProtocolMetricsInput = {
      now,
      jobs: [
        { address: jobOne, status: 1, balance: 2_000_000n },
        { address: jobTwo, status: 2, balance: 3_000_000n },
        { address: jobThree, status: 3, balance: 0n },
      ],
      events: [
        {
          kind: "job-created",
          transactionHash: `0x${"01".repeat(32)}`,
          blockNumber: 1n,
          timestamp: now - 60,
        },
        {
          kind: "job-funded",
          transactionHash: `0x${"02".repeat(32)}`,
          blockNumber: 2n,
          timestamp: now - 50,
          job: jobOne,
        },
        {
          kind: "job-accepted",
          transactionHash: `0x${"02".repeat(32)}`,
          blockNumber: 2n,
          timestamp: now - 50,
          job: jobOne,
        },
      ],
    };

    expect(aggregateProtocolMetrics(input)).toMatchObject({
      tvl: 5_000_000n,
      lockedJobs: 2,
      totalJobs: 3,
      totalTransactions: 2,
      activeJobs: 2,
      activePercent: 67,
    });
  });

  it("pairs milestone submissions and releases while ignoring incomplete pairs", () => {
    const metrics = aggregateProtocolMetrics({
      now,
      jobs: [],
      events: [
        {
          kind: "milestone-submitted",
          job: jobOne,
          milestoneId: 0n,
          transactionHash: `0x${"01".repeat(32)}`,
          blockNumber: 1n,
          timestamp: 100,
        },
        {
          kind: "milestone-released",
          job: jobOne,
          milestoneId: 0n,
          transactionHash: `0x${"02".repeat(32)}`,
          blockNumber: 2n,
          timestamp: 104,
        },
        {
          kind: "milestone-released",
          job: jobOne,
          milestoneId: 1n,
          transactionHash: `0x${"03".repeat(32)}`,
          blockNumber: 3n,
          timestamp: 200,
        },
      ],
    });

    expect(metrics.averagePaymentSeconds).toBe(4);
  });

  it("buckets current activity and compares it with the prior seven days", () => {
    const day = 86_400;
    const events = [
      {
        kind: "job-created",
        transactionHash: `0x${"01".repeat(32)}`,
        blockNumber: 1n,
        timestamp: now - day,
      },
      {
        kind: "job-funded",
        transactionHash: `0x${"02".repeat(32)}`,
        blockNumber: 2n,
        timestamp: now - day,
        job: jobOne,
      },
      {
        kind: "job-created",
        transactionHash: `0x${"03".repeat(32)}`,
        blockNumber: 3n,
        timestamp: now - 8 * day,
      },
    ] satisfies ProtocolMetricsInput["events"];

    const metrics = aggregateProtocolMetrics({ now, jobs: [], events });

    expect(metrics.transactionSparkline.reduce((sum, count) => sum + count, 0)).toBe(2);
    expect(metrics.transactionChangePercent).toBe(100);
  });
});

describe("metric formatters", () => {
  it("formats USDC, counts, and unavailable duration", () => {
    expect(formatUsdc(12_345_678n)).toBe("$12.35");
    expect(formatUsdc(0n)).toBe("$0.00");
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(1.02)).toBe("1.02");
  });
});
