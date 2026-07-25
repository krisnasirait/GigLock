import { useId, useState, useRef, type DragEvent } from "react";
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
  milestoneAmount,
  proofCid,
  proofHash,
  canSubmit,
  pending,
  onSubmit,
  onConfirmRelease,
  canConfirmRelease,
}: {
  milestoneTitle: string;
  milestoneAmount?: string;
  proofCid: string;
  proofHash: Hex;
  canSubmit: boolean;
  pending: boolean;
  onSubmit: (file: File) => Promise<void>;
  onConfirmRelease?: () => void;
  canConfirmRelease?: boolean;
}) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isDragging, setIsDragging] = useState(false);
  const [copiedField, setCopiedField] = useState<'cid' | 'hash' | null>(null);

  const hasProof = proofCid.length > 0;
  const gateway = hasProof ? gatewayForProof(proofCid) : undefined;

  function chooseFile(next: File | undefined) {
    if (next && next.size > MAX_IPFS_UPLOAD_BYTES) {
      setFile(undefined);
      setError("Evidence exceeds the maximum 10 MiB upload limit.");
      return;
    }
    setFile(next);
    setError(undefined);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) chooseFile(droppedFile);
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

  function copyText(text: string, type: 'cid' | 'hash') {
    navigator.clipboard.writeText(text);
    setCopiedField(type);
    setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <section className="mt-8 rounded-3xl border border-[#10b981]/25 bg-[#08130d] p-6 sm:p-8 shadow-xl shadow-black/40" aria-label={`Evidence for ${milestoneTitle}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#10b981]/15">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-[#10b981] tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-[#10b981]/15 border border-[#10b981]/25">
              {hasProof ? 'DELIVERABLE SUBMITTED' : 'SUBMIT WORK DELIVERABLE'}
            </span>
            {milestoneAmount && (
              <span className="text-xs font-bold text-[#34d399] font-mono">
                {milestoneAmount}
              </span>
            )}
          </div>
          <h3 className="text-xl font-black text-white">{milestoneTitle}</h3>
        </div>
        {hasProof ? (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#10b981]/15 border border-[#10b981]/30">
            <span className="size-2 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-xs font-bold text-[#34d399]">Recorded On-Chain</span>
          </div>
        ) : null}
      </div>

      {/* Recorded Proof Review (Client / Public View) */}
      {hasProof ? (
        <div className="mt-6 space-y-6">
          {/* IPFS Verification Banner */}
          <div className="rounded-2xl border border-[#10b981]/20 bg-[#06100a] p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="size-10 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#34d399] shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-0.5">Verified Deliverable on IPFS</h4>
                  <p className="text-xs text-white/50 leading-relaxed">
                    The worker has uploaded evidence for this milestone. Review the file via gateway below before releasing payment.
                  </p>
                </div>
              </div>
              {gateway ? (
                <a
                  href={gateway}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary text-xs py-2.5 px-5 shrink-0 flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  aria-label="Open evidence in IPFS gateway"
                >
                  <span>Open Evidence in IPFS Gateway</span>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              ) : (
                <span className="text-xs text-white/40 font-mono">Gateway unavailable for this CID.</span>
              )}
            </div>
          </div>

          {/* Technical Hashes */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* CID */}
            <div className="p-4 rounded-2xl bg-[#06100a] border border-[#10b981]/15 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#10b981] tracking-wider uppercase">IPFS Content Identifier (CID)</span>
                <button
                  type="button"
                  onClick={() => copyText(proofCid, 'cid')}
                  className="text-[10px] font-bold text-[#34d399] hover:underline"
                >
                  {copiedField === 'cid' ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
              <code className="text-xs font-mono text-white/90 break-all bg-black/40 p-2 rounded-lg border border-white/5">
                {proofCid}
              </code>
            </div>

            {/* Keccak-256 */}
            <div className="p-4 rounded-2xl bg-[#06100a] border border-[#10b981]/15 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#10b981] tracking-wider uppercase">Keccak-256 Proof Hash</span>
                <button
                  type="button"
                  onClick={() => copyText(proofHash, 'hash')}
                  className="text-[10px] font-bold text-[#34d399] hover:underline"
                >
                  {copiedField === 'hash' ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
              <code className="text-xs font-mono text-white/90 break-all bg-black/40 p-2 rounded-lg border border-white/5">
                {proofHash}
              </code>
            </div>
          </div>

          {/* Client Release Action Card */}
          {canConfirmRelease && onConfirmRelease && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0c2217] to-[#06120b] border border-[#10b981]/40 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-[#10b981]/10">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-sm font-bold text-white">Satisfied with the deliverable?</h4>
                <p className="text-xs text-white/60">
                  Confirming will release {milestoneAmount ?? ''} from escrow to the worker wallet.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary text-xs py-3 px-6 shrink-0 flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                disabled={pending}
                onClick={onConfirmRelease}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span>{pending ? "Confirming on GIWA..." : `Approve & Release ${milestoneAmount ?? 'Payment'}`}</span>
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Submission Dropzone (Worker View) */}
      {canSubmit ? (
        <div className="mt-6 space-y-5">
          <label htmlFor={inputId} className="sr-only">
            Evidence for {milestoneTitle}
          </label>
          <input
            id={inputId}
            ref={fileInputRef}
            type="file"
            className="hidden"
            disabled={pending}
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />

          {/* Drag & Drop Target */}
          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-[#10b981] bg-[#10b981]/15 scale-[1.01]'
                  : 'border-[#10b981]/30 hover:border-[#10b981]/60 bg-[#06100a] hover:bg-[#09180f]'
              }`}
            >
              <div className="size-14 rounded-2xl bg-[#10b981]/15 border border-[#10b981]/30 mx-auto flex items-center justify-center text-[#34d399] mb-4">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <p className="text-sm font-bold text-white mb-1">
                Drag and drop your deliverable file here
              </p>
              <p className="text-xs text-white/50 mb-3">
                or <span className="text-[#34d399] font-bold underline">click to browse</span> from your device
              </p>
              <div className="inline-flex items-center gap-2 text-[10px] text-white/40 bg-black/30 px-3 py-1 rounded-full border border-white/5">
                <span>Maximum file size: 10 MiB</span>
                <span>•</span>
                <span>PDF, ZIP, Images, IPFS bundles</span>
              </div>
            </div>
          ) : (
            /* Selected File Card */
            <div className="p-5 rounded-2xl bg-[#06100a] border border-[#10b981]/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="size-11 rounded-xl bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center text-[#34d399] shrink-0 font-bold">
                  📄
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate mb-0.5">{file.name}</p>
                  <p className="text-xs text-[#34d399] font-mono">{readableBytes(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => setFile(undefined)}
                className="text-xs font-bold text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 transition-all shrink-0"
              >
                Change File
              </button>
            </div>
          )}

          {error ? (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          ) : null}

          {/* Submission Button */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-white/40 max-w-sm">
              GigLock hashes the exact uploaded bytes and pins to IPFS before sending the transaction.
            </p>
            <button
              className="btn-primary text-xs py-3 px-6 flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
              type="button"
              disabled={!file || pending}
              onClick={() => void submit()}
            >
              {pending ? (
                <>
                  <span className="size-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Submitting to IPFS & Chain...</span>
                </>
              ) : (
                <>
                  <span>Upload & Submit Deliverable</span>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
