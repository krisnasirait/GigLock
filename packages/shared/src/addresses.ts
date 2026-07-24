import type { Address } from "viem";

/**
 * Deployed contract addresses keyed by chainId.
 * Populated by the Ignition deploy step; the sepolia entries below
 * are testnet fixtures referenced by the frontend and relayer.
 *
 * Once Ignition deploys, run `pnpm --filter @giglock/contracts run write-addresses`
 * to overwrite this file with the real deployment outputs.
 */
export type ChainAddresses = {
  jobFactory: Address;
  reputationRegistry: Address;
  arbiter: Address;
  minimalForwarder: Address;
  mockUsdc: Address;
  mockUsdcFaucet: Address;
  dojangScroll: Address;
};

export const SEPOLIA_DOJANG_CONTRACTS = {
  dojangScroll: "0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9" as Address,
  upbitAttesterId:
    "0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034" as `0x${string}`,
};

/**
 * Placeholder addresses used until the first deploy runs.
 * All zero addresses — UI guards against reading from these.
 */
export const PLACEHOLDER_ADDRESSES: ChainAddresses = {
  jobFactory: "0x0000000000000000000000000000000000000000",
  reputationRegistry: "0x0000000000000000000000000000000000000000",
  arbiter: "0x0000000000000000000000000000000000000000",
  minimalForwarder: "0x0000000000000000000000000000000000000000",
  mockUsdc: "0x0000000000000000000000000000000000000000",
  mockUsdcFaucet: "0x0000000000000000000000000000000000000000",
  dojangScroll: SEPOLIA_DOJANG_CONTRACTS.dojangScroll,
};

export const GIWA_SEPOLIA_ADDRESSES: ChainAddresses = {
  jobFactory: "0x34Cb4E2D1791fC1eD51F4DEf4171129903976113",
  reputationRegistry: "0xfA172Bd33BdDD43CDe5436184b65A5586C7387dF",
  arbiter: "0xF9404775587261aD5eA698bc9A1496C39E2Df3c5",
  minimalForwarder: "0x0000000000000000000000000000000000000000",
  mockUsdc: "0xE85931C270e358b182e64eE83d00524658a375Cf",
  mockUsdcFaucet: "0x10CfE424F4c7079aD5346F55c96723aBC4aeC50f",
  dojangScroll: SEPOLIA_DOJANG_CONTRACTS.dojangScroll,
};

/**
 * In-memory runtime registry. Replace by a network fetch when indexer is live.
 */
export const addressesByChain: Record<number, ChainAddresses> = {
  [91342]: GIWA_SEPOLIA_ADDRESSES,
};
