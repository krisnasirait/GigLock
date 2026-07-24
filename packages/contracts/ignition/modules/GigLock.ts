import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Ordered deployment module for GigLock.
 *
 * Order:
 *  1. MockUSDC + Faucet
 *  2. Arbiter (admin = deployer)
 *  3. ReputationRegistry (Dojang gate)
 *  4. JobFactory (with registry, arbiter, token)
 *  5. Wire registry.setFactory(factory)
 */
export default buildModule("GigLock", (m) => {
  const deployer = m.getAccount(0);

  const mockUsdc = m.contract("MockUSDC", [deployer]);
  const faucet = m.contract("MockUSDCFaucet", [mockUsdc, deployer]);

  const arbiter = m.contract("Arbiter", [deployer]);

  const upbitAttesterId =
    "0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034";
  const dojangScroll = "0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9";

  const registry = m.contract("ReputationRegistry", [
    dojangScroll,
    deployer, // placeholder factory; replaced after JobFactory deploy
    upbitAttesterId,
  ]);

  const factory = m.contract("JobFactory", [mockUsdc, registry, arbiter]);

  // Final wiring: tell the registry who the factory is.
  m.call(registry, "setFactory", [factory], { id: "setFactory" });

  return { mockUsdc, faucet, arbiter, registry, factory };
});
