import { expect } from "chai";
import hre from "hardhat";

describe("Arbiter", () => {
  async function deploy() {
    const [deployer, admin, worker, anyone] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();
    const arbiter = await hre.viem.deployContract("Arbiter", [admin.account!.address]);
    return { arbiter, publicClient, deployer, admin, worker, anyone };
  }

  it("sets admin correctly", async () => {
    const { arbiter, admin } = await deploy();
    // viem returns checksummed addresses; compare without case sensitivity
    expect(((await arbiter.read.admin()) as string).toLowerCase()).to.equal(
      admin.account!.address.toLowerCase(),
    );
  });

  it("non-admin cannot decide", async () => {
    const { arbiter, anyone, publicClient } = await deploy();
    let reverted = false;
    try {
      const hash = await anyone.writeContract({
        address: arbiter.address,
        abi: arbiter.abi,
        functionName: "decide",
        args: [0n, true],
        account: anyone.account,
      } as any);
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (_) {
      reverted = true;
    }
    expect(reverted).to.equal(true);
  });

  it("anyone can file a dispute; caseCount increments", async () => {
    const { arbiter, worker, publicClient } = await deploy();
    const hash = await worker.writeContract({
      address: arbiter.address,
      abi: arbiter.abi,
      functionName: "fileDispute",
      args: [0n],
      account: worker.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash });
    expect((await arbiter.read.caseCount()) as bigint).to.equal(1n);
  });

  it("admin decide fails when case.jobContract is not a real EscrowJob (acceptable: outer revert)", async () => {
    const { arbiter, admin, worker, publicClient } = await deploy();
    // File a dispute from worker (won't be a real EscrowJob, but that's OK for the admin-gate test)
    const fileHash = await worker.writeContract({
      address: arbiter.address,
      abi: arbiter.abi,
      functionName: "fileDispute",
      args: [0n],
      account: worker.account,
    } as any);
    await publicClient.waitForTransactionReceipt({ hash: fileHash });

    // decide() will pass the admin check but the inner EscrowJob call reverts.
    let reverted = false;
    try {
      const hash = await admin.writeContract({
        address: arbiter.address,
        abi: arbiter.abi,
        functionName: "decide",
        args: [0n, true],
        account: admin.account,
      } as any);
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (_) {
      reverted = true;
    }
    expect(reverted).to.equal(true);
  });
});
