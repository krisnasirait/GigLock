import { defineConfig } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY ?? "0x" + "0".repeat(64);
const GIWA_SEPOLIA_RPC_URL =
  process.env.GIWA_SEPOLIA_RPC_URL ?? "https://sepolia-rpc.giwa.io";

export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainId: 31337,
    },
    giwaSepolia: {
      type: "http",
      chainType: "op",
      chainId: 91342,
      url: GIWA_SEPOLIA_RPC_URL,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
  },
  // Block explorer verification (Blockscout-compatible) is wired in a
  // follow-up plan via @nomicfoundation/hardhat-verify. The default HH3
  // config shape does not expose a top-level blockExplorers field, so
  // we defer the explorer wiring until verification is actually used.
});
