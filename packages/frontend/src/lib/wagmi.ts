import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { giwaSepolia } from "@giglock/shared/chains";

const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? "91342");
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "DEMO_PROJECT_ID";

export const wagmiConfig = getDefaultConfig({
  appName: "GigLock",
  projectId,
  chains: [giwaSepolia],
  ssr: false,
});

export const ACTIVE_CHAIN_ID = chainId;
