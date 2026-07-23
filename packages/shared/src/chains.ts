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
 * Flashblocks-enabled RPC for faster preconfirmation reads.
 */
export const giwaFlashblocksRpc = "https://sepolia-rpc-flashblocks.giwa.io";

/**
 * Explorer API endpoint (Blockscout-compatible).
 */
export const giwaExplorerApi = "https://sepolia-explorer.giwa.io/api";
