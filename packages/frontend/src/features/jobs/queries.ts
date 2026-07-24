import { EscrowJobAbi, JobFactoryAbi, addressesByChain } from "@giglock/shared";
import { type Address } from "viem";
import { ACTIVE_CHAIN_ID, publicClient } from "../../lib/wagmi.js";
import { fetchJobMetadata } from "./ipfs.js";
import type { JobMetadataV1, MilestoneTuple } from "./model.js";

const jobsKeyPrefix = ["jobs", ACTIVE_CHAIN_ID] as const;
const JOB_EVENT_ADDRESS_BATCH_SIZE = 100;

export const jobsKeys = {
  all: jobsKeyPrefix,
  detail: (address: Address) => [...jobsKeyPrefix, "detail", address] as const,
  balances: (account: Address) => [...jobsKeyPrefix, "balances", account] as const,
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

function addressBatches(addresses: Address[]): Address[][] {
  const batches: Address[][] = [];
  for (let index = 0; index < addresses.length; index += JOB_EVENT_ADDRESS_BATCH_SIZE) {
    batches.push(addresses.slice(index, index + JOB_EVENT_ADDRESS_BATCH_SIZE));
  }
  return batches;
}

async function loadSnapshots(addresses: Address[]): Promise<JobChainSnapshot[]> {
  if (addresses.length === 0) return [];

  const baseReads = addresses.flatMap((address) => [
    { address, abi: EscrowJobAbi, functionName: "status" } as const,
    { address, abi: EscrowJobAbi, functionName: "client" } as const,
    { address, abi: EscrowJobAbi, functionName: "worker" } as const,
    { address, abi: EscrowJobAbi, functionName: "totalAmount" } as const,
    { address, abi: EscrowJobAbi, functionName: "metadataCid" } as const,
    { address, abi: EscrowJobAbi, functionName: "milestoneCount" } as const,
  ]);
  const baseResults = await publicClient.multicall({ contracts: baseReads, allowFailure: false });

  const onChain = addresses.map((address, index) => {
    const offset = index * 6;
    return {
      address,
      status: Number(baseResults[offset]),
      client: baseResults[offset + 1] as Address,
      worker: baseResults[offset + 2] as Address,
      totalAmount: baseResults[offset + 3] as bigint,
      metadataCid: baseResults[offset + 4] as string,
      milestoneCount: Number(baseResults[offset + 5]),
    };
  });
  const milestoneReads = onChain.flatMap(({ address, milestoneCount }) =>
    Array.from(
      { length: milestoneCount },
      (_, milestoneId) =>
        ({
          address,
          abi: EscrowJobAbi,
          functionName: "milestones",
          args: [BigInt(milestoneId)],
        }) as const,
    ),
  );
  const milestoneResults =
    milestoneReads.length === 0
      ? []
      : await publicClient.multicall({ contracts: milestoneReads, allowFailure: false });

  let milestoneOffset = 0;
  const metadataResults = await Promise.all(
    onChain.map(async ({ metadataCid }) => {
      try {
        return { metadata: await fetchJobMetadata(metadataCid) };
      } catch (error) {
        return { metadataError: errorMessage(error) };
      }
    }),
  );

  return onChain.map((job, index) => {
    const milestones = milestoneResults.slice(
      milestoneOffset,
      milestoneOffset + job.milestoneCount,
    ) as MilestoneTuple[];
    milestoneOffset += job.milestoneCount;
    return { ...job, milestones, ...metadataResults[index] };
  });
}

async function loadFactoryJobAddresses(): Promise<Address[]> {
  const factory = configuredFactory();
  const total = await publicClient.readContract({
    address: factory,
    abi: JobFactoryAbi,
    functionName: "totalJobs",
  });
  if (total === 0n) return [];

  return (await publicClient.multicall({
    contracts: Array.from(
      { length: Number(total) },
      (_, index) =>
        ({
          address: factory,
          abi: JobFactoryAbi,
          functionName: "allJobs",
          args: [BigInt(index)],
        }) as const,
    ),
    allowFailure: false,
  })) as Address[];
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

  const acceptedJobs = (
    await Promise.all(
      addressBatches(factoryJobs).map((address) =>
        publicClient.getContractEvents({
          address,
          abi: EscrowJobAbi,
          eventName: "JobAccepted",
          args: { worker: account },
          strict: true,
        }),
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
