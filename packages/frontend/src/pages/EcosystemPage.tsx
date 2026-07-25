import { Link } from 'react-router-dom';

const PARTNERS = [
  {
    name: 'DeliveryX',
    category: 'Logistics',
    desc: 'Last-mile delivery network using GigLock escrow for gig driver payments across Southeast Asia.',
    color: '#10b981',
    icon: '🚚',
    stat: '12,400+ deliveries',
  },
  {
    name: 'FreelanceX',
    category: 'Freelance',
    desc: 'Design and development marketplace. Every project funded through on-chain milestone escrow.',
    color: '#34d399',
    icon: '💻',
    stat: '3,800+ projects',
  },
  {
    name: 'WorkFlow',
    category: 'Enterprise',
    desc: 'Enterprise task management with GigLock as the payment rail for contractor payouts.',
    color: '#059669',
    icon: '🏢',
    stat: '220+ companies',
  },
  {
    name: 'TaskHub',
    category: 'Microtasks',
    desc: 'High-volume micro-task platform. Sub-$1 escrow jobs processed at chain speed.',
    color: '#6ee7b7',
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
    color: '#10b981',
  },
  {
    title: 'Gig Economy Apps',
    desc: 'Fund driver, courier, and service gig payouts per delivery — not per day. Instant on-chain confirmation.',
    icon: '🛵',
    color: '#34d399',
  },
  {
    title: 'Creator Economies',
    desc: 'Milestone-based contracts for creative work. Client sees proof on IPFS before releasing payment.',
    icon: '🎨',
    color: '#6ee7b7',
  },
  {
    title: 'Enterprise Contractors',
    desc: 'Compliant, auditable contractor payouts with on-chain proof of work for every milestone.',
    icon: '🏗️',
    color: '#059669',
  },
];

export function EcosystemPage() {
  return (
    <div className="min-h-screen pt-28 pb-16 bg-[#050b08]">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 mb-20 text-center">
        <div className="inline-flex items-center gap-2 border border-[#10b981]/30 bg-[#10b981]/10 rounded-full px-4 py-1.5 mb-6">
          <div className="size-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-xs font-bold text-[#34d399] uppercase tracking-widest">Growing Network</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">The GigLock Ecosystem</h1>
        <p className="text-base sm:text-lg text-white/50 max-w-2xl mx-auto leading-relaxed">
          Platforms and applications building on GigLock infrastructure to bring trustless payments
          to millions of gig workers.
        </p>
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-2xl border border-[#10b981]/15 bg-[#09140e] p-6 text-center">
              <div className="text-3xl font-black text-white mb-1">{s.value}</div>
              <div className="text-xs font-bold text-[#10b981] tracking-wider uppercase">{s.label}</div>
              <div className="text-[10px] text-white/30 mt-1">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Partners */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-6">Integration Partners</h2>
        <div className="grid md:grid-cols-2 gap-5">
          {PARTNERS.map((p) => (
            <div key={p.name} className="rounded-2xl border border-[#10b981]/15 bg-[#09140e] p-6 hover:border-[#10b981]/35 transition-all group">
              <div className="flex items-start gap-4 mb-4">
                <div className="size-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                     style={{ background: `${p.color}15`, border: `1px solid ${p.color}30` }}>
                  {p.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-white text-lg">{p.name}</span>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider"
                          style={{ background: `${p.color}20`, color: p.color, border: `1px solid ${p.color}30` }}>
                      {p.category}
                    </span>
                  </div>
                  <div className="text-xs font-mono font-bold text-[#34d399]">{p.stat}</div>
                </div>
              </div>
              <p className="text-sm text-white/50 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-6">Build With GigLock</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {USE_CASES.map((u) => (
            <div key={u.title} className="flex gap-4 rounded-2xl border border-[#10b981]/15 bg-[#09140e] p-6 hover:border-[#10b981]/30 transition-all">
              <div className="size-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
                   style={{ background: `${u.color}15`, border: `1px solid ${u.color}30` }}>
                {u.icon}
              </div>
              <div>
                <div className="font-bold text-white text-base mb-1">{u.title}</div>
                <p className="text-sm text-white/50 leading-relaxed">{u.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6">
        <div className="rounded-3xl border border-[#10b981]/25 bg-[#09140e] p-8 text-center shadow-xl shadow-[#10b981]/5">
          <h3 className="text-2xl font-black text-white mb-3">Want to integrate GigLock?</h3>
          <p className="text-sm text-white/50 mb-6 max-w-lg mx-auto">
            Use our smart contract ABIs and IPFS relayer to add trustless escrow payments to any platform.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/developers">
              <button className="btn-primary text-xs">View Developer Docs</button>
            </Link>
            <a href="https://github.com/krisnasirait/GigLock" target="_blank" rel="noopener noreferrer">
              <button className="btn-outline text-xs">GitHub ↗</button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
