import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import type { RuntimeConfig } from "../config.js";

/**
 * Filebase pinning via the S3-compatible API.
 *
 * Filebase is an IPFS pinning service that exposes an S3-compatible API at
 * https://s3.filebase.io. Anything PUT to a bucket is automatically pinned
 * to IPFS; the CID is returned in the HeadObject response under
 * `x-amz-meta-cid` (Filebase-specific metadata header).
 *
 * Credentials are sourced from runtime config (FILEBASE_* env vars).
 * They MUST NOT be hardcoded or committed to source.
 */

let cachedClient: S3Client | undefined;
let cachedClientKey: string | undefined;

type RequiredFilebaseCreds = {
  FILEBASE_ACCESS_KEY_ID: string;
  FILEBASE_SECRET_ACCESS_KEY: string;
};
type FilebaseClientCfg = RequiredFilebaseCreds & {
  FILEBASE_ENDPOINT: string;
  FILEBASE_REGION: string;
};

function clientFor(cfg: FilebaseClientCfg): S3Client {
  // Reuse the client across requests; rebuild only if credentials or endpoint change.
  const key = `${cfg.FILEBASE_ENDPOINT}|${cfg.FILEBASE_REGION}|${cfg.FILEBASE_ACCESS_KEY_ID}`;
  if (cachedClient && cachedClientKey === key) return cachedClient;

  cachedClient = new S3Client({
    endpoint: cfg.FILEBASE_ENDPOINT,
    region: cfg.FILEBASE_REGION,
    // Filebase ignores SigV4 differences — credentials alone identify the bucket.
    forcePathStyle: true,
    credentials: {
      accessKeyId: cfg.FILEBASE_ACCESS_KEY_ID,
      secretAccessKey: cfg.FILEBASE_SECRET_ACCESS_KEY,
    },
  });
  cachedClientKey = key;
  return cachedClient;
}

/** Reset the cached client (used by tests when mocking). */
export function resetFilebaseClient() {
  cachedClient = undefined;
  cachedClientKey = undefined;
}

export type PinResult = {
  cid: string;
  url: string;
  size: number;
  contentType: string;
  key: string;
};

/**
 * Upload a buffer to Filebase via the S3-compatible API and return the IPFS CID.
 *
 * @param cfg    runtime config (must already have Filebase fields populated).
 * @param body   raw bytes to upload.
 * @param opts   filename + contentType.
 */
export async function pinBuffer(
  cfg: RuntimeConfig,
  body: Buffer | Uint8Array,
  opts: { filename: string; contentType: string },
): Promise<PinResult> {
  if (!cfg.FILEBASE_ACCESS_KEY_ID || !cfg.FILEBASE_SECRET_ACCESS_KEY || !cfg.FILEBASE_BUCKET) {
    throw new Error("filebase config missing");
  }

  const s3 = clientFor({
    FILEBASE_ACCESS_KEY_ID: cfg.FILEBASE_ACCESS_KEY_ID,
    FILEBASE_SECRET_ACCESS_KEY: cfg.FILEBASE_SECRET_ACCESS_KEY,
    FILEBASE_ENDPOINT: cfg.FILEBASE_ENDPOINT,
    FILEBASE_REGION: cfg.FILEBASE_REGION,
  });

  // Safe filename: avoid path traversal, force a content-addressed key.
  const safeName = opts.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "file";
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  const buf = body instanceof Uint8Array ? Buffer.from(body) : body;

  await s3.send(new PutObjectCommand({
    Bucket: cfg.FILEBASE_BUCKET,
    Key: key,
    Body: buf,
    ContentType: opts.contentType,
  }));

  // HeadObject to read Filebase's CID metadata header.
  const head = await s3.send(new HeadObjectCommand({
    Bucket: cfg.FILEBASE_BUCKET,
    Key: key,
  }));

  // Filebase stores the CID in x-amz-meta-cid (returned as `cid` here).
  const cid = (head.Metadata?.cid ??
    head.Metadata?.["x-amz-meta-cid"] ??
    null) as string | null;
  if (!cid) {
    throw new Error(
      "Filebase did not return a CID in HeadObject metadata. " +
      "Ensure the bucket has IPFS pinning enabled (Settings → Pinning → IPFS).",
    );
  }

  const gateway = (cfg.IPFS_GATEWAY ?? "https://ipfs.filebase.io/ipfs/").replace(/\/?$/, "/");
  return {
    cid,
    url: `${gateway}${cid}`,
    size: buf.length,
    contentType: opts.contentType,
    key,
  };
}
