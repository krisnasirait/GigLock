import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  encodeEventTopics,
  type Address,
  type Hash,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { EscrowJobAbi, JobFactoryAbi } from "@giglock/shared";

vi.mock("../../lib/wagmi.js", () => ({
  ACTIVE_CHAIN_ID: 91342,
  publicClient: {
    getBlockNumber: vi.fn(),
    getContractEvents: vi.fn(),
    multicall: vi.fn(),
    readContract: vi.fn(),
  },
}));

import { jobsKeys, loadWorkerJobs } from "./queries.js";
import {
  decodeCreatedJobAddress,
  invalidateJobQueries,
  nextCreateStep,
  runCreate,
  runFund,
} from "./transactions.js";
import { publicClient } from "../../lib/wagmi.js";

const factory = "0x1111111111111111111111111111111111111111" as Address;
const job = "0x2222222222222222222222222222222222222222" as Address;
const account = "0x3333333333333333333333333333333333333333" as Address;
const otherFactory = "0x4444444444444444444444444444444444444444" as Address;
type TestReceipt = TransactionReceipt;
function testReceipt(value: object): TestReceipt {
  return value as TestReceipt;
}
const chain = publicClient as unknown as {
  getBlockNumber: ReturnType<typeof vi.fn>;
  getContractEvents: ReturnType<typeof vi.fn>;
  multicall: ReturnType<typeof vi.fn>;
  readContract: ReturnType<typeof vi.fn>;
};

