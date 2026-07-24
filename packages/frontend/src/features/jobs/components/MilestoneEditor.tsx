export type MilestoneDraft = {
  id: string;
  title: string;
  description: string;
  amountUsdc: string;
};

type MilestoneEditorProps = {
  milestones: MilestoneDraft[];
  errors: Record<string, string>;
  onChange: (id: string, field: keyof Omit<MilestoneDraft, "id">, value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
};

export function MilestoneEditor({ milestones, errors, onChange, onAdd, onRemove, disabled = false }: MilestoneEditorProps) {
  return (
    <section className="new-job-milestones card-glass rounded-xl p-5 sm:p-6" aria-labelledby="milestones-heading">
      <div className="new-job-section-heading">
        <div>
          <p className="dashboard-overline">Escrow plan</p>
          <h2 id="milestones-heading">Milestones</h2>
        </div>
        <button className="btn-outline dashboard-action" type="button" onClick={onAdd} disabled={disabled || milestones.length >= 10}>
          Add milestone
        </button>
      </div>
      <p className="new-job-helper">Split the escrow into 1–10 release-ready deliverables.</p>
      <div className="new-job-milestone-list">
        {milestones.map((milestone, index) => {
          const number = index + 1;
          const titleId = `milestone-${milestone.id}-title`;
          const descriptionId = `milestone-${milestone.id}-description`;
          const amountId = `milestone-${milestone.id}-amount`;
          return (
            <fieldset className="new-job-milestone relative rounded-lg border border-slate-700/70 bg-slate-950/40 p-4" key={milestone.id} aria-label={`Milestone ${number}`} disabled={disabled}>
              <legend>Milestone {number}</legend>
              <button
                className="new-job-remove"
                type="button"
                onClick={() => onRemove(milestone.id)}
                disabled={disabled || milestones.length <= 1}
                aria-label={`Remove milestone ${number}`}
              >
                Remove
              </button>
              <label htmlFor={titleId}>Milestone {number} title</label>
              <input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-300"
                id={titleId}
                value={milestone.title}
                maxLength={100}
                aria-invalid={errors[`${milestone.id}.title`] ? true : undefined}
                aria-describedby={errors[`${milestone.id}.title`] ? `${titleId}-error` : undefined}
                onChange={(event) => onChange(milestone.id, "title", event.target.value)}
              />
              {errors[`${milestone.id}.title`] ? <p id={`${titleId}-error`} className="new-job-error">{errors[`${milestone.id}.title`]}</p> : null}
              <label htmlFor={descriptionId}>Milestone {number} description</label>
              <textarea className="mt-1 min-h-24 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-300"
                id={descriptionId}
                value={milestone.description}
                maxLength={1000}
                aria-invalid={errors[`${milestone.id}.description`] ? true : undefined}
                aria-describedby={errors[`${milestone.id}.description`] ? `${descriptionId}-error` : undefined}
                onChange={(event) => onChange(milestone.id, "description", event.target.value)}
              />
              {errors[`${milestone.id}.description`] ? <p id={`${descriptionId}-error`} className="new-job-error">{errors[`${milestone.id}.description`]}</p> : null}
              <label htmlFor={amountId}>Milestone {number} amount in USDC</label>
              <input className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-300"
                id={amountId}
                inputMode="decimal"
                value={milestone.amountUsdc}
                aria-invalid={errors[`${milestone.id}.amountUsdc`] ? true : undefined}
                aria-describedby={errors[`${milestone.id}.amountUsdc`] ? `${amountId}-error` : undefined}
                onChange={(event) => onChange(milestone.id, "amountUsdc", event.target.value)}
              />
              {errors[`${milestone.id}.amountUsdc`] ? <p id={`${amountId}-error`} className="new-job-error">{errors[`${milestone.id}.amountUsdc`]}</p> : null}
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}
