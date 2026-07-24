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
    <section className="balance-card" aria-label={label} aria-busy={isLoading || undefined}>
      <p className="balance-card-label">{label}</p>
      <p className={`balance-card-value${isLoading ? " balance-card-value-loading" : ""}`}>
        {isLoading ? "Loading…" : value}
      </p>
      <p className={error ? "balance-card-detail balance-card-error" : "balance-card-detail"}>
        {error ?? detail}
      </p>
      {action ? (
        <button
          className="btn-outline dashboard-action balance-card-action"
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </button>
      ) : null}
    </section>
  );
}
