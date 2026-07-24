import { z } from "zod";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Required to boot the Fastify server. No secrets here.
 */
const bootSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  ALLOWED_ORIGINS: z.string().default(""),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(60),
});

/**
 * Required to relay transactions. Optional at boot — validated lazily
 * by the meta-tx route so `/health` works in CI and tests without one.
 */
const runtimeSchema = z.object({
  RELAYER_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
  RPC_URL: z.string().url().optional(),
  CHAIN_ID: z.coerce.number().int().positive().optional(),
  MINIMAL_FORWARDER_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),

  // Filebase (IPFS pinning via S3-compatible API). Optional until /ipfs/pin is hit.
  FILEBASE_ACCESS_KEY_ID: z.string().optional(),
  FILEBASE_SECRET_ACCESS_KEY: z.string().optional(),
  FILEBASE_BUCKET: z.string().optional(),
  FILEBASE_ENDPOINT: z.string().url().default("https://s3.filebase.io"),
  FILEBASE_REGION: z.string().default("us-east-1"),
  IPFS_GATEWAY: z.string().url().default("https://ipfs.filebase.io/ipfs/"),
  IPFS_MAX_FILE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
});

export type BootConfig = z.infer<typeof bootSchema>;
export type RuntimeConfig = z.infer<typeof runtimeSchema>;
export type RelayerConfig = BootConfig & RuntimeConfig;

export function loadBootConfig(overrides: Partial<BootConfig> = {}): BootConfig {
  const raw = {
    PORT: process.env.PORT,
    HOST: process.env.HOST,
    LOG_LEVEL: process.env.LOG_LEVEL,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    RATE_LIMIT_PER_MIN: process.env.RATE_LIMIT_PER_MIN,
    ...overrides,
  };
  return bootSchema.parse(raw);
}

export function loadRuntimeConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  const raw = {
    RELAYER_PRIVATE_KEY: process.env.RELAYER_PRIVATE_KEY,
    RPC_URL: process.env.RPC_URL,
    CHAIN_ID: process.env.CHAIN_ID,
    MINIMAL_FORWARDER_ADDRESS: process.env.MINIMAL_FORWARDER_ADDRESS,
    FILEBASE_ACCESS_KEY_ID: process.env.FILEBASE_ACCESS_KEY_ID,
    FILEBASE_SECRET_ACCESS_KEY: process.env.FILEBASE_SECRET_ACCESS_KEY,
    FILEBASE_BUCKET: process.env.FILEBASE_BUCKET,
    FILEBASE_ENDPOINT: process.env.FILEBASE_ENDPOINT,
    FILEBASE_REGION: process.env.FILEBASE_REGION,
    IPFS_GATEWAY: process.env.IPFS_GATEWAY,
    IPFS_MAX_FILE_BYTES: process.env.IPFS_MAX_FILE_BYTES,
    ...overrides,
  };
  return runtimeSchema.parse(raw);
}

export function loadConfig(overrides: Partial<RelayerConfig> = {}): RelayerConfig {
  return { ...loadRuntimeConfig(overrides), ...loadBootConfig(overrides) };
}

/**
 * Throws a descriptive error if transaction-relay runtime config is incomplete.
 * Call from the /meta-tx route handler before submitting.
 */
export function assertRuntimeReady(
  cfg: RuntimeConfig,
): asserts cfg is RuntimeConfig & {
  RELAYER_PRIVATE_KEY: string;
  RPC_URL: string;
  CHAIN_ID: number;
  MINIMAL_FORWARDER_ADDRESS: string;
} {
  const missing: string[] = [];
  if (!cfg.RELAYER_PRIVATE_KEY) missing.push("RELAYER_PRIVATE_KEY");
  if (!cfg.RPC_URL) missing.push("RPC_URL");
  if (!cfg.CHAIN_ID) missing.push("CHAIN_ID");
  if (!cfg.MINIMAL_FORWARDER_ADDRESS) missing.push("MINIMAL_FORWARDER_ADDRESS");
  if (missing.length > 0) {
    throw new Error(`relayer runtime config missing: ${missing.join(", ")}`);
  }
}

/**
 * Throws if Filebase config is incomplete. Call from the /ipfs/pin route.
 */
export function assertFilebaseReady(
  cfg: RuntimeConfig,
): asserts cfg is RuntimeConfig & {
  FILEBASE_ACCESS_KEY_ID: string;
  FILEBASE_SECRET_ACCESS_KEY: string;
  FILEBASE_BUCKET: string;
} {
  const missing: string[] = [];
  if (!cfg.FILEBASE_ACCESS_KEY_ID) missing.push("FILEBASE_ACCESS_KEY_ID");
  if (!cfg.FILEBASE_SECRET_ACCESS_KEY) missing.push("FILEBASE_SECRET_ACCESS_KEY");
  if (!cfg.FILEBASE_BUCKET) missing.push("FILEBASE_BUCKET");
  if (missing.length > 0) {
    throw new Error(`filebase config missing: ${missing.join(", ")}`);
  }
}
