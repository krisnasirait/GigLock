import type { FastifyInstance } from "fastify";
import { loadRuntimeConfig, assertFilebaseReady } from "../config.js";
import { pinBuffer } from "../services/filebase.js";

/**
 * IPFS pinning routes — backs the frontend's proof-of-completion uploads.
 *
 *   POST /ipfs/pin   multipart/form-data, field "file"
 *
 * Response 200: { cid, url, size, contentType, key }
 * Response 4xx: { error: string, code: string }
 *
 * Auth model: caller-facing only; the route trusts MetaMask signatures
 * (handled by the meta-tx route layer above this). For MVP we do NOT
 * gate this route — anyone can pin a small file via the relayer. Add an
 * API-key header or rate limiter before mainnet.
 */
export async function registerIpfsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/ipfs/pin", async (req, reply) => {
    const cfg = loadRuntimeConfig();
    try {
      assertFilebaseReady(cfg);
    } catch (e: any) {
      return reply.code(503).send({ error: e.message, code: "FILEBASE_NOT_CONFIGURED" });
    }

    // @fastify/multipart registers req.file() on multipart requests.
    const file = await (req as any).file?.().catch(() => null);
    if (!file) {
      return reply.code(400).send({ error: "missing file field", code: "NO_FILE" });
    }

    const buf = await file.toBuffer();
    if (buf.length === 0) {
      return reply.code(400).send({ error: "empty file", code: "EMPTY_FILE" });
    }
    const max = cfg.IPFS_MAX_FILE_BYTES ?? 10 * 1024 * 1024;
    if (buf.length > max) {
      return reply.code(413).send({ error: `file too large; max ${max} bytes`, code: "FILE_TOO_LARGE" });
    }

    const filename = file.filename ?? "upload.bin";
    const contentType = file.mimetype ?? "application/octet-stream";

    try {
      const result = await pinBuffer(cfg, buf, { filename, contentType });
      return reply.send(result);
    } catch (e: any) {
      req.log.error({ err: e }, "filebase pin failed");
      return reply.code(502).send({ error: "pin failed", code: "PIN_FAILED" });
    }
  });
}
