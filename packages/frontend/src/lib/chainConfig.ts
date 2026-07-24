export const GIWA_SEPOLIA_CHAIN_ID = 91342;

export function resolveDashboardChainId(configuredChainId: string | undefined): number {
  if (configuredChainId === undefined || configuredChainId === "" || configuredChainId === "91342") {
    return GIWA_SEPOLIA_CHAIN_ID;
  }

  throw new Error(
    `GigLock dashboard only supports GIWA Sepolia (chain ${GIWA_SEPOLIA_CHAIN_ID}); received VITE_CHAIN_ID=${configuredChainId}.`,
  );
}
