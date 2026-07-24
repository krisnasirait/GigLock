import { keccak256 } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobMetadataV1 } from "./model.js";

vi.stubEnv("VITE_RELAYER_URL", "https://relayer.test/");

const { fetchJobMetadata, ipfsUrl, uploadEvidence, uploadJobMetadata } = await import("./ipfs.js");

const cid = "bafybeigdyrzt5sfp7udm7hu76rvv6igish4bntkyg5sw3m3wo4q";
const metadata: JobMetadataV1 = {
  schema: "giglock/job@1",
  title: "Build a polished landing page",
  description: "Create a responsive landing page with clear conversion paths.",
  skills: ["React", "TypeScript"],
  createdAt: "2026-07-24T00:00:00.000Z",
  milestones: [
    {
      title: "Design and implementation",
      description: "Deliver the approved responsive landing page implementation.",
      amountUsdc: "12.345678",
    },
  ],
};

const pinResult = {
  cid,
  url: "https://untrusted-relayer.example/ipfs/anything",
  size: 42,
  contentType: "application/json",
  key: "test/giglock-job.json",
};

describe("job IPFS client", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads validated metadata as the named JSON file", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(pinResult), { status: 200 }));

    const pin = await uploadJobMetadata(metadata);

    expect(fetchMock).toHaveBeenCalledWith("https://relayer.test/ipfs/pin", {
      method: "POST",
      body: expect.any(FormData),
    });
    const formData = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    const file = formData.get("file");
    expect(file).toBeInstanceOf(File);
    expect(file).toMatchObject({ name: "giglock-job.json", type: "application/json" });
    await expect((file as File).text()).resolves.toBe(JSON.stringify(metadata));
    expect(pin).toEqual({ ...pinResult, url: ipfsUrl(cid) });
  });

  it("returns a validated Filebase CID and raw-file Keccak-256 evidence hash", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(pinResult), { status: 200 }));
    const file = new File(["proof"], "delivery.txt", { type: "text/plain" });

    await expect(uploadEvidence(file)).resolves.toEqual({
      pin: { ...pinResult, url: ipfsUrl(cid) },
      proofHash: keccak256(new TextEncoder().encode("proof")),
    });
  });

  it("rejects evidence larger than the approved 10 MiB limit before upload", async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.bin");

    await expect(uploadEvidence(file)).rejects.toThrow("10 MiB");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("builds a gateway URL only from the configured gateway and a safe CID", () => {
    expect(ipfsUrl(cid)).toBe(`https://w3s.link/ipfs/${encodeURIComponent(cid)}`);
    expect(() => ipfsUrl("../private-key")).toThrow("Invalid IPFS CID");
  });

  it("rejects metadata responses over one MiB before parsing", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response("{}", {
        headers: { "content-length": String(1024 * 1024 + 1), "content-type": "application/json" },
      }),
    );

    await expect(fetchJobMetadata(cid, fetcher)).rejects.toThrow("1 MiB");
  });

  it("rejects streamed metadata bodies over one MiB when no length is advertised", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(new Uint8Array(1024 * 1024 + 1), {
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(fetchJobMetadata(cid, fetcher)).rejects.toThrow("1 MiB");
  });

  it("rejects non-JSON metadata responses", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response("not metadata", { headers: { "content-type": "text/html" } }),
      );

    await expect(fetchJobMetadata(cid, fetcher)).rejects.toThrow("JSON");
  });

  it("rejects malformed and wrong-version metadata documents", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ...metadata, schema: "giglock/job@2" }), {
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(fetchJobMetadata(cid, fetcher)).rejects.toThrow("Unsupported job metadata schema");
  });

  it("fetches and validates JSON metadata from the derived gateway URL", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(metadata), { headers: { "content-type": "application/json" } }),
      );

    await expect(fetchJobMetadata(cid, fetcher)).resolves.toEqual(metadata);
    expect(fetcher).toHaveBeenCalledWith(ipfsUrl(cid));
  });
});
