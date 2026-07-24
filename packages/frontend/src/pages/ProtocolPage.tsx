import { Link } from 'react-router-dom';

const CONTRACTS = [
  {
    name: 'JobFactory',
    address: '0xb01fDC7B8df1A5E4f7F843046f734C6fD622DDFF',
    desc: 'Creates EscrowJob instances, wires reputation, emits JobCreated.',
    color: '#3b82f6',
  },
  {
    name: 'EscrowJob',
    address: 'Per-job contract',
    desc: 'Holds USDC per milestone. Releases on confirm or 48h timeout.',
    color: '#8b5cf6',
  },
  {
    name: 'ReputationRegistry',
    address: '0xE8BCF79C93d40565DdCFaAE4bA3d9a24C7dC8B6E',
    desc: 'On-chain reliability score 0–100. Dojang soulbound gate enforced.',
    color: '#22d3ee',
  },
  {
    name: 'Arbiter',
    address: '0xEC61bf4e000B72B8a4f94556B608e03673Df629E',
    desc: 'Neutral dispute resolution. Releases or refunds disputed milestones.',
    color: '#10b981',
  },
];

const FLOW_STEPS = [
  {
    n: '01',
    title: 'Client Creates Job',
    desc: 'Client calls JobFactory.createJob() with milestone amounts and an IPFS metadata CID describing the work.',
    color: '#3b82f6',
  },
  {
    n: '02',
    title: 'USDC Locked in Escrow',
    desc: 'Client approves and funds the EscrowJob contract. Funds are non-custodial — only the contract logic can release them.',
    color: '#8b5cf6',
  },
  {
    n: '03',
    title: 'Worker Accepts',
    desc: 'Any wallet can accept a funded job. Acceptance is on-chain and sets the worker address for the contract.',
    color: '#22d3ee',
  },
  {
    n: '04',
    title: 'Milestone Submitted',
    desc: 'Worker uploads evidence to IPFS via the relayer and submits the proof hash + CID on-chain. A 48h review window opens.',
    color: '#f59e0b',
  },
  {
    n: '05',
    title: 'Client Confirms or Disputes',
    desc: 'Client confirms payment (instant release) or raises a dispute (routed to Arbiter). If no action in 48h, worker can auto-claim.',
    color: '#10b981',
  },
  {
    n: '06',
    title: 'Reputation Updated',
    desc: 'ReputationRegistry records the outcome. Score is computed on-read: 40% on-time, 40% rating, 20% dispute-free bonus.',
    color: '#ec4899',
  },
];

const SECURITY = [
  { label: 'Reentrancy Guard', desc: 'All fund-moving functions use OpenZeppelin ReentrancyGuard.' },
  { label: 'Non-Custodial', desc: 'Funds live in the per-job contract. No admin can sweep them.' },
  { label: 'Dojang Identity Gate', desc: 'Reputation writes require a verified GIWA Dojang soulbound attestation.' },
  { label: 'Authorized Callers Only', desc: 'ReputationRegistry only accepts writes from factory-registered EscrowJob contracts.' },
  { label: 'CID Length Validation', desc: 'Metadata and proof CIDs are validated on-chain (1–128 bytes). Empty or overlong CIDs revert.' },
  { label: 'Proof Hash Required', desc: 'submitMilestone requires a non-zero keccak256 proof hash. Zero hash reverts.' },
];

export function ProtocolPage() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 mb-20 text-center">
        <div className="inline-flex items-center gap-2 border border-[#3b82f6]/30 bg-[#3b82f6]/5 rounded-full px-4 py-1.5 mb-6">
          <div className="size-1.5 rounded-full bg-[#3b82f6] animate-pulse" />
          <span className="text-xs font-semibold text-[#3b82f6] uppercase tracking-widest">Live on GIWA Sepolia</span>
        </div>
        <h1 className="text-5xl font-black text-white mb-4">The GigLock Protocol</h1>
        <p className="text-lg text-white/50 max-w-2xl mx-auto">
          A set of auditable smart contracts that replace escrow intermediaries with code.
          Every payment, milestone, and reputation score lives on-chain.
        </p>
      </section>

      {/* Contracts */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-6">Smart Contracts</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {CONTRACTS.map((c) => (
            <div key={c.name} className="rounded-xl border border-white/5 bg-[#0a0e22]/60 p-5 hover:border-white/10 transition-all group">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg flex items-center justify-center text-xs font-black"
                       style={{ background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}30` }}>
                    {'{ }'}
                  </div>
                  <span className="font-bold text-white">{c.name}</span>
                </div>
                <a
                  href={`https://sepolia-explorer.giwa.io/address/${c.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors truncate max-w-[160px]"
                >
                  {c.address}↗
                </a>
              </div>
              <p className="text-sm text-white/50">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Flow */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-6">Escrow Lifecycle</h2>
        <div className="space-y-3">
          {FLOW_STEPS.map((step, i) => (
            <div key={step.n} className="flex gap-5 items-start group">
              <div className="flex flex-col items-center pt-1">
                <div className="size-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0"
                     style={{ background: `${step.color}15`, color: step.color, border: `1px solid ${step.color}30` }}>
                  {step.n}
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <div className="w-px flex-1 mt-2" style={{ background: `linear-gradient(to bottom, ${step.color}40, transparent)`, minHeight: '24px' }} />
                )}
              </div>
              <div className="pb-4">
                <div className="font-semibold text-white mb-1">{step.title}</div>
                <p className="text-sm text-white/45 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-6">Security Model</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SECURITY.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/5 bg-[#0a0e22]/60 p-4 hover:border-[#3b82f6]/20 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-[#10b981] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-sm font-semibold text-white">{s.label}</span>
              </div>
              <p className="text-xs text-white/40 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6">
        <div className="rounded-2xl border border-[#3b82f6]/20 bg-[#3b82f6]/5 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Ready to use the protocol?</h3>
            <p className="text-sm text-white/50">Create a job, lock USDC, and pay on confirmation — all trustlessly.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link to="/app">
              <button className="btn-primary text-sm flex items-center gap-2">
                Launch dApp
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </Link>
            <Link to="/developers">
              <button className="btn-outline text-sm">View ABIs</button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
