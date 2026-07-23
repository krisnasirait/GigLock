import { describe, it, expect } from "vitest";
import { buildApp } from "../src/index.js";

describe("GET /health", () => {
  it("returns { ok: true, service: 'giglock-relayer' }", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, service: "giglock-relayer" });
    await app.close();
  });
});
