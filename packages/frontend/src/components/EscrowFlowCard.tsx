import { useEffect, useState } from 'react';

const FLOW_STATES = [
  { label: 'FUNDED', color: '#3b82f6', pct: 0 },
  { label: 'IN PROGRESS', color: '#8b5cf6', pct: 33 },
  { label: 'SUBMITTED', color: '#22d3ee', pct: 66 },
  { label: 'RELEASED', color: '#10b981', pct: 100 },
];

export function EscrowFlowCard() {
  const [activeState, setActiveState] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setActiveState((s) => (s + 1) % FLOW_STATES.length);
        setAnimating(false);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // activeState is always 0–3 (modulo FLOW_STATES.length), but TS can't prove it
  const state = FLOW_STATES[activeState] ?? FLOW_STATES[0]!;

  return (
    <div className="relative rounded-2xl overflow-hidden border border-[#3b82f6]/20 bg-[#070c1e]"
         style={{ boxShadow: '0 0 60px rgba(59,130,246,0.15), inset 0 0 60px rgba(59,130,246,0.03)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Live Escrow Flow</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded bg-gradient-to-br from-[#3b82f6] to-[#7c3aed]" />
          <span className="text-[10px] text-white/40">Powered by GIWA Chain</span>
        </div>
      </div>

      <div className="p-5 space-y-3">
        {/* Client Wallet */}
        <FlowNode
          icon="👤"
          label="CLIENT WALLET"
          address="0x8A92...F31D"
          color="#3b82f6"
        />

        {/* Arrow */}
        <FlowArrow active={activeState >= 1} />

        {/* Escrow Contract */}
        <div className="rounded-xl border border-[#3b82f6]/30 bg-[#0a1535] p-4"
             style={{ boxShadow: '0 0 20px rgba(59,130,246,0.1)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="size-8 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-[#3b82f6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <line x1="9" y1="7" x2="15" y2="7" />
                <line x1="9" y1="11" x2="15" y2="11" />
                <line x1="9" y1="15" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Escrow Smart Contract</div>
              <div className="text-xs font-mono text-white/70">0x72FA...9912</div>
            </div>
          </div>
          <div className="text-center py-1">
            <span className="text-2xl font-bold text-white">500 </span>
            <span className="text-sm font-semibold text-[#22d3ee]">USDC LOCKED</span>
          </div>
        </div>

        {/* Arrow */}
        <FlowArrow active={activeState >= 2} />

        {/* Worker Wallet */}
        <FlowNode
          icon="👷"
          label="WORKER WALLET"
          address="0x91BC...82AD"
          color="#10b981"
          released={activeState >= 3}
        />

        {/* Arrow */}
        <FlowArrow active={activeState >= 3} />

        {/* Block confirmed */}
        <div className={`rounded-xl border p-3 flex items-center gap-3 transition-all duration-500 ${
          activeState >= 3
            ? 'border-emerald-500/40 bg-emerald-500/5'
            : 'border-white/5 bg-white/2'
        }`}>
          <div className={`size-8 rounded-full flex items-center justify-center transition-all duration-500 ${
            activeState >= 3 ? 'bg-emerald-500/20' : 'bg-white/5'
          }`}>
            <svg className={`w-4 h-4 transition-colors duration-500 ${activeState >= 3 ? 'text-emerald-400' : 'text-white/20'}`}
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Block Confirmed</div>
            <div className="text-sm font-semibold text-white/80">1.02 seconds</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] text-white/40">Escrow Status</span>
            <span className="text-[10px] font-semibold" style={{ color: state.color }}>
              {state.label}
            </span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-in-out"
              style={{
                width: `${state.pct}%`,
                background: `linear-gradient(90deg, #3b82f6, ${state.color})`,
                boxShadow: `0 0 8px ${state.color}80`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowNode({ icon, label, address, color, released }: {
  icon: string;
  label: string;
  address: string;
  color: string;
  released?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-[#0a0e22]/60 p-3 flex items-center gap-3"
         style={{ borderColor: `${color}30` }}>
      <div className="size-9 rounded-xl flex items-center justify-center text-lg"
           style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-[10px] text-white/40 uppercase tracking-wider">{label}</div>
        <div className="text-xs font-mono text-white/70">{address}</div>
      </div>
      {released && (
        <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
          <div className="size-1.5 rounded-full bg-emerald-400" />
          <span className="text-[9px] font-semibold text-emerald-400">500 USDC RELEASED</span>
        </div>
      )}
    </div>
  );
}

function FlowArrow({ active }: { active: boolean }) {
  return (
    <div className="flex justify-center">
      <div className={`flex flex-col items-center gap-0.5 transition-all duration-500 ${active ? 'opacity-100' : 'opacity-25'}`}>
        <div className={`w-px h-4 transition-all duration-500 ${active ? 'bg-gradient-to-b from-[#3b82f6] to-[#8b5cf6]' : 'bg-white/20'}`} />
        <svg className={`w-3 h-3 transition-colors duration-500 ${active ? 'text-[#8b5cf6]' : 'text-white/20'}`}
             viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 10L0 2h12z" />
        </svg>
      </div>
    </div>
  );
}
