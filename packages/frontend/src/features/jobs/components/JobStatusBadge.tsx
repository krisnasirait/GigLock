import { JOB_STATUS } from "../model.js";

const statusLabels: Record<number, string> = {
  [JOB_STATUS.Created]: "Awaiting funds",
  [JOB_STATUS.Funded]: "Funded",
  [JOB_STATUS.InProgress]: "In progress",
  [JOB_STATUS.Completed]: "Completed",
  [JOB_STATUS.Cancelled]: "Cancelled",
};

export function JobStatusBadge({ status }: { status: number }) {
  const label = statusLabels[status] ?? "Unknown status";
  return <span className={`job-status job-status-${status}`}>{label}</span>;
}
