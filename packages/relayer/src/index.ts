import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { loadBootConfig, type BootConfig } from "./config.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerIpfsRoutes } from "./routes/ipfs.js";

export async function buildApp(overrides: Partial<BootConfig> = {}): Promise<FastifyInstance> {
  const cfg = loadBootConfig(overrides);
  const app = Fastify({
    logger: { level: cfg.LOG_LEVEL },
    // 25 MiB cap on the raw multipart payload (Filebase max is 10 MiB by config).
    bodyLimit: 26 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: cfg.ALLOWED_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    // /ipfs/pin needs credentials / multipart headers exposed to the browser
    // when the frontend is hosted on a different origin.
    allowedHeaders: ["content-type", "authorization"],
  });

  // Multipart support for /ipfs/pin.
  await app.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024, // 25 MiB; the route enforces a stricter 10 MiB.
      files: 1,
    },
  });

  await registerHealthRoutes(app);
  await registerIpfsRoutes(app);
  // Future: registerMetaTxRoutes(app), registerNonceRoutes(app)

  return app;
}

async function main() {
  const app = await buildApp();
  const cfg = loadBootConfig();
  try {
    await app.listen({ port: cfg.PORT, host: cfg.HOST });
    app.log.info(`giglock-relayer listening on ${cfg.HOST}:${cfg.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Run main only when invoked directly (not when imported by tests).
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("index.ts") ||
  process.argv[1]?.endsWith("index.js");

if (isMain) {
  main();
}
