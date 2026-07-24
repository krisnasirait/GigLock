interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: string;
  color?: string;
}

export function PlaceholderPage({ title, description, icon, color = '#3b82f6' }: PlaceholderPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center pt-20 pb-16 px-6">
      <div className="text-center max-w-md">
        {/* Glow orb */}
        <div
          className="mx-auto mb-8 size-24 rounded-2xl flex items-center justify-center text-4xl relative"
          style={{
            background: `${color}15`,
            border: `1px solid ${color}30`,
            boxShadow: `0 0 40px ${color}20`,
          }}
        >
          {icon}
          <div
            className="absolute inset-0 rounded-2xl animate-pulse-slow"
            style={{ boxShadow: `0 0 30px ${color}30` }}
          />
        </div>

        <div
          className="inline-block text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color }}
        >
          Coming Soon
        </div>

        <h1 className="text-3xl font-black text-white mb-4">{title}</h1>
        <p className="text-white/40 text-base leading-relaxed">{description}</p>

        <div className="mt-8 rounded-xl border border-white/5 bg-white/2 p-4 text-xs text-white/30 font-mono">
          This page is under construction. Check back soon.
        </div>
      </div>
    </div>
  );
}
