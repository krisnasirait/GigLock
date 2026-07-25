import { EscrowJobAbi, JobFactoryAbi, addressesByChain } from "@giglock/shared";
import { type Address } from "viem";
import { ACTIVE_CHAIN_ID, publicClient } from "../../lib/wagmi.js";
import {
  blockRanges,
  GIWA_DEPLOYMENT_BLOCK,
  GIWA_LOG_CHUNK_SIZE,
} from "../protocolMetrics/model.js";
import { fetchJobMetadata } from "./ipfs.js";
import type { JobMetadataV1, MilestoneTuple } from "./model.js";

const jobsKeyPrefix = ["jobs", ACTIVE_CHAIN_ID] as const;

export const jobsKeys = {
  all: jobsKeyPrefix,
  detail: (address: Address) => [...jobsKeyPrefix, "detail", address] as const,
  balances: (account: Address) => [...jobsKeyPrefix, "balances", account] as const,
  worker: (account: Address) => [...jobsKeyPrefix, "worker", account] as const,
};

export type JobChainSnapshot = {
  address: Address;
  status: number;
  client: Address;
  worker: Address;
  totalAmount: bigint;
  metadataCid: string;
  milestones: MilestoneTuple[];
  metadata?: JobMetadataV1;
  metadataError?: string;
};

function configuredFactory(): Address {
  const addresses = addressesByChain[ACTIVE_CHAIN_ID];
  if (addresses === undefined) {
    throw new Error(`Jobs are not configured for chain ${ACTIVE_CHAIN_ID}`);
  }
  return addresses.jobFactory;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Job metadata is unavailable.";
}

/** Read a single contract view via eth_call (no multicall3 needed). */
function readOne<T>(
  address: Address,
  abi: typeof EscrowJobAbi | typeof JobFactoryAbi,
  functionName: string,
  args?: readonly unknown[],
): Promise<T> {
  return publicClient.readContract({
    address,
    abi: abi as never,
    functionName,
    args,
  }) as Promise<T>;
}

async function loadSnapshots(addresses: Address[]): Promise<JobChainSnapshot[]> {
  if (addresses.length === 0) return [];

  // Fetch all base fields in parallel using individual eth_call (no multicall3).
  const baseResults = await Promise.all(
    addresses.map(async (address) => {
      const [status, client, worker, totalAmount, metadataCid, milestoneCount] =
        await Promise.all([
          readOne<bigint>(address, EscrowJobAbi, "status"),
          readOne<Address>(address, EscrowJobAbi, "client"),
          readOne<Address>(address, EscrowJobAbi, "worker"),
          readOne<bigint>(address, EscrowJobAbi, "totalAmount"),
          readOne<string>(address, EscrowJobAbi, "metadataCid"),
          readOne<bigint>(address, EscrowJobAbi, "milestoneCount"),
        ]);
      return {
        address,
        status: Number(status),
        client,
        worker,
        totalAmount,
        metadataCid,
        milestoneCount: Number(milestoneCount),
      };
    }),
  );

  // Fetch milestones per job in parallel.
  const milestoneResults = await Promise.all(
    baseResults.map(({ address, milestoneCount }) =>
      Promise.all(
        Array.from({ length: milestoneCount }, (_, milestoneId) =>
          readOne<MilestoneTuple>(address, EscrowJobAbi, "milestones", [
            BigInt(milestoneId),
          ]),
        ),
      ),
    ),
  );

  // Fetch IPFS metadata in parallel.
  const metadataResults = await Promise.all(
    baseResults.map(async ({ metadataCid }) => {
      try {
        return { metadata: await fetchJobMetadata(metadataCid) };
      } catch (error) {
        return { metadataError: errorMessage(error) };
      }
    }),
  );

  return baseResults.map((job, index) => ({
    ...job,
    milestones: milestoneResults[index] ?? [],
    ...metadataResults[index],
  }));
}

async function loadFactoryJobAddresses(): Promise<Address[]> {
  const factory = configuredFactory();
  const total = await readOne<bigint>(factory, JobFactoryAbi, "totalJobs");
  if (total === 0n) return [];

  // Fetch each job address individually (no multicall3 needed).
  return Promise.all(
    Array.from({ length: Number(total) }, (_, index) =>
      readOne<Address>(factory, JobFactoryAbi, "allJobs", [BigInt(index)]),
    ),
  );
}

export async function loadAllJobs(): Promise<JobChainSnapshot[]> {
  return loadSnapshots(await loadFactoryJobAddresses());
}

export async function loadJob(address: Address): Promise<JobChainSnapshot> {
  const [job] = await loadSnapshots([address]);
  if (job === undefined) throw new Error(`Job ${address} was not found`);
  return job;
}

export async function loadWorkerJobs(account: Address): Promise<JobChainSnapshot[]> {
  const factoryJobs = await loadFactoryJobAddresses();
  if (factoryJobs.length === 0) return [];

  const latestBlock = await publicClient.getBlockNumber();

  const acceptedJobs = (
    await Promise.all(
      factoryJobs.flatMap((address) =>
        blockRanges(GIWA_DEPLOYMENT_BLOCK, latestBlock, GIWA_LOG_CHUNK_SIZE).map(
          ([fromBlock, toBlock]) =>
            publicClient.getContractEvents({
              address: [address],
              abi: EscrowJobAbi,
              eventName: "JobAccepted",
              args: { worker: account },
              fromBlock,
              toBlock,
              strict: true,
            }),
        ),
      ),
    )
  ).flat();
  const factoryJobAddresses = new Set(factoryJobs.map((address) => address.toLowerCase()));
  const addresses = [
    ...new Map(
      acceptedJobs
        .filter((event) => factoryJobAddresses.has(event.address.toLowerCase()))
        .map((event) => [event.address.toLowerCase(), event.address]),
    ).values(),
  ];
  return loadSnapshots(addresses);
}
