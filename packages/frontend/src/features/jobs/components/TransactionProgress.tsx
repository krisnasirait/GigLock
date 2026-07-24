import { JOB_STATUS, MILESTONE_STATUS, type MilestoneTuple } from "../model.js";

type ProgressStep = {
  label: string;
  complete: boolean;
  current: boolean;
};

function jobSteps(status: number, milestones: MilestoneTuple[]): ProgressStep[] {
  const submitted = milestones.some((milestone) => milestone[1] === MILESTONE_STATUS.Submitted);
  const released = milestones.length > 0 && milestones.every((milestone) =>
    milestone[1] === MILESTONE_STATUS.Confirmed || milestone[1] === MILESTONE_STATUS.Released,
  );
  const funded =
    status === JOB_STATUS.Funded || status === JOB_STATUS.InProgress || status === JOB_STATUS.Completed;
  const accepted = status === JOB_STATUS.InProgress || status === JOB_STATUS.Completed;

  return [
    { label: "Funded", complete: funded, current: status === JOB_STATUS.Created },
    { label: "Accepted", complete: accepted, current: status === JOB_STATUS.Funded },
    { label: "Proof", complete: submitted || released, current: status === JOB_STATUS.InProgress && !submitted },
    { label: "Released", complete: status === JOB_STATUS.Completed || released, current: submitted && !released },
  ];
}

export function TransactionProgress({ status, milestones }: { status: number; milestones: MilestoneTuple[] }) {
  const steps = jobSteps(status, milestones);

  return (
    <ol className="transaction-progress" aria-label="Escrow progress">
      {steps.map((step) => (
        <li
          className={step.complete ? "transaction-step is-complete" : step.current ? "transaction-step is-current" : "transaction-step"}
          key={step.label}
        >
          <span className="transaction-marker" aria-hidden="true" />
          <span>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
