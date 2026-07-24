import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { GIWA_SEPOLIA_CHAIN_ID } from "../../../lib/chainConfig.js";

export { GIWA_SEPOLIA_CHAIN_ID } from "../../../lib/chainConfig.js";

export function useWalletWriteAccess() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  return {
    address,
    isConnected,
    chainId,
    canWrite: isConnected && chainId === GIWA_SEPOLIA_CHAIN_ID,
  };
}

export function WalletGate() {
  const { isConnected, chainId } = useWalletWriteAccess();
  const { openConnectModal } = useConnectModal();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <section className="dashboard-gate" aria-label="Wallet status">
        <div>
          <p className="dashboard-gate-title">Wallet not connected</p>
          <p>Connect a wallet to claim test USDC or post a job.</p>
        </div>
        <button className="btn-primary dashboard-action" type="button" onClick={openConnectModal}>
          Connect wallet
        </button>
      </section>
    );
  }

  if (chainId !== GIWA_SEPOLIA_CHAIN_ID) {
    return (
      <section className="dashboard-gate dashboard-gate-warning" aria-label="Wallet network">
        <div>
          <p className="dashboard-gate-title">Wrong network</p>
          <p>Switch to GIWA Sepolia to use wallet actions. Job listings remain available.</p>
        </div>
        <button
          className="btn-primary dashboard-action"
          type="button"
          onClick={() => switchChain({ chainId: GIWA_SEPOLIA_CHAIN_ID })}
        >
          Switch to GIWA Sepolia
        </button>
      </section>
    );
  }

  return (
    <section className="dashboard-gate dashboard-gate-ready" aria-label="Wallet network">
      <div>
        <p className="dashboard-gate-title">GIWA Sepolia connected</p>
        <p>Wallet actions are ready. Testnet balances and confirmations update from chain receipts.</p>
      </div>
    </section>
  );
}
