import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { pickChain } from "@giglock/shared/chains";
import { createPublicClient, http } from "viem";

const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? "31337");
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "DEMO_PROJECT_ID";

export const activeChain = pickChain(chainId);
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
});

export const ACTIVE_CHAIN_ID = chainId;
