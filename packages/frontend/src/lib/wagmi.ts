import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { giwaSepolia } from "@giglock/shared/chains";
import { createPublicClient, http } from "viem";
import { resolveDashboardChainId } from "./chainConfig.js";

const chainId = resolveDashboardChainId(import.meta.env.VITE_CHAIN_ID);
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "DEMO_PROJECT_ID";

export const activeChain = giwaSepolia;
const rpcUrl =
  import.meta.env.VITE_GIWA_RPC_URL ?? activeChain.rpcUrls.default.http[0];

export const wagmiConfig = getDefaultConfig({
  appName: "GigLock",
  projectId,
  chains: [activeChain],
  ssr: false,
});

export const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(rpcUrl),
  batch: { multicall: false },
});

export const ACTIVE_CHAIN_ID = chainId;
