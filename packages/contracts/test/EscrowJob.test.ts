import { expect } from "chai";
import hre from "hardhat";
import { parseUnits } from "viem";

/**
 * EscrowJob — full state-machine test.
 * Deploys minimal helpers and exercises every public function.
 */
describe("EscrowJob", () => {
  async function setup() {
    const [deployer, clientWallet, workerWallet, admin] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const mockUsdc = await hre.viem.deployContract("MockUSDC", [deployer.account!.address]);
    const mockDojang = await hre.viem.deployContract("MockDojang");
    await mockDojang.write.setVerified([clientWallet.account!.address, true]);
    await mockDojang.write.setVerified([workerWallet.account!.address, true]);

    const registry = await hre.viem.deployContract("ReputationRegistry", [
      mockDojang.address,
      deployer.account!.address,
      "0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034",
    ]);
    const arbiter = await hre.viem.deployContract("Arbiter", [admin.account!.address]);
    const factory = await hre.viem.deployContract("JobFactory", [
      mockUsdc.address,
      registry.address,
      arbiter.address,
    ]);
    await registry.write.setFactory([factory.address]);

    // Fund the client with USDC so they can fund the job
    await mockUsdc.write.mint([clientWallet.account!.address, parseUnits("1000", 6)]);

    // Create a 2-milestone job: $100, $50 (6 decimals)
    const createHash = await clientWallet.writeContract({
      address: factory.address,
      abi: factory.abi,
      functionName: "createJob",
      args: [[parseUnits("100", 6), parseUnits("50", 6)]],
      account: clientWallet.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: createHash });

    const jobs = (await factory.read.getJobsByClient([clientWallet.account!.address])) as `0x${string}`[];
    const jobAddr = jobs[0];

    return {
      mockUsdc, registry, arbiter, factory,
      client: clientWallet, worker: workerWallet, admin, deployer,
      jobAddr, publicClient,
    };
  }

  async function expectRevert(p: Promise<unknown>): Promise<void> {
    try { await p; } catch (_) { return; }
    throw new Error("expected revert, got success");
  }

  it("creates a job in Created status", async () => {
    const { jobAddr } = await setup();
    const job = await hre.viem.getContractAt("EscrowJob", jobAddr);
    expect((await job.read.status()) as number).to.equal(0); // Created
  });

  it("client funds job → status Funded", async () => {
    const { jobAddr, mockUsdc, client, publicClient } = await setup();
    const job = await hre.viem.getContractAt("EscrowJob", jobAddr);
    const total = parseUnits("150", 6);

    // Approve via the client's wallet
    const approveHash = await client.writeContract({
      address: mockUsdc.address,
      abi: mockUsdc.abi,
      functionName: "approve",
      args: [jobAddr, total],
      account: client.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });

    const fundHash = await client.writeContract({
      address: job.address,
      abi: job.abi,
      functionName: "fundJob",
      args: [],
      account: client.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: fundHash });

    expect((await job.read.status()) as number).to.equal(1); // Funded
    expect((await mockUsdc.read.balanceOf([jobAddr])) as bigint).to.equal(total);
  });

  it("worker accepts → status InProgress", async () => {
    const { jobAddr, mockUsdc, client, worker, publicClient } = await setup();
    const job = await hre.viem.getContractAt("EscrowJob", jobAddr);
    const total = parseUnits("150", 6);

    const approveHash = await client.writeContract({
      address: mockUsdc.address, abi: mockUsdc.abi,
      functionName: "approve", args: [jobAddr, total],
      account: client.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    const fundHash = await client.writeContract({
      address: job.address, abi: job.abi,
      functionName: "fundJob", args: [],
      account: client.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: fundHash });
    const acceptHash = await worker.writeContract({
      address: job.address, abi: job.abi,
      functionName: "acceptJob", args: [],
      account: worker.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: acceptHash });

    expect((await job.read.status()) as number).to.equal(2); // InProgress
    const w = (await job.read.worker()) as string;
    expect(w.toLowerCase()).to.equal(worker.account!.address.toLowerCase());
  });

  it("submit + confirm releases milestone funds", async () => {
    const { jobAddr, mockUsdc, client, worker, publicClient } = await setup();
    const job = await hre.viem.getContractAt("EscrowJob", jobAddr);
    const total = parseUnits("150", 6);
    const milestone0Amount = parseUnits("100", 6);

    // Fund + accept
    let h = await client.writeContract({
      address: mockUsdc.address, abi: mockUsdc.abi,
      functionName: "approve", args: [jobAddr, total],
      account: client.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: h });
    h = await client.writeContract({
      address: job.address, abi: job.abi,
      functionName: "fundJob", args: [],
      account: client.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: h });
    h = await worker.writeContract({
      address: job.address, abi: job.abi,
      functionName: "acceptJob", args: [],
      account: worker.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: h });

    // Submit milestone 0
    h = await worker.writeContract({
      address: job.address, abi: job.abi,
      functionName: "submitMilestone",
      args: [0n, ("0x" + "11".repeat(32)) as `0x${string}`],
      account: worker.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: h });

    // Confirm milestone 0
    h = await client.writeContract({
      address: job.address, abi: job.abi,
      functionName: "confirmMilestone", args: [0n],
      account: client.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: h });

    expect((await mockUsdc.read.balanceOf([worker.account!.address])) as bigint).to.equal(milestone0Amount);
  });

  it("submit + raiseDispute transitions to Disputed", async () => {
    const { jobAddr, mockUsdc, client, worker, publicClient } = await setup();
    const job = await hre.viem.getContractAt("EscrowJob", jobAddr);
    const total = parseUnits("150", 6);

    let h = await client.writeContract({
      address: mockUsdc.address, abi: mockUsdc.abi,
      functionName: "approve", args: [jobAddr, total],
      account: client.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: h });
    h = await client.writeContract({
      address: job.address, abi: job.abi,
      functionName: "fundJob", args: [],
      account: client.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: h });
    h = await worker.writeContract({
      address: job.address, abi: job.abi,
      functionName: "acceptJob", args: [],
      account: worker.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: h });
    h = await worker.writeContract({
      address: job.address, abi: job.abi,
      functionName: "submitMilestone",
      args: [0n, ("0x" + "22".repeat(32)) as `0x${string}`],
      account: worker.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: h });
    h = await client.writeContract({
      address: job.address, abi: job.abi,
      functionName: "raiseDispute", args: [0n],
      account: client.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: h });

    // milestone status should be Disputed (3)
    const m0 = (await job.read.milestones([0n])) as readonly [bigint, number, `0x${string}`, bigint, bigint];
    expect(m0[1]).to.equal(3);
  });

  it("rejects submit before worker accepts", async () => {
    const { jobAddr, worker, publicClient } = await setup();
    const job = await hre.viem.getContractAt("EscrowJob", jobAddr);

    await expectRevert(
      worker.writeContract({
        address: job.address, abi: job.abi,
        functionName: "submitMilestone",
        args: [0n, ("0x" + "33".repeat(32)) as `0x${string}`],
        account: worker.account,
      } as any).then((h: any) => publicClient.waitForTransactionReceipt({ hash: h })),
    );
  });
});
