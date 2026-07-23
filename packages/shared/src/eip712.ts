import type { Address } from "viem";

/**
 * EIP-712 domain for the MinimalForwarder contract.
 * The forwarder's domain is dynamic — `verifyingContract` is set to the
 * deployed MinimalForwarder address; `chainId` matches the chain where
 * it lives. Both the frontend signer and the relayer verifier import
 * this from the same module so a mismatch is impossible.
 */
export const forwarderDomain = (chainId: number, verifyingContract: Address) =>
  ({
    name: "GigLockMinimalForwarder",
    version: "1",
    chainId,
    verifyingContract,
  }) as const;

/**
 * EIP-712 typed-data shape for `MinimalForwarder.forwarder.execute(...)`.
 * Mirrors OpenZeppelin's MinimalForwarder:
 *   struct ForwardRequest {
 *     address from; address to; uint256 value; uint256 gas; uint256 nonce; bytes data;
 *   }
 * and the EIP-712 type string:
 *   "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
 */
export const FORWARD_REQUEST_TYPES = {
  ForwardRequest: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "data", type: "bytes" },
  ],
} as const;

export type ForwardRequest = {
  from: Address;
  to: Address;
  value: bigint;
  gas: bigint;
  nonce: bigint;
  data: `0x${string}`;
};
