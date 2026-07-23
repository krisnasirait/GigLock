/**
 * Job status enum — mirrors `EscrowJob.JobStatus`.
 */
export const JOB_STATUS = {
  Created: 0,
  Funded: 1,
  InProgress: 2,
  Completed: 3,
  Cancelled: 4,
} as const;
export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

/**
 * Milestone status enum — mirrors `EscrowJob.MilestoneStatus`.
 */
export const MILESTONE_STATUS = {
  Pending: 0,
  Submitted: 1,
  Confirmed: 2,
  Disputed: 3,
  Released: 4,
  Refunded: 5,
} as const;
export type MilestoneStatus = (typeof MILESTONE_STATUS)[keyof typeof MILESTONE_STATUS];

/**
 * Confirm window for milestone auto-release. Mirrors `EscrowJob.CONFIRM_WINDOW`.
 */
export const CONFIRM_WINDOW_SECONDS = 48 * 60 * 60;

/**
 * UI-facing role toggle.
 */
export const ROLE = {
  Client: "client",
  Worker: "worker",
} as const;
export type Role = (typeof ROLE)[keyof typeof ROLE];
