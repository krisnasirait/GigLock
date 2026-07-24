import { type Hex } from "viem";
import {
  hashProofKeccak,
  MAX_IPFS_UPLOAD_BYTES,
  uploadProof,
  type PinResult,
} from "../../lib/ipfs.js";
import { parseJobMetadata, serializeJobMetadata, type JobMetadataV1 } from "./model.js";

const MAX_METADATA_BYTES = 1024 * 1024;
const CID_V0_PATTERN = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
const CID_V1_BASE32_PATTERN = /^b[a-z2-7]{10,127}$/;

type MetadataFetcher = (input: string) => Promise<Response>;

function assertIpfsCid(cid: string): void {
  if (!CID_V0_PATTERN.test(cid) && !CID_V1_BASE32_PATTERN.test(cid)) {
    throw new Error("Invalid IPFS CID.");
  }
}

function configuredGatewayUrl(): URL {
  const configured = import.meta.env.VITE_IPFS_GATEWAY ?? "https://w3s.link/ipfs/";
  let gateway: URL;
  try {
    gateway = new URL(configured);
  } catch {
    throw new Error("VITE_IPFS_GATEWAY must be an absolute HTTP(S) URL.");
  }
  if (gateway.protocol !== "https:" && gateway.protocol !== "http:") {
    throw new Error("VITE_IPFS_GATEWAY must be an absolute HTTP(S) URL.");
  }

  gateway.search = "";
  gateway.hash = "";
  if (!gateway.pathname.endsWith("/")) gateway.pathname += "/";
  return gateway;
}

export function ipfsUrl(cid: string): string {
  assertIpfsCid(cid);
  return new URL(encodeURIComponent(cid), configuredGatewayUrl()).toString();
}

function normalizePin(pin: PinResult): PinResult {
  assertIpfsCid(pin.cid);
  return { ...pin, url: ipfsUrl(pin.cid) };
}

export async function uploadJobMetadata(metadata: JobMetadataV1): Promise<PinResult> {
  const serialized = serializeJobMetadata(metadata);
  const file = new File([serialized], "giglock-job.json", { type: "application/json" });
  return normalizePin(await uploadProof(file));
}

export async function uploadEvidence(file: File): Promise<{ pin: PinResult; proofHash: Hex }> {
  if (file.size > MAX_IPFS_UPLOAD_BYTES) {
    throw new Error("Evidence exceeds the approved 10 MiB upload limit.");
  }

  const [pin, proofHash] = await Promise.all([uploadProof(file), hashProofKeccak(file)]);
  return { pin: normalizePin(pin), proofHash };
}

async function readResponseBodyWithinLimit(response: Response): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > MAX_METADATA_BYTES) {
    throw new Error("IPFS metadata response exceeds the 1 MiB limit.");
  }

  if (response.body === null) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_METADATA_BYTES) {
      throw new Error("IPFS metadata response exceeds the 1 MiB limit.");
    }
    return new TextDecoder().decode(bytes);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_METADATA_BYTES) {
        await reader.cancel();
        throw new Error("IPFS metadata response exceeds the 1 MiB limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function fetchJobMetadata(
  cid: string,
  fetcher: MetadataFetcher = fetch,
): Promise<JobMetadataV1> {
  const response = await fetcher(ipfsUrl(cid));
  if (!response.ok) throw new Error(`IPFS metadata fetch failed: ${response.status}`);

  const contentType = response.headers.get("content-type") ?? "";
  if (!/^application\/json(?:;|$)/i.test(contentType)) {
    throw new Error("IPFS metadata response must be JSON.");
  }

  let value: unknown;
  try {
    value = JSON.parse(await readResponseBodyWithinLimit(response));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("IPFS metadata is not valid JSON.");
    throw error;
  }
  return parseJobMetadata(value);
}
