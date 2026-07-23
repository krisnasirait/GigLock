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
    ...overrides,
  };
  return runtimeSchema.parse(raw);
}

export function loadConfig(overrides: Partial<RelayerConfig> = {}): RelayerConfig {
  return { ...loadRuntimeConfig(overrides), ...loadBootConfig(overrides) };
}

/**
 * Throws a descriptive error if runtime config is incomplete.
 * Call from the meta-tx route handler before submitting.
 */
export function assertRuntimeReady(cfg: RuntimeConfig): asserts cfg is Required<RuntimeConfig> {
  const missing: string[] = [];
  if (!cfg.RELAYER_PRIVATE_KEY) missing.push("RELAYER_PRIVATE_KEY");
  if (!cfg.RPC_URL) missing.push("RPC_URL");
  if (!cfg.CHAIN_ID) missing.push("CHAIN_ID");
  if (!cfg.MINIMAL_FORWARDER_ADDRESS) missing.push("MINIMAL_FORWARDER_ADDRESS");
  if (missing.length > 0) {
    throw new Error(`relayer runtime config missing: ${missing.join(", ")}`);
  }
}
