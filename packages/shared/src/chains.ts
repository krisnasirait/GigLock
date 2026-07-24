import { defineChain } from "viem";

/**
 * GIWA Sepolia testnet chain definition.
 * Mirrors viem's built-in `giwaSepolia` with our canonical RPC + explorer URLs.
 */
export const giwaSepolia = defineChain({
  id: 91342,
  name: "GIWA Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://sepolia-rpc.giwa.io"],
      webSocket: undefined,
    },
  },
  blockExplorers: {
    default: {
      name: "GIWA Explorer",
      url: "https://sepolia-explorer.giwa.io",
    },
  },
  testnet: true,
});

/**
 * Local Hardhat node (chainId 31337) — for development.
 * The seed deployer wallet already has 10000 ETH; no faucet needed.
 */
export const hardhatLocal = defineChain({
  id: 31337,
  name: "Hardhat Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
      webSocket: undefined,
    },
  },
  blockExplorers: {
    default: { name: "none", url: "" },
  },
  testnet: true,
});

/**
 * Pick the chain by numeric id. Used by the frontend's wagmi config.
 *
 * @example
 *   pickChain(91342) // → giwaSepolia
 *   pickChain(31337) // → hardhatLocal
 */
export function pickChain(chainId: number) {
  switch (chainId) {
    case 31337:
      return hardhatLocal;
    case 91342:
    default:
      return giwaSepolia;
  }
}

/**
 * Flashblocks-enabled RPC for faster preconfirmation reads (testnet only).
 */
export const giwaFlashblocksRpc = "https://sepolia-rpc-flashblocks.giwa.io";

/**
 * Explorer API endpoint (Blockscout-compatible).
 */
export const giwaExplorerApi = "https://sepolia-explorer.giwa.io/api";
