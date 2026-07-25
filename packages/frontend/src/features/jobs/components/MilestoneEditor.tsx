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
    <section className="card-glass border border-white/10 rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/40 space-y-6" aria-labelledby="milestones-heading">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="dashboard-overline text-xs font-bold text-purple-400 uppercase tracking-widest">Escrow plan</p>
          <h2 id="milestones-heading" className="text-xl font-extrabold text-white tracking-tight mt-1">Milestones</h2>
          <p className="text-xs text-white/50 mt-1">Split the escrow into 1–10 release-ready deliverables.</p>
        </div>
        <button
          className="btn-outline text-xs px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400/50 transition-all font-semibold self-start sm:self-auto"
          type="button"
          onClick={onAdd}
          disabled={disabled || milestones.length >= 10}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add milestone
        </button>
      </div>

      <div className="space-y-5">
        {milestones.map((milestone, index) => {
          const number = index + 1;
          const titleId = `milestone-${milestone.id}-title`;
          const descriptionId = `milestone-${milestone.id}-description`;
          const amountId = `milestone-${milestone.id}-amount`;
          return (
            <fieldset
              className="relative rounded-xl border border-white/10 bg-slate-950/60 p-5 sm:p-6 transition-all hover:border-purple-500/30 space-y-4"
              key={milestone.id}
              aria-label={`Milestone ${number}`}
              disabled={disabled}
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-2">
                <legend className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="size-6 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center text-xs">
                    {number}
                  </span>
                  Milestone {number}
                </legend>
                <button
                  className="text-xs font-semibold text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5"
                  type="button"
                  onClick={() => onRemove(milestone.id)}
                  disabled={disabled || milestones.length <= 1}
                  aria-label={`Remove milestone ${number}`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  Remove
                </button>
              </div>

              <div>
                <label htmlFor={titleId} className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                  Milestone {number} title
                </label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition-all"
                  id={titleId}
                  value={milestone.title}
                  maxLength={100}
                  placeholder="e.g. Smart Contract Development & Testing"
                  aria-invalid={errors[`${milestone.id}.title`] ? true : undefined}
                  aria-describedby={errors[`${milestone.id}.title`] ? `${titleId}-error` : undefined}
                  onChange={(event) => onChange(milestone.id, "title", event.target.value)}
                />
                {errors[`${milestone.id}.title`] && (
                  <p id={`${titleId}-error`} className="text-xs text-rose-400 mt-1.5 font-medium">
                    {errors[`${milestone.id}.title`]}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor={descriptionId} className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                  Milestone {number} description
                </label>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition-all"
                  id={descriptionId}
                  value={milestone.description}
                  maxLength={1000}
                  placeholder="Describe the specific deliverables for this milestone..."
                  aria-invalid={errors[`${milestone.id}.description`] ? true : undefined}
                  aria-describedby={errors[`${milestone.id}.description`] ? `${descriptionId}-error` : undefined}
                  onChange={(event) => onChange(milestone.id, "description", event.target.value)}
                />
                {errors[`${milestone.id}.description`] && (
                  <p id={`${descriptionId}-error`} className="text-xs text-rose-400 mt-1.5 font-medium">
                    {errors[`${milestone.id}.description`]}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor={amountId} className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                  Milestone {number} amount in USDC
                </label>
                <div className="relative">
                  <input
                    className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition-all pr-16"
                    id={amountId}
                    inputMode="decimal"
                    value={milestone.amountUsdc}
                    placeholder="100"
                    aria-invalid={errors[`${milestone.id}.amountUsdc`] ? true : undefined}
                    aria-describedby={errors[`${milestone.id}.amountUsdc`] ? `${amountId}-error` : undefined}
                    onChange={(event) => onChange(milestone.id, "amountUsdc", event.target.value)}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-cyan-400">
                    USDC
                  </span>
                </div>
                {errors[`${milestone.id}.amountUsdc`] && (
                  <p id={`${amountId}-error`} className="text-xs text-rose-400 mt-1.5 font-medium">
                    {errors[`${milestone.id}.amountUsdc`]}
                  </p>
                )}
              </div>
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}