describe("job transaction workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resumes creation without creating a second job", () => {
    expect(nextCreateStep({ metadataCid: "bafy", jobAddress: undefined, allowance: 0n }, 5n)).toBe(
      "create",
    );
    expect(nextCreateStep({ metadataCid: "bafy", jobAddress: job, allowance: 0n }, 5n)).toBe(
      "approve",
    );
    expect(nextCreateStep({ metadataCid: "bafy", jobAddress: job, allowance: 5n }, 5n)).toBe(
      "fund",
    );
  });

  it("decodes JobCreated only from the configured factory receipt log", () => {
    const topics = encodeEventTopics({
      abi: JobFactoryAbi,
      eventName: "JobCreated",
      args: { jobContract: job, client: account },
    }) as [Hex, ...Hex[]];
    const data = ("0x" +
      BigInt(5).toString(16).padStart(64, "0") +
      BigInt(64).toString(16).padStart(64, "0") +
      BigInt(4).toString(16).padStart(64, "0") +
      "6261667900000000000000000000000000000000000000000000000000000000") as Hex;

    expect(
      decodeCreatedJobAddress(
        testReceipt({
          logs: [
            { address: otherFactory, topics, data },
            { address: factory, topics, data },
          ],
        }),
        factory,
      ),
    ).toBe(job);
  });

  it("fails when a create receipt does not contain its factory JobCreated event", () => {
    expect(() => decodeCreatedJobAddress(testReceipt({ logs: [] }), factory)).toThrow("JobCreated");
  });

  it("invalidates only the job and affected account balance cache keys", () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    void invalidateJobQueries({ invalidateQueries }, { jobAddress: job, accounts: [account] });

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: jobsKeys.all,
      exact: true,
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: jobsKeys.detail(job), exact: true });
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, { queryKey: jobsKeys.balances(account), exact: true });
  });

  it("keeps unrelated detail and balance entries valid in the real query cache", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(jobsKeys.all, "all jobs");
    queryClient.setQueryData(jobsKeys.detail(job), "target job");
    queryClient.setQueryData(jobsKeys.detail(otherFactory), "other job");
    queryClient.setQueryData(jobsKeys.balances(account), "target balance");
    queryClient.setQueryData(jobsKeys.balances(otherFactory), "other balance");

    await invalidateJobQueries(queryClient, { jobAddress: job, accounts: [account] });

    expect(queryClient.getQueryState(jobsKeys.all)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(jobsKeys.detail(job))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(jobsKeys.balances(account))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(jobsKeys.detail(otherFactory))?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(jobsKeys.balances(otherFactory))?.isInvalidated).toBe(false);
  });

  it("invalidates exact worker-list keys without touching another worker's jobs", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(jobsKeys.worker(account), "accepted job");
    queryClient.setQueryData(jobsKeys.worker(otherFactory), "other worker job");

    await invalidateJobQueries(queryClient, { workers: [account] });

    expect(queryClient.getQueryState(jobsKeys.worker(account))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(jobsKeys.worker(otherFactory))?.isInvalidated).toBe(false);
  });

  it("does not report creation success before its receipt is confirmed", async () => {
    let resolveReceipt: (receipt: TestReceipt) => void;
    const waitForReceipt = vi.fn(
      () =>
        new Promise<TestReceipt>((resolve) => {
          resolveReceipt = resolve;
        }),
    );
    const writeContract = vi.fn().mockResolvedValue("0xabc" as Hash);

    const pending = runCreate({
      writeContract,
      waitForReceipt,
      request: {
        address: factory,
        abi: JobFactoryAbi,
        functionName: "createJob",
        args: [[5n], "bafy"],
      },
      factory,
    });

    await Promise.resolve();
    expect(waitForReceipt).toHaveBeenCalledWith({ hash: "0xabc" });

    const receipt = testReceipt({
      status: "success",
      logs: [
        {
          address: factory,
          topics: encodeEventTopics({
            abi: JobFactoryAbi,
            eventName: "JobCreated",
            args: { jobContract: job, client: account },
          }) as [Hex, ...Hex[]],
          data: ("0x" +
            BigInt(5).toString(16).padStart(64, "0") +
            BigInt(64).toString(16).padStart(64, "0") +
            BigInt(4).toString(16).padStart(64, "0") +
            "6261667900000000000000000000000000000000000000000000000000000000") as Hex,
        },
      ],
    });
    resolveReceipt!(receipt);

    await expect(pending).resolves.toMatchObject({ hash: "0xabc", jobAddress: job });
  });

  it("does not advance a write workflow after a reverted receipt", async () => {
    await expect(
      runFund({
        writeContract: vi.fn().mockResolvedValue("0xabc" as Hash),
        waitForReceipt: vi.fn().mockResolvedValue(testReceipt({ logs: [], status: "reverted" })),
        request: { address: job },
      }),
    ).rejects.toThrow("successful");
  });

  it("does not advance a write workflow when a receipt has no success status", async () => {
    await expect(
      runFund({
        writeContract: vi.fn().mockResolvedValue("0xabc" as Hash),
        waitForReceipt: vi.fn().mockResolvedValue(testReceipt({ logs: [] })),
        request: { address: job },
      }),
    ).rejects.toThrow("successful");
  });

  it("accepts a viem receipt waiter whose receipt contains a LOG0", async () => {
    const waitForReceipt = async (): Promise<TransactionReceipt> =>
      ({
        status: "success",
        logs: [{ address: job, data: "0x", topics: [] }],
      }) as unknown as TransactionReceipt;

    await expect(
      runFund({
        writeContract: vi.fn().mockResolvedValue("0xabc" as Hash),
        waitForReceipt,
        request: { address: job },
      }),
    ).resolves.toMatchObject({ hash: "0xabc" });
  });

  it("hydrates only factory-authorized worker events", async () => {
    // readContract is called for: totalJobs (1n), allJobs[0] (job address),
    // then per-job: status, client, worker, totalAmount, metadataCid, milestoneCount
    chain.readContract
      .mockResolvedValueOnce(1n)          // totalJobs → 1 job
      .mockResolvedValueOnce(job)         // allJobs[0] → job address
      .mockResolvedValueOnce(2n)          // status
      .mockResolvedValueOnce(factory)     // client
      .mockResolvedValueOnce(account)     // worker
      .mockResolvedValueOnce(5n)          // totalAmount
      .mockResolvedValueOnce("not-a-valid-cid") // metadataCid
      .mockResolvedValueOnce(0n);         // milestoneCount
    chain.getBlockNumber.mockResolvedValue(31_555_952n);
    chain.getContractEvents.mockResolvedValue([{ address: job }, { address: otherFactory }]);

    await expect(loadWorkerJobs(account)).resolves.toMatchObject([
      { address: job, worker: account },
    ]);
    expect(chain.getContractEvents).toHaveBeenCalledTimes(1);
    expect(chain.getContractEvents).toHaveBeenCalledWith({
      address: [job],
      abi: EscrowJobAbi,
      eventName: "JobAccepted",
      args: { worker: account },
      strict: true,
      fromBlock: 31_554_719n,
      toBlock: 31_555_952n,
    });
    // Verify we used individual readContract calls, NOT multicall
    expect(chain.multicall).not.toHaveBeenCalled();
    expect(chain.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "status", address: job }),
    );
    expect(chain.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "worker", address: job }),
    );
  });
});
