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
  jobFactory: "0xb01fDC7B8df1A5E4f7F843046f734C6fD622DDFF",
  reputationRegistry: "0xE8BCF79C93d40565DdCFaAE4bA3d9a24C7dC8B6E",
  arbiter: "0xEC61bf4e000B72B8a4f94556B608e03673Df629E",
  minimalForwarder: "0x0000000000000000000000000000000000000000",
  mockUsdc: "0xf5d40D37cA17eC7e5a2e4Ae170e4deF0e57B99eb",
  mockUsdcFaucet: "0xc04f1831C8821a5eff267c6cB4D7e6ba847b5A9b",
  dojangScroll: SEPOLIA_DOJANG_CONTRACTS.dojangScroll,
};

/**
 * In-memory runtime registry. Replace by a network fetch when indexer is live.
 */
export const addressesByChain: Record<number, ChainAddresses> = {
  [91342]: GIWA_SEPOLIA_ADDRESSES,
};
