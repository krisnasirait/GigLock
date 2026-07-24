/**
 * Frontend helper for IPFS proof uploads.
 *
 * The frontend never talks to Filebase directly — credentials live on the
 * relayer (a backend that proxies + pays for the pin). This helper uploads
 * a single File via multipart to the relayer's /ipfs/pin route and returns
 * the IPFS CID + gateway URL.
 *
 * Configure with VITE_RELAYER_URL (env).
 */
import { keccak256 } from "viem";

const relayerUrl = (import.meta.env.VITE_RELAYER_URL ?? "").replace(/\/+$/, "");

export type PinResult = {
  cid: string;
  url: string;
  size: number;
  contentType: string;
  key: string;
};

/**
 * Upload a file to the relayer, which pins it to IPFS via Filebase.
 * Returns the IPFS CID and a public gateway URL.
 *
 * Throws if the relayer URL is not configured, the file is empty, or the
 * upload fails (4xx/5xx from the relayer).
 */
export async function uploadProof(file: File): Promise<PinResult> {
  if (!relayerUrl) {
    throw new Error(
      "VITE_RELAYER_URL is not set. Configure it in packages/frontend/.env.local.",
    );
  }
  if (file.size === 0) {
    throw new Error("File is empty.");
  }

  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${relayerUrl}/ipfs/pin`, {
    method: "POST",
    body: fd,
    // Note: do NOT set `Content-Type` here — the browser sets it correctly
    // for multipart (with the boundary).
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      detail = body?.error ? ` (${body.code ?? ""} ${body.error})` : "";
    } catch {
      /* non-JSON error */
    }
    throw new Error(`IPFS pin failed: ${res.status}${detail}`);
  }

  return (await res.json()) as PinResult;
}

/**
 * Compute keccak256(file) → bytes32 hex. Used as the on-chain `proofHash`
 * argument to `submitMilestone(...)`. Matches the contract's expectation.
 */
export async function hashProofKeccak(file: File): Promise<`0x${string}`> {
  const buf = new Uint8Array(await file.arrayBuffer());
  return keccak256(buf);
}

/**
 * Compute SHA-256(file) → hex. Useful as a cheaper secondary fingerprint
 * (e.g., to display in the UI before submitting on-chain). NOT what the
 * contract stores — use `hashProofKeccak` for that.
 */
export async function hashProofSha256(file: File): Promise<`0x${string}`> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return ("0x" + hex) as `0x${string}`;
}
