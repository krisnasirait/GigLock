import { Link } from 'react-router-dom';

const PARTNERS = [
  {
    name: 'DeliveryX',
    category: 'Logistics',
    desc: 'Last-mile delivery network using GigLock escrow for gig driver payments across Southeast Asia.',
    color: '#3b82f6',
    icon: '🚚',
    stat: '12,400+ deliveries',
  },
  {
    name: 'FreelanceX',
    category: 'Freelance',
    desc: 'Design and development marketplace. Every project funded through on-chain milestone escrow.',
    color: '#8b5cf6',
    icon: '💻',
    stat: '3,800+ projects',
  },
  {
    name: 'WorkFlow',
    category: 'Enterprise',
    desc: 'Enterprise task management with GigLock as the payment rail for contractor payouts.',
    color: '#10b981',
    icon: '🏢',
    stat: '220+ companies',
  },
  {
    name: 'TaskHub',
    category: 'Microtasks',
    desc: 'High-volume micro-task platform. Sub-$1 escrow jobs processed at chain speed.',
    color: '#f59e0b',
    icon: '⚡',
    stat: '1.2M+ tasks',
  },
];

const STATS = [
  { label: 'Ecosystem Apps', value: '4+', sub: 'Live integrations' },
  { label: 'Total Volume', value: '$12.4M', sub: 'USDC processed' },
  { label: 'Active Workers', value: '8,492', sub: 'Across all platforms' },
  { label: 'Countries', value: '14', sub: 'SEA & beyond' },
];

const USE_CASES = [
  {
    title: 'Freelance Platforms',
    desc: 'Replace manual payment rails with trustless USDC escrow. Eliminate payment disputes and chargebacks.',
    icon: '🧑‍💻',
    color: '#8b5cf6',
  },
  {
    title: 'Gig Economy Apps',
    desc: 'Fund driver, courier, and service gig payouts per delivery — not per day. Instant on-chain confirmation.',
    icon: '🛵',
    color: '#3b82f6',
  },
  {
    title: 'Creator Economies',
    desc: 'Milestone-based contracts for creative work. Client sees proof on IPFS before releasing payment.',
    icon: '🎨',
    color: '#ec4899',
  },
  {
    title: 'Enterprise Contractors',
    desc: 'Compliant, auditable contractor payouts with on-chain proof of work for every milestone.',
    icon: '🏗️',
    color: '#10b981',
  },
];

export function EcosystemPage() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 mb-20 text-center">
        <div className="inline-flex items-center gap-2 border border-[#10b981]/30 bg-[#10b981]/5 rounded-full px-4 py-1.5 mb-6">
          <div className="size-1.5 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-xs font-semibold text-[#10b981] uppercase tracking-widest">Growing Network</span>
        </div>
        <h1 className="text-5xl font-black text-white mb-4">The GigLock Ecosystem</h1>
        <p className="text-lg text-white/50 max-w-2xl mx-auto">
          Platforms and applications building on GigLock infrastructure to bring trustless payments
          to millions of gig workers.
        </p>
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/5 bg-[#0a0e22]/60 p-5 text-center">
              <div className="text-3xl font-black text-white mb-1">{s.value}</div>
              <div className="text-xs text-white/30">{s.label}</div>
              <div className="text-[10px] text-white/20 mt-1">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Partners */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-6">Integration Partners</h2>
        <div className="grid md:grid-cols-2 gap-5">
          {PARTNERS.map((p) => (
            <div key={p.name} className="rounded-2xl border border-white/5 bg-[#0a0e22]/60 p-6 hover:border-white/10 transition-all group">
              <div className="flex items-start gap-4 mb-4">
                <div className="size-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                     style={{ background: `${p.color}10`, border: `1px solid ${p.color}25` }}>
                  {p.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-white">{p.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${p.color}15`, color: p.color }}>
                      {p.category}
                    </span>
                  </div>
                  <div className="text-xs font-mono" style={{ color: p.color }}>{p.stat}</div>
                </div>
              </div>
              <p className="text-sm text-white/45 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-6">Build With GigLock</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {USE_CASES.map((u) => (
            <div key={u.title} className="flex gap-4 rounded-xl border border-white/5 bg-[#0a0e22]/60 p-5 hover:border-white/10 transition-all">
              <div className="size-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                   style={{ background: `${u.color}10`, border: `1px solid ${u.color}25` }}>
                {u.icon}
              </div>
              <div>
                <div className="font-semibold text-white mb-1">{u.title}</div>
                <p className="text-sm text-white/45 leading-relaxed">{u.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6">
        <div className="rounded-2xl border border-[#10b981]/20 bg-[#10b981]/5 p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-3">Want to integrate GigLock?</h3>
          <p className="text-sm text-white/50 mb-6 max-w-lg mx-auto">
            Use our smart contract ABIs and IPFS relayer to add trustless escrow payments to any platform.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/developers">
              <button className="btn-primary text-sm">View Developer Docs</button>
            </Link>
            <a href="https://github.com/krisnasirait/GigLock" target="_blank" rel="noopener noreferrer">
              <button className="btn-outline text-sm">GitHub ↗</button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
