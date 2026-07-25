import { useEffect, useState } from 'react';

const FLOW_STATES = [
  { label: 'FUNDED', color: '#10b981', pct: 0 },
  { label: 'IN PROGRESS', color: '#34d399', pct: 33 },
  { label: 'SUBMITTED', color: '#059669', pct: 66 },
  { label: 'RELEASED', color: '#10b981', pct: 100 },
];

export function EscrowFlowCard() {
  const [activeState, setActiveState] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveState((s) => (s + 1) % FLOW_STATES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const state = FLOW_STATES[activeState] ?? FLOW_STATES[0]!;

  return (
    <div
      className="relative rounded-3xl overflow-hidden border border-[#10b981]/25 bg-[#07110c]/90 backdrop-blur-xl"
      style={{ boxShadow: '0 0 60px rgba(16,185,129,0.15), inset 0 0 60px rgba(16,185,129,0.03)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#10b981]/15">
        <div className="flex items-center gap-2.5">
          <div className="size-2.5 rounded-full bg-[#10b981] animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">Live Escrow Lifecycle</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/20">
          <div className="size-2 rounded-full bg-[#10b981]" />
          <span className="text-[10px] font-semibold text-[#34d399]">GIWA Sepolia</span>
        </div>
      </div>

      <div className="p-6 space-y-3.5">
        {/* Client Wallet */}
        <FlowNode
          icon="👤"
          label="CLIENT WALLET"
          address="0x8A92...F31D"
          color="#10b981"
        />

        {/* Arrow */}
        <FlowArrow active={activeState >= 1} />

        {/* Escrow Contract */}
        <div
          className="rounded-2xl border border-[#10b981]/35 bg-[#091a12] p-4.5"
          style={{ boxShadow: '0 0 25px rgba(16,185,129,0.12)' }}
        >
          <div className="flex items-center gap-3 mb-2.5">
            <div className="size-9 rounded-xl bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#34d399]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <line x1="9" y1="7" x2="15" y2="7" />
                <line x1="9" y1="11" x2="15" y2="11" />
                <line x1="9" y1="15" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#10b981] uppercase tracking-wider">Escrow Smart Contract</div>
              <div className="text-xs font-mono text-white/80">0x72FA...9912</div>
            </div>
          </div>
          <div className="text-center py-1.5 bg-[#050e09] rounded-xl border border-[#10b981]/15">
            <span className="text-2xl font-black text-white">500 </span>
            <span className="text-xs font-bold text-[#34d399] tracking-wider">USDC LOCKED</span>
          </div>
        </div>

        {/* Arrow */}
        <FlowArrow active={activeState >= 2} />

        {/* Worker Wallet */}
        <FlowNode
          icon="👷"
          label="WORKER WALLET"
          address="0x91BC...82AD"
          color="#34d399"
          released={activeState >= 3}
        />

        {/* Arrow */}
        <FlowArrow active={activeState >= 3} />

        {/* Block confirmed */}
        <div
          className={`rounded-2xl border p-3.5 flex items-center gap-3 transition-all duration-500 ${
            activeState >= 3
              ? 'border-[#10b981]/50 bg-[#10b981]/15'
              : 'border-white/10 bg-white/[0.02]'
          }`}
        >
          <div
            className={`size-8 rounded-full flex items-center justify-center transition-all duration-500 ${
              activeState >= 3 ? 'bg-[#10b981] text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.6)]' : 'bg-white/5'
            }`}
          >
            <svg
              className={`w-4 h-4 transition-colors duration-500 ${activeState >= 3 ? 'text-slate-950 stroke-[3]' : 'text-white/20'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#10b981] uppercase tracking-wider">Block Confirmed</div>
            <div className="text-xs font-bold text-white">0.4 seconds</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="pt-1">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Escrow Status</span>
            <span className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#34d399]">
              {state.label}
            </span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
            <div
              className="h-full rounded-full transition-all duration-700 ease-in-out"
              style={{
                width: `${state.pct}%`,
                background: `linear-gradient(90deg, #059669, #10b981, #34d399)`,
                boxShadow: `0 0 10px rgba(16,185,129,0.8)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowNode({
  icon,
  label,
  address,
  color,
  released,
}: {
  icon: string;
  label: string;
  address: string;
  color: string;
  released?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border bg-[#08140e]/80 p-3.5 flex items-center gap-3"
      style={{ borderColor: `${color}30` }}
    >
      <div
        className="size-9 rounded-xl flex items-center justify-center text-lg shrink-0"
        style={{ background: `${color}15`, border: `1px solid ${color}30` }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{label}</div>
        <div className="text-xs font-mono text-white/80 truncate">{address}</div>
      </div>
      {released && (
        <div className="flex items-center gap-1.5 bg-[#10b981]/20 border border-[#10b981]/40 rounded-full px-2.5 py-1 shrink-0">
          <div className="size-1.5 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-[9px] font-bold text-[#34d399]">RELEASED</span>
        </div>
      )}
    </div>
  );
}

function FlowArrow({ active }: { active: boolean }) {
  return (
    <div className="flex justify-center">
      <div
        className={`flex flex-col items-center gap-0.5 transition-all duration-500 ${
          active ? 'opacity-100' : 'opacity-25'
        }`}
      >
        <div
          className={`w-0.5 h-4 transition-all duration-500 ${
            active ? 'bg-gradient-to-b from-[#10b981] to-[#34d399]' : 'bg-white/20'
          }`}
        />
        <svg
          className={`w-3 h-3 transition-colors duration-500 ${active ? 'text-[#34d399]' : 'text-white/20'}`}
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path d="M6 10L0 2h12z" />
        </svg>
      </div>
    </div>
  );
}
