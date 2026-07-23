import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

/**
 * ReputationRegistry design notes:
 * - Single source of truth for portable reputation.
 * - Only authorized callers (EscrowJob instances + Arbiter) can write.
 * - Anti-Sybil gate: every call that records reputation must check
 *   DojangScroll.isVerified(user, UPBIT_ATTESTER_ID) before mutating.
 *
 * Test strategy:
 * - Use viem's wallet.writeContract() with explicit account args to avoid
 *   shim wallet-binding flake.
 * - Use explicit try/catch for expected reverts because chai's
 *   `.rejected` matcher has timing issues with our shim's async wrapping.
 */
describe("ReputationRegistry", () => {
  const UPBIT_ATTESTER_ID =
    "0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034";

  async function deploy() {
    const [deployer, factoryWallet, worker, client] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const mockDojang = await hre.viem.deployContract("MockDojang");
    await mockDojang.write.setVerified([worker.account!.address, true]);
    await mockDojang.write.setVerified([client.account!.address, false]);

    const registry = await hre.viem.deployContract("ReputationRegistry", [
      mockDojang.address,
      deployer.account!.address,
      UPBIT_ATTESTER_ID,
    ]);

    return { registry, mockDojang, publicClient, deployer, factoryWallet, worker, client };
  }

  /** Asserts that `p` rejects. Throws the original error if it resolves. */
  async function expectRevert(p: Promise<unknown>): Promise<void> {
    try {
      await p;
    } catch (_) {
      return;
    }
    throw new Error("expected to revert, but resolved successfully");
  }

  describe("authorization", () => {
    it("non-authorized caller cannot write", async () => {
      const { registry, worker, factoryWallet } = await deploy();
      await expectRevert(
        factoryWallet.writeContract({
          address: registry.address,
          abi: registry.abi,
          functionName: "recordCompletion",
          args: [worker.account!.address, true],
          account: factoryWallet.account,
        } as any),
      );
    });
  });

  describe("Dojang gate", () => {
    it("authorized caller can record for Dojang-verified user", async () => {
      const { registry, worker, factoryWallet, publicClient } = await deploy();

      await registry.write.authorizeCaller([factoryWallet.account!.address]);

      const hash = await factoryWallet.writeContract({
        address: registry.address,
        abi: registry.abi,
        functionName: "recordCompletion",
        args: [worker.account!.address, true],
        account: factoryWallet.account,
      } as any);
      await publicClient.waitForTransactionReceipt({ hash });

      const rec = (await registry.read.records([worker.account!.address])) as readonly [
        bigint | number, bigint | number, bigint | number, bigint | number,
        bigint | number, bigint | number, bigint | number,
      ];
      expect(BigInt(rec[0])).to.equal(1n);
      expect(BigInt(rec[1])).to.equal(1n);
    });

    it("authorized caller CANNOT record for non-verified user", async () => {
      const { registry, client, factoryWallet } = await deploy();
      await registry.write.authorizeCaller([factoryWallet.account!.address]);
      await expectRevert(
        factoryWallet.writeContract({
          address: registry.address,
          abi: registry.abi,
          functionName: "recordCompletion",
          args: [client.account!.address, true],
          account: factoryWallet.account,
        } as any),
      );
    });
  });

  describe("reliability score", () => {
    it("returns 0 for unknown address", async () => {
      const { registry } = await deploy();
      const score = await registry.read.reliabilityScore([
        getAddress("0x000000000000000000000000000000000000dEaD"),
      ]);
      expect(score).to.equal(0n);
    });
  });
});
