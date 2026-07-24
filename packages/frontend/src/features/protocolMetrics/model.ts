import type { Address, Hash } from "viem";
import { formatUnits } from "viem";

const DAY_SECONDS = 86_400;
const CURRENT_PERIOD_DAYS = 7;

export type JobSnapshot = {
  address: Address;
  status: number;
  balance: bigint;
};

export type ProtocolEvent = {
  kind: string;
  transactionHash: Hash;
  blockNumber: bigint;
  timestamp: number;
  job?: Address;
  milestoneId?: bigint;
};

export type ProtocolMetricsInput = {
  now: number;
  jobs: JobSnapshot[];
  events: ProtocolEvent[];
};

export type ProtocolMetrics = {
  tvl: bigint;
  lockedJobs: number;
  totalJobs: number;
  totalTransactions: number;
  activeJobs: number;
  activePercent: number;
  averagePaymentSeconds: number | null;
  transactionSparkline: number[];
  transactionChangePercent: number | null;
};

function uniqueTransactionCount(events: ProtocolEvent[]): number {
  return new Set(events.map((event) => event.transactionHash)).size;
}

function paymentAverage(events: ProtocolEvent[]): number | null {
  const submittedAt = new Map<string, number>();
  const durations: number[] = [];

  for (const event of [...events].sort((a, b) => a.timestamp - b.timestamp)) {
    if (event.job === undefined || event.milestoneId === undefined) continue;
    const key = `${event.job.toLowerCase()}:${event.milestoneId.toString()}`;

    if (event.kind === "milestone-submitted") {
      submittedAt.set(key, event.timestamp);
    } else if (event.kind === "milestone-released") {
      const submitted = submittedAt.get(key);
      if (submitted !== undefined && event.timestamp >= submitted) {
        durations.push(event.timestamp - submitted);
      }
    }
  }

  if (durations.length === 0) return null;
  return durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
}

function transactionTrend(events: ProtocolEvent[], now: number) {
  const todayStart = Math.floor(now / DAY_SECONDS) * DAY_SECONDS;
  const currentStart = todayStart - (CURRENT_PERIOD_DAYS - 1) * DAY_SECONDS;
  const previousStart = currentStart - CURRENT_PERIOD_DAYS * DAY_SECONDS;
  const currentEnd = todayStart + DAY_SECONDS;
  const buckets = Array.from({ length: CURRENT_PERIOD_DAYS }, () => new Set<Hash>());
  const previousHashes = new Set<Hash>();

  for (const event of events) {
    if (event.timestamp >= currentStart && event.timestamp < currentEnd) {
      const index = Math.floor((event.timestamp - currentStart) / DAY_SECONDS);
      buckets[index]?.add(event.transactionHash);
    } else if (event.timestamp >= previousStart && event.timestamp < currentStart) {
      previousHashes.add(event.transactionHash);
    }
  }

  const transactionSparkline = buckets.map((bucket) => bucket.size);
  const currentCount = transactionSparkline.reduce((sum, count) => sum + count, 0);
  const previousCount = previousHashes.size;
  const transactionChangePercent =
    previousCount === 0
      ? null
      : Math.round(((currentCount - previousCount) / previousCount) * 1_000) / 10;

  return { transactionSparkline, transactionChangePercent };
}

export function aggregateProtocolMetrics({
  now,
  jobs,
  events,
}: ProtocolMetricsInput): ProtocolMetrics {
  const tvl = jobs.reduce((sum, job) => sum + job.balance, 0n);
  const lockedJobs = jobs.filter((job) => job.balance > 0n).length;
  const activeJobs = jobs.filter((job) => job.status === 1 || job.status === 2).length;
  const activePercent =
    jobs.length === 0 ? 0 : Math.round((activeJobs / jobs.length) * 100);

  return {
    tvl,
    lockedJobs,
    totalJobs: jobs.length,
    totalTransactions: uniqueTransactionCount(events),
    activeJobs,
    activePercent,
    averagePaymentSeconds: paymentAverage(events),
    ...transactionTrend(events, now),
  };
}

export function formatUsdc(value: bigint): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(formatUnits(value, 6)));
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  return seconds.toFixed(2);
}
