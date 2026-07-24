import { useId, useState } from "react";
import type { Hex } from "viem";
import { MAX_IPFS_UPLOAD_BYTES } from "../../../lib/ipfs.js";
import { ipfsUrl } from "../ipfs.js";

function readableBytes(size: number): string {
  return `${(size / 1024 / 1024).toFixed(size >= 1024 * 1024 ? 2 : 1)} MiB`;
}

function gatewayForProof(cid: string): string | undefined {
  try {
    return ipfsUrl(cid);
  } catch {
    return undefined;
  }
}

export function EvidencePanel({
  milestoneTitle,
  proofCid,
  proofHash,
  canSubmit,
  pending,
  onSubmit,
}: {
  milestoneTitle: string;
  proofCid: string;
  proofHash: Hex;
  canSubmit: boolean;
  pending: boolean;
  onSubmit: (file: File) => Promise<void>;
}) {
  const inputId = useId();
  const [file, setFile] = useState<File | undefined>();
  const [error, setError] = useState<string | undefined>();

  const hasProof = proofCid.length > 0;
  const gateway = hasProof ? gatewayForProof(proofCid) : undefined;

  function chooseFile(next: File | undefined) {
    if (next && next.size > MAX_IPFS_UPLOAD_BYTES) {
      setFile(undefined);
      setError("Evidence exceeds the approved 10 MiB upload limit.");
      return;
    }
    setFile(next);
    setError(undefined);
  }

  async function submit() {
    if (!file || pending) return;
    setError(undefined);
    try {
      await onSubmit(file);
      setFile(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Evidence could not be submitted.");
    }
  }

  return (
    <section className="evidence-panel" aria-label={`Evidence for ${milestoneTitle}`}>
      <div className="evidence-panel-heading">
        <div>
          <p>Delivery evidence</p>
          <h3>{milestoneTitle}</h3>
        </div>
        {hasProof ? <span className="evidence-state">Recorded on-chain</span> : null}
      </div>
      {hasProof ? (
        <dl className="evidence-record">
          <div><dt>CID</dt><dd><code>{proofCid}</code></dd></div>
          <div><dt>Keccak-256</dt><dd><code>{proofHash}</code></dd></div>
          <div><dt>Gateway</dt><dd>{gateway ? <a href={gateway} target="_blank" rel="noreferrer" aria-label="Open evidence in IPFS gateway">Open evidence in IPFS gateway</a> : "Gateway unavailable for this CID."}</dd></div>
        </dl>
      ) : null}
      {canSubmit ? (
        <div className="evidence-upload">
          <label htmlFor={inputId}>Evidence for {milestoneTitle}</label>
          <input id={inputId} type="file" disabled={pending} onChange={(event) => chooseFile(event.target.files?.[0])} />
          <p>Maximum file size: 10 MiB. GigLock hashes the exact uploaded bytes before the wallet request.</p>
          {file ? <p className="evidence-file" role="status">{file.name} · {readableBytes(file.size)}</p> : null}
          {error ? <p className="evidence-error" role="alert">{error}</p> : null}
          <button className="btn-primary" type="button" disabled={!file || pending} onClick={() => void submit()}>
            {pending ? "Submitting evidence…" : "Submit evidence"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
