import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Hoist the mock state so vi.mock's hoisted factory can close over it.
const { mockSend, MockS3Client } = vi.hoisted(() => {
  const mockSend = vi.fn();
  const MockS3Client = vi.fn().mockImplementation(function () {
    return { send: mockSend };
  });
  return { mockSend, MockS3Client };
});

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: MockS3Client,
  PutObjectCommand: class { constructor(public input: any) {} },
  HeadObjectCommand: class { constructor(public input: any) {} },
}));

// Import AFTER the mock is set up.
import { buildApp } from "../src/index.js";
import { resetFilebaseClient } from "../src/services/filebase.js";

function makeMultipart(body: Buffer, filename: string, contentType: string) {
  // Build a real multipart/form-data payload.
  const boundary = "----test" + Date.now();
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    body: Buffer.concat([head, body, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
    payload: body,
  };
}

async function buildAppWithFilebase() {
  process.env.FILEBASE_ACCESS_KEY_ID = "AKIA-TEST-KEY";
  process.env.FILEBASE_SECRET_ACCESS_KEY = "test-secret-32-chars-xxxxxxxxxxxxxx";
  process.env.FILEBASE_BUCKET = "giglock-test";
  return await buildApp();
}

describe("POST /ipfs/pin", () => {
  beforeEach(() => {
    mockSend.mockReset();
    resetFilebaseClient();
  });
  afterEach(() => {
    delete process.env.FILEBASE_ACCESS_KEY_ID;
    delete process.env.FILEBASE_SECRET_ACCESS_KEY;
    delete process.env.FILEBASE_BUCKET;
  });

  it("returns 503 when filebase env is not set", async () => {
    const app = await buildApp();
    // Filebase env vars are NOT set in this test.
    const mp = makeMultipart(Buffer.from("hello"), "hi.txt", "text/plain");
    const res = await app.inject({
      method: "POST",
      url: "/ipfs/pin",
      headers: { "content-type": mp.contentType },
      payload: mp.body,
    });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ code: "FILEBASE_NOT_CONFIGURED" });
    await app.close();
  });

  it("pins file and returns CID + URL on success", async () => {
    mockSend
      .mockResolvedValueOnce({}) // PutObjectCommand
      .mockResolvedValueOnce({
        Metadata: { cid: "QmTestCid1234567890abcdef" },
      });

    const app = await buildAppWithFilebase();
    const mp = makeMultipart(Buffer.from("hello, ipfs!"), "greeting.txt", "text/plain");

    const res = await app.inject({
      method: "POST",
      url: "/ipfs/pin",
      headers: { "content-type": mp.contentType },
      payload: mp.body,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.cid).toBe("QmTestCid1234567890abcdef");
    expect(body.url).toMatch(/ipfs\/QmTestCid1234567890abcdef/);
    expect(body.size).toBe(mp.payload.length);
    expect(body.contentType).toBe("text/plain");
    expect(mockSend).toHaveBeenCalledTimes(2);
    await app.close();
  });

  it("returns 400 when no file field is provided", async () => {
    const app = await buildAppWithFilebase();
    const boundary = "----test" + Date.now();
    const body = Buffer.from(`--${boundary}--\r\n`);

    const res = await app.inject({
      method: "POST",
      url: "/ipfs/pin",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: "NO_FILE" });
    await app.close();
  });

  it("returns 502 if the Filebase pin call fails", async () => {
    mockSend.mockRejectedValueOnce(new Error("network down"));
    const app = await buildAppWithFilebase();
    const mp = makeMultipart(Buffer.from("oops"), "x.bin", "application/octet-stream");

    const res = await app.inject({
      method: "POST",
      url: "/ipfs/pin",
      headers: { "content-type": mp.contentType },
      payload: mp.body,
    });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ code: "PIN_FAILED" });
    await app.close();
  });
});
