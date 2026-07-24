import { formatUnits } from "viem";
import { MILESTONE_STATUS } from "../model.js";
import type { JobChainSnapshot } from "../queries.js";
import { JobStatusBadge } from "./JobStatusBadge.js";
import { TransactionProgress } from "./TransactionProgress.js";

function compactAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function JobCard({ job }: { job: JobChainSnapshot }) {
  const title = job.metadata?.title ?? `Escrow ${compactAddress(job.address)}`;
  const amount = Number(formatUnits(job.totalAmount, 6)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
  const completedMilestones = job.milestones.filter(
    (milestone) =>
      milestone[1] === MILESTONE_STATUS.Released || milestone[1] === MILESTONE_STATUS.Refunded,
  ).length;

  return (
    <article className="job-card">
      <div className="job-card-header">
        <div>
          <p className="job-card-address">{compactAddress(job.address)}</p>
          <h3>{title}</h3>
        </div>
        <JobStatusBadge status={job.status} />
      </div>
      <dl className="job-facts">
        <div>
          <dt>Escrow</dt>
          <dd>{amount} USDC</dd>
        </div>
        <div>
          <dt>Client</dt>
          <dd>{compactAddress(job.client)}</dd>
        </div>
        <div>
          <dt>Milestones</dt>
          <dd>{completedMilestones}/{job.milestones.length} complete</dd>
        </div>
      </dl>
      {job.metadataError ? <p className="job-card-note">Metadata is temporarily unavailable; on-chain escrow data is shown.</p> : null}
      <TransactionProgress status={job.status} milestones={job.milestones} />
    </article>
  );
}
