import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { loadBootConfig, type BootConfig } from "./config.js";
import { registerHealthRoutes } from "./routes/health.js";

export async function buildApp(overrides: Partial<BootConfig> = {}): Promise<FastifyInstance> {
  const cfg = loadBootConfig(overrides);
  const app = Fastify({
    logger: { level: cfg.LOG_LEVEL },
  });

  await app.register(cors, {
    origin: cfg.ALLOWED_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  });

  await registerHealthRoutes(app);
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
