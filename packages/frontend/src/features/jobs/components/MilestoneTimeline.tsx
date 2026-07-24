import { formatUnits } from "viem";
import { MILESTONE_STATUS, type JobMetadataV1, type MilestoneTuple } from "../model.js";

const milestoneStatusLabels: Record<number, string> = {
  [MILESTONE_STATUS.Pending]: "Pending proof",
  [MILESTONE_STATUS.Submitted]: "Proof submitted",
  [MILESTONE_STATUS.Confirmed]: "Released",
  [MILESTONE_STATUS.Disputed]: "In dispute",
  [MILESTONE_STATUS.Released]: "Released",
  [MILESTONE_STATUS.Refunded]: "Refunded",
};

export function MilestoneTimeline({
  milestones,
  metadata,
}: {
  milestones: MilestoneTuple[];
  metadata?: JobMetadataV1;
}) {
  return (
    <ol className="milestone-timeline" aria-label="Milestones">
      {milestones.map((milestone, index) => {
        const details = metadata?.milestones[index];
        const state = milestoneStatusLabels[milestone[1]] ?? "Unknown";
        return (
          <li className="milestone-timeline-item" key={index}>
            <span className={`milestone-timeline-marker is-${milestone[1]}`} aria-hidden="true" />
            <div className="milestone-timeline-copy">
              <div className="milestone-timeline-heading">
                <h3>{details?.title ?? `Milestone ${index + 1}`}</h3>
                <span>{state}</span>
              </div>
              {details?.description ? <p>{details.description}</p> : <p>Milestone details are unavailable from IPFS; the amount and state below are on-chain.</p>}
            </div>
            <strong>{formatUnits(milestone[0], 6)} USDC</strong>
          </li>
        );
      })}
    </ol>
  );
}
