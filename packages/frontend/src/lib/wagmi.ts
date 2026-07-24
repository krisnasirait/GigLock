import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { pickChain } from "@giglock/shared/chains";

const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? "31337");
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "DEMO_PROJECT_ID";

const chain = pickChain(chainId);

export const wagmiConfig = getDefaultConfig({
  appName: "GigLock",
  projectId,
  chains: [chain],
  ssr: false,
});

export const ACTIVE_CHAIN_ID = chainId;
