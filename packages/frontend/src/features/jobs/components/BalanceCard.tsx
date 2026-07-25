import type { ReactNode } from "react";

type BalanceCardProps = {
  label: string;
  value: string;
  detail: ReactNode;
  isLoading?: boolean;
  error?: string;
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
};

export function BalanceCard({
  label,
  value,
  detail,
  isLoading = false,
  error,
  action,
}: BalanceCardProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#08130d] border border-[#10b981]/20 shadow-md">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#10b981] uppercase tracking-wider">{label}</span>
          {isLoading && (
            <span className="size-2 rounded-full bg-[#10b981] animate-pulse" />
          )}
        </div>
        <div className="text-base font-black text-white font-mono">
          {isLoading ? "Loading…" : value}
        </div>
        <p className="text-[11px] text-white/40 leading-tight">
          {error ?? detail}
        </p>
      </div>

      {action ? (
        <button
          className="btn-primary text-xs py-2 px-4 shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
