import { expect } from "chai";
import hre from "hardhat";

/**
 * JobFactory deploys EscrowJob instances and authorizes them on
 * ReputationRegistry. Uses viem's writeContract + try/catch for
 * expected reverts (matches the working ReputationRegistry test pattern).
 */
describe("JobFactory", () => {
  async function deployAll() {
    const [deployer, client, anyone] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const mockUsdc = await hre.viem.deployContract("MockUSDC", [deployer.account!.address]);

    const mockDojang = await hre.viem.deployContract("MockDojang");
    await mockDojang.write.setVerified([client.account!.address, true]);

    const registry = await hre.viem.deployContract("ReputationRegistry", [
      mockDojang.address,
      deployer.account!.address,
      "0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034",
    ]);

    const arbiter = await hre.viem.deployContract("Arbiter", [deployer.account!.address]);

    const factory = await hre.viem.deployContract("JobFactory", [
      mockUsdc.address,
      registry.address,
      arbiter.address,
    ]);

    // Wire factory on registry so factory can authorize new EscrowJobs.
    await registry.write.setFactory([factory.address]);

    return { mockUsdc, registry, arbiter, factory, client, anyone, publicClient, deployer };
  }

  it("createJob deploys an EscrowJob and authorizes it on the registry", async () => {
    const { factory, registry, client, publicClient } = await deployAll();
    const amount = 1_000_000n; // 1 USDC (6 decimals)

    const hash = await client.writeContract({
      address: factory.address,
      abi: factory.abi,
      functionName: "createJob",
      args: [[amount]],
      account: client.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash });

    // totalJobs incremented
    expect((await factory.read.totalJobs()) as bigint).to.equal(1n);

    // getJobsByClient returns the new job
    const jobs = (await factory.read.getJobsByClient([client.account!.address])) as `0x${string}`[];
    expect(jobs.length).to.equal(1);
    const jobAddr = jobs[0];

    // authorization check
    expect((await registry.read.authorizedCallers([jobAddr])) as boolean).to.equal(true);
  });

  it("reverts on empty milestones array", async () => {
    const { factory, client, publicClient } = await deployAll();
    let reverted = false;
    try {
      const hash = await client.writeContract({
        address: factory.address,
        abi: factory.abi,
        functionName: "createJob",
        args: [[]],
        account: client.account,
      } as any);
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (_) {
      reverted = true;
    }
    expect(reverted).to.equal(true);
  });
});
