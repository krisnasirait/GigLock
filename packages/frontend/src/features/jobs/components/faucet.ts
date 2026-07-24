import { giwaSepolia } from "@giglock/shared/chains";
import type { Address, Hash } from "viem";

export const faucetKeys = {
  eligibility: (account: Address) => ["faucet", 91342, "eligibility", account] as const,
};

export type FaucetEligibility = {
  eligible: boolean;
  eligibleAt: bigint;
};

export function deriveFaucetEligibility(
  lastClaimedAt: bigint,
  cooldown: bigint,
  now: bigint,
): FaucetEligibility {
  const eligibleAt = lastClaimedAt + cooldown;
  return { eligible: now >= eligibleAt, eligibleAt };
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

function wasRejectedByUser(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("name" in error && (error as { name?: unknown }).name === "UserRejectedRequestError") ||
      ("code" in error && (error as { code?: unknown }).code === 4001))
  );
}

export function faucetErrorMessage(error: unknown): string {
  if (wasRejectedByUser(error)) return "You cancelled the faucet claim in your wallet.";
  if (messageOf(error).toLowerCase().includes("faucet: wait 24h between claims")) {
    return "This wallet has already claimed test USDC. Check the next claim time.";
  }
  return "The faucet could not reach GIWA Sepolia. Try again.";
}

export function faucetTransactionUrl(hash: Hash | string): string {
  return `${giwaSepolia.blockExplorers.default.url}/tx/${hash}`;
}
