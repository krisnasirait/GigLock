import { formatUnits } from "viem";
import { Link } from "react-router-dom";
import { MILESTONE_STATUS } from "../model.js";
import type { JobChainSnapshot } from "../queries.js";
import { JobStatusBadge } from "./JobStatusBadge.js";
import { TransactionProgress } from "./TransactionProgress.js";

function compactAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function JobCard({ job }: { job: JobChainSnapshot }) {
  const title = job.metadata?.title ?? `Escrow ${compactAddress(job.address)}`;
  const description = job.metadata?.description;
  const skills = job.metadata?.skills ?? [];
  const amount = Number(formatUnits(job.totalAmount, 6)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
  const completedMilestones = job.milestones.filter(
    (milestone) =>
      milestone[1] === MILESTONE_STATUS.Released || milestone[1] === MILESTONE_STATUS.Refunded,
  ).length;

  const isUnassigned = /^0x0{40}$/i.test(job.worker);

  return (
    <article className="rounded-3xl border border-[#10b981]/20 bg-[#08130d] p-6 sm:p-7 hover:border-[#10b981]/45 hover:bg-[#0a1810] transition-all group shadow-xl shadow-black/30">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#10b981]/15">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-[#10b981] tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#10b981]/10 border border-[#10b981]/20">
              {compactAddress(job.address)}
            </span>
            {isUnassigned && (
              <span className="text-[10px] font-bold text-[#34d399] tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#34d399]/15">
                ✦ OPEN FOR WORKERS
              </span>
            )}
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white group-hover:text-[#34d399] transition-colors leading-tight">
            <Link to={`/app/jobs/${job.address}`}>{title}</Link>
          </h3>
        </div>

        {/* Escrow Amount Highlight */}
        <div className="sm:text-right shrink-0 bg-[#050e09] px-4 py-2.5 rounded-2xl border border-[#10b981]/20">
          <div className="text-[10px] font-bold text-[#10b981] uppercase tracking-wider">Total Escrow</div>
          <div className="text-2xl font-black text-white font-mono tracking-tight">
            {amount} <span className="text-xs font-bold text-[#34d399]">USDC</span>
          </div>
        </div>
      </div>

      {/* Brief Description */}
      {description && (
        <p className="text-xs sm:text-sm text-white/60 leading-relaxed my-4 line-clamp-2">
          {description}
        </p>
      )}

      {/* Skills Badges */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 my-3">
          {skills.map((skill, i) => (
            <span
              key={i}
              className="text-[10px] font-medium text-white/50 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Participants & Milestone Progress Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 my-5 p-4 rounded-2xl bg-[#050e09] border border-[#10b981]/15">
        <div>
          <div className="text-[10px] font-bold text-[#10b981] uppercase tracking-wider">Client</div>
          <div className="text-xs font-mono text-white/80 mt-0.5" title={job.client}>
            {compactAddress(job.client)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-[#10b981] uppercase tracking-wider">Worker</div>
          <div className="text-xs font-mono text-white/80 mt-0.5" title={job.worker}>
            {isUnassigned ? "Unassigned" : compactAddress(job.worker)}
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <div className="text-[10px] font-bold text-[#10b981] uppercase tracking-wider">Milestones</div>
          <div className="text-xs font-bold text-white mt-0.5">
            {completedMilestones} / {job.milestones.length} Released
          </div>
        </div>
      </div>

      {/* Status Progress Bar */}
      <div className="my-4">
        <TransactionProgress status={job.status} milestones={job.milestones} />
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[#10b981]/15 mt-5">
        <JobStatusBadge status={job.status} />
        <div className="flex items-center gap-3">
          {job.status === 0 && (
            <Link to={`/app/jobs/new?job=${job.address}`}>
              <button className="btn-outline text-xs py-2 px-4 border-amber-500/30 text-amber-300 hover:bg-amber-500/10">
                Recover Funding
              </button>
            </Link>
          )}
          <Link to={`/app/jobs/${job.address}`}>
            <button className="btn-primary text-xs py-2.5 px-5 flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <span>View Escrow & Details</span>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </Link>
        </div>
      </div>
    </article>
  );
}
