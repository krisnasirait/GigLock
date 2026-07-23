import { expect } from "chai";
import hre from "hardhat";
import { parseUnits } from "viem";

/**
 * MockUSDC design notes:
 * - `decimals()` is overridden to 6 (matches real USDC, not the OZ default of 18).
 * - `mint` is intentionally permissionless: this is a test-only mock, and
 *   the Faucet contract is the only thing that calls it in practice
 *   (rate-limited). Adding Ownable here would create a chicken-and-egg
 *   ownership problem with the Faucet.
 */
describe("MockUSDC", () => {
  async function deploy() {
    const [deployer, user] = await hre.viem.getWalletClients();
    // Constructor takes initialOwner; we pass the deployer wallet address.
    const mockUSDC = await hre.viem.deployContract("MockUSDC", [deployer.account!.address]);
    // Constructor takes (tokenAddress, initialOwner).
    const faucet = await hre.viem.deployContract("MockUSDCFaucet", [
      mockUSDC.address,
      deployer.account!.address,
    ]);
    return { mockUSDC, faucet, deployer, user };
  }

  it("has 6 decimals, name MockUSDC, symbol USDC", async () => {
    const { mockUSDC } = await deploy();
    expect(await mockUSDC.read.name()).to.equal("MockUSDC");
    expect(await mockUSDC.read.symbol()).to.equal("USDC");
    expect(await mockUSDC.read.decimals()).to.equal(6);
  });

  it("mint is permissionless (any address can mint)", async () => {
    const { mockUSDC, user } = await deploy();
    const mintAmount = parseUnits("1000", 6);

    // Call mint from the user wallet (not owner) — should succeed.
    const mockUSDCAsUser = await hre.viem.getContractAt(
      "MockUSDC",
      mockUSDC.address,
      { client: { wallet: user } },
    );
    await mockUSDCAsUser.write.mint([user.account!.address, mintAmount]);
    expect(await mockUSDC.read.balanceOf([user.account!.address])).to.equal(mintAmount);
  });

  it("faucet mints 1000 USDC to caller once per 24h per address", async () => {
    const { faucet, mockUSDC, user } = await deploy();
    const faucetAsUser = await hre.viem.getContractAt(
      "MockUSDCFaucet",
      faucet.address,
      { client: { wallet: user } },
    );

    const initialBalance = await mockUSDC.read.balanceOf([user.account!.address]);
    await faucetAsUser.write.claim();
    const afterFirst = await mockUSDC.read.balanceOf([user.account!.address]);
    expect(afterFirst - initialBalance).to.equal(parseUnits("1000", 6));

    // Second claim in the same block must revert (cooldown).
    await expect(faucetAsUser.write.claim()).to.be.rejectedWith(/cooldown|24h|wait/i);
  });
});
