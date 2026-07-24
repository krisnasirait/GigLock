import { describe, expect, it, vi } from "vitest";
import { encodeEventTopics, type Address, type Hash, type Hex } from "viem";
import { JobFactoryAbi } from "@giglock/shared";
import { jobsKeys } from "./queries.js";
import {
  decodeCreatedJobAddress,
  invalidateJobQueries,
  nextCreateStep,
  runCreate,
  runFund,
} from "./transactions.js";

const factory = "0x1111111111111111111111111111111111111111" as Address;
const job = "0x2222222222222222222222222222222222222222" as Address;
const account = "0x3333333333333333333333333333333333333333" as Address;
const otherFactory = "0x4444444444444444444444444444444444444444" as Address;
type TestReceipt = {
  logs: Array<{ address: Address; topics: [Hex, ...Hex[]]; data: Hex }>;
};

describe("job transaction workflows", () => {
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
        {
          logs: [
            { address: otherFactory, topics, data },
            { address: factory, topics, data },
          ],
        },
        factory,
      ),
    ).toBe(job);
  });

  it("fails when a create receipt does not contain its factory JobCreated event", () => {
    expect(() => decodeCreatedJobAddress({ logs: [] }, factory)).toThrow("JobCreated");
  });

  it("invalidates only the job and affected account balance cache keys", () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    void invalidateJobQueries({ invalidateQueries }, { jobAddress: job, accounts: [account] });

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: jobsKeys.all });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: jobsKeys.detail(job) });
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, { queryKey: jobsKeys.balances(account) });
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

    const receipt: TestReceipt = {
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
    };
    resolveReceipt!(receipt);

    await expect(pending).resolves.toMatchObject({ hash: "0xabc", jobAddress: job });
  });

  it("does not advance a write workflow after a reverted receipt", async () => {
    await expect(
      runFund({
        writeContract: vi.fn().mockResolvedValue("0xabc" as Hash),
        waitForReceipt: vi.fn().mockResolvedValue({ logs: [], status: "reverted" }),
        request: { address: job },
      }),
    ).rejects.toThrow("reverted");
  });
});
