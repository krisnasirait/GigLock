import {
  EscrowJobAbi,
  JobFactoryAbi,
  MockUSDCAbi,
  addressesByChain,
} from "@giglock/shared";
import { useQuery } from "@tanstack/react-query";
import {
  decodeEventLog,
  type Address,
  type Hash,
  type Log,
} from "viem";
import { ACTIVE_CHAIN_ID, publicClient } from "../../lib/wagmi.js";
import {
  aggregateProtocolMetrics,
  assertMetricsAddresses,
  blockRanges,
  type JobSnapshot,
  type ProtocolEvent,
  type ProtocolMetrics,
} from "./model.js";

const DEPLOYMENT_BLOCK = 31_535_952n;
const LOG_CHUNK_SIZE = 20_000n;
const ADDRESS_BATCH_SIZE = 100;
const METRICS_STALE_TIME = 30_000;
const METRICS_REFRESH_INTERVAL = 60_000;

function addressBatches(addresses: Address[]): Address[][] {
  const batches: Address[][] = [];
  for (let index = 0; index < addresses.length; index += ADDRESS_BATCH_SIZE) {
    batches.push(addresses.slice(index, index + ADDRESS_BATCH_SIZE));
  }
  return batches;
}

function requiredLogFields(log: Log): {
  blockNumber: bigint;
  transactionHash: Hash;
} {
  if (log.blockNumber === null || log.transactionHash === null) {
    throw new Error("GIWA RPC returned an unconfirmed protocol log");
  }
  return {
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
  };
}

async function loadJobCreatedLogs(
  jobFactory: Address,
  latestBlock: bigint,
) {
  const pages = await Promise.all(
    blockRanges(DEPLOYMENT_BLOCK, latestBlock, LOG_CHUNK_SIZE).map(
      ([fromBlock, toBlock]) =>
        publicClient.getContractEvents({
          address: jobFactory,
          abi: JobFactoryAbi,
          eventName: "JobCreated",
          fromBlock,
          toBlock,
          strict: true,
        }),
    ),
  );
  return pages.flat();
}

async function loadEscrowLogs(addresses: Address[], latestBlock: bigint) {
  if (addresses.length === 0) return [];

  const pages = await Promise.all(
    addressBatches(addresses).flatMap((addressBatch) =>
      blockRanges(DEPLOYMENT_BLOCK, latestBlock, LOG_CHUNK_SIZE).map(
        ([fromBlock, toBlock]) =>
          publicClient.getLogs({
            address: addressBatch,
            fromBlock,
            toBlock,
          }),
      ),
    ),
  );
  return pages.flat();
}

async function loadJobs(
  addresses: Address[],
  mockUsdc: Address,
): Promise<JobSnapshot[]> {
  if (addresses.length === 0) return [];

  const contracts = addresses.flatMap((address) => [
    {
      address,
      abi: EscrowJobAbi,
      functionName: "status",
    } as const,
    {
      address: mockUsdc,
      abi: MockUSDCAbi,
      functionName: "balanceOf",
      args: [address],
    } as const,
  ]);
  const results = await publicClient.multicall({
    contracts,
    allowFailure: false,
  });

  return addresses.map((address, index) => ({
    address,
    status: Number(results[index * 2]),
    balance: results[index * 2 + 1] as bigint,
  }));
}

async function loadBlockTimestamps(blockNumbers: bigint[]) {
  const entries = await Promise.all(
    [...new Set(blockNumbers)].map(async (blockNumber) => {
      const block = await publicClient.getBlock({ blockNumber });
      return [blockNumber, Number(block.timestamp)] as const;
    }),
  );
  return new Map(entries);
}

function normalizeEscrowEvent(
  log: Log,
  timestamps: Map<bigint, number>,
): ProtocolEvent | null {
  let decoded: ReturnType<typeof decodeEventLog<typeof EscrowJobAbi>>;
  try {
    decoded = decodeEventLog({
      abi: EscrowJobAbi,
      data: log.data,
      topics: log.topics,
      strict: true,
    });
  } catch {
    return null;
  }

  const { blockNumber, transactionHash } = requiredLogFields(log);
  const timestamp = timestamps.get(blockNumber);
  if (timestamp === undefined) throw new Error("Missing protocol block timestamp");

  const kindByEvent: Record<string, string> = {
    JobFunded: "job-funded",
    JobAccepted: "job-accepted",
    MilestoneSubmitted: "milestone-submitted",
    MilestoneConfirmed: "milestone-confirmed",
    MilestoneReleased: "milestone-released",
    DisputeRaised: "dispute-raised",
    DisputeResolved: "dispute-resolved",
    RatingSubmitted: "rating-submitted",
    JobCancelled: "job-cancelled",
  };
  const kind = kindByEvent[decoded.eventName];
  if (kind === undefined) return null;

  const args = decoded.args as { milestoneId?: bigint };
  return {
    kind,
    job: log.address,
    milestoneId: args.milestoneId,
    blockNumber,
    transactionHash,
    timestamp,
  };
}

export async function loadProtocolMetrics(): Promise<ProtocolMetrics> {
  const addresses = addressesByChain[ACTIVE_CHAIN_ID];
  if (addresses === undefined) {
    throw new Error(`Protocol metrics are not configured for chain ${ACTIVE_CHAIN_ID}`);
  }
  assertMetricsAddresses(addresses);

  const latestBlock = await publicClient.getBlockNumber();
  const createdLogs = await loadJobCreatedLogs(addresses.jobFactory, latestBlock);
  const jobAddresses = [
    ...new Set(createdLogs.map((log) => log.args.jobContract.toLowerCase())),
  ] as Address[];
  const [jobs, escrowLogs] = await Promise.all([
    loadJobs(jobAddresses, addresses.mockUsdc),
    loadEscrowLogs(jobAddresses, latestBlock),
  ]);
  const allLogs = [...createdLogs, ...escrowLogs];
  const blockNumbers = allLogs.map((log) => requiredLogFields(log).blockNumber);
  const timestamps = await loadBlockTimestamps(blockNumbers);

  const jobCreatedEvents: ProtocolEvent[] = createdLogs.map((log) => {
    const { blockNumber, transactionHash } = requiredLogFields(log);
    const timestamp = timestamps.get(blockNumber);
    if (timestamp === undefined) throw new Error("Missing factory block timestamp");
    return {
      kind: "job-created",
      job: log.args.jobContract,
      blockNumber,
      transactionHash,
      timestamp,
    };
  });
  const events = [
    ...jobCreatedEvents,
    ...escrowLogs
      .map((log) => normalizeEscrowEvent(log, timestamps))
      .filter((event): event is ProtocolEvent => event !== null),
  ];

  return aggregateProtocolMetrics({
    now: Math.floor(Date.now() / 1_000),
    jobs,
    events,
  });
}

export function useProtocolMetrics() {
  return useQuery({
    queryKey: ["protocol-metrics", ACTIVE_CHAIN_ID],
    queryFn: loadProtocolMetrics,
    staleTime: METRICS_STALE_TIME,
    refetchInterval: METRICS_REFRESH_INTERVAL,
    retry: 2,
  });
}
