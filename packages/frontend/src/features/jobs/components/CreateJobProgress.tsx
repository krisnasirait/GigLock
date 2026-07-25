import type { Hash } from "viem";
import { giwaSepolia } from "@giglock/shared/chains";

export type CreateStage = "idle" | "metadata" | "create" | "approve" | "fund" | "complete" | "error";

type CreateJobProgressProps = {
  stage: CreateStage;
  hashes: Partial<Record<"create" | "approve" | "fund", Hash>>;
  error?: string;
  detail?: string;
};

const stages: Array<{ id: CreateStage; label: string }> = [
  { id: "metadata", label: "Metadata" },
  { id: "create", label: "Create" },
  { id: "approve", label: "Approve" },
  { id: "fund", label: "Fund" },
];

function transactionUrl(hash: Hash): string {
  return `${giwaSepolia.blockExplorers.default.url}/tx/${hash}`;
}

export function CreateJobProgress({ stage, hashes, error, detail }: CreateJobProgressProps) {
  if (stage === "idle" && !hashes.create && !hashes.approve && !hashes.fund && !error && !detail) {
    return null;
  }

  const currentIndex = stages.findIndex(({ id }) => id === stage);

  return (
    <section
      className="card-glass border border-[#3b82f6]/20 mt-6 rounded-2xl p-6 sm:p-7 shadow-xl shadow-[#3b82f6]/5 relative overflow-hidden"
      aria-label="Create escrow progress"
      aria-live="polite"
    >
      {/* Background glow accent */}
      <div className="absolute -right-16 -top-16 size-48 rounded-full bg-[#3b82f6]/10 blur-3xl pointer-events-none" />

      <ol className="flex items-center justify-between gap-2 mb-6 relative z-10">
        {stages.map(({ id, label }, index) => {
          const isComplete = stage === "complete" || (currentIndex !== -1 && index < currentIndex);
          const isCurrent = index === currentIndex;

          return (
            <li
              key={id}
              className={`flex-1 flex flex-col items-center gap-2 relative ${
                isComplete ? "text-cyan-400" : isCurrent ? "text-white" : "text-white/30"
              }`}
            >
              <div
                className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  isComplete
                    ? "bg-[#10b981] text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                    : isCurrent
                    ? "bg-[#3b82f6] text-white ring-4 ring-[#3b82f6]/30 shadow-[0_0_15px_rgba(59,130,246,0.6)]"
                    : "bg-white/5 border border-white/10 text-white/40"
                }`}
              >
                {isComplete ? (
                  <svg className="w-4 h-4 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span className="text-xs font-semibold tracking-wide uppercase">{label}</span>
            </li>
          );
        })}
      </ol>

      {/* Explorer Links */}
      {(hashes.create || hashes.approve || hashes.fund) && (
        <div className="flex flex-wrap gap-3 mb-4 pt-4 border-t border-white/10 text-xs">
          {hashes.create && (
            <a
              href={transactionUrl(hashes.create)}
              target="_blank"
              rel="noreferrer"
              aria-label="View create transaction on GIWA Explorer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-cyan-300 hover:text-white hover:bg-[#3b82f6]/20 transition-all"
            >
              <span>View create transaction on GIWA Explorer</span>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}
          {hashes.approve && (
            <a
              href={transactionUrl(hashes.approve)}
              target="_blank"
              rel="noreferrer"
              aria-label="View approval transaction on GIWA Explorer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 text-purple-300 hover:text-white hover:bg-[#8b5cf6]/20 transition-all"
            >
              <span>View approval transaction on GIWA Explorer</span>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}
          {hashes.fund && (
            <a
              href={transactionUrl(hashes.fund)}
              target="_blank"
              rel="noreferrer"
              aria-label="View funding transaction on GIWA Explorer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10b981]/10 border border-[#10b981]/30 text-emerald-300 hover:text-white hover:bg-[#10b981]/20 transition-all"
            >
              <span>View funding transaction on GIWA Explorer</span>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}
        </div>
      )}

      {detail && <p className="text-sm text-cyan-200/90 leading-relaxed">{detail}</p>}
      {error && <p className="text-sm text-red-400 font-medium leading-relaxed mt-2" role="alert">{error}</p>}
    </section>
  );
}
