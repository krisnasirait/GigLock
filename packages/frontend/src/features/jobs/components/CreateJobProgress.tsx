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
  const currentIndex = stages.findIndex(({ id }) => id === stage);
  return (
    <section className="new-job-progress card-glass mt-4 rounded-xl p-5" aria-label="Create escrow progress" aria-live="polite">
      <ol>
        {stages.map(({ id, label }, index) => (
          <li className={stage === "complete" || index < currentIndex ? "is-complete" : index === currentIndex ? "is-current" : ""} key={id}>
            <span aria-hidden="true" />{label}
          </li>
        ))}
      </ol>
      {hashes.create ? <a href={transactionUrl(hashes.create)} target="_blank" rel="noreferrer" aria-label="View create transaction on GIWA Explorer">View create transaction on GIWA Explorer</a> : null}
      {hashes.approve ? <a href={transactionUrl(hashes.approve)} target="_blank" rel="noreferrer" aria-label="View approval transaction on GIWA Explorer">View approval transaction on GIWA Explorer</a> : null}
      {hashes.fund ? <a href={transactionUrl(hashes.fund)} target="_blank" rel="noreferrer" aria-label="View funding transaction on GIWA Explorer">View funding transaction on GIWA Explorer</a> : null}
      {detail ? <p className="new-job-helper">{detail}</p> : null}
      {error ? <p className="new-job-error" role="alert">{error}</p> : null}
    </section>
  );
}
