import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EscrowFlowCard } from '../components/EscrowFlowCard';

const TRUST_BADGES = [
  { icon: '🛡️', label: 'Non-Custodial', sub: 'Escrow' },
  { icon: '⛓️', label: 'On-Chain', sub: 'Reputation' },
  { icon: '🪪', label: 'GIWA ID', sub: 'Soulbound' },
  { icon: '✅', label: 'Audited', sub: 'Smart Contracts' },
];

const STATS = [
  {
    label: 'TOTAL VALUE LOCKED',
    value: '$12,482,920',
    unit: 'USDC',
    change: '+24.5%',
    sub: 'Locked across 8,492 jobs',
    sparkline: [20, 35, 30, 50, 45, 70, 65, 90, 85, 100],
    color: '#10b981',
  },
  {
    label: 'TOTAL TRANSACTIONS',
    value: '1,248,392',
    change: '+18.7%',
    sub: 'On-chain transactions',
    sparkline: [15, 25, 20, 40, 38, 55, 60, 75, 80, 95],
    color: '#3b82f6',
  },
  {
    label: 'ACTIVE ESCROW JOBS',
    value: '3,249',
    change: '+16.2%',
    sub: 'In progress',
    donut: true,
    color: '#8b5cf6',
  },
  {
    label: 'AVG. PAYMENT TIME',
    value: '1.02',
    unit: 'seconds',
    sub: 'Powered by GIWA Chain',
    icon: true,
    color: '#22d3ee',
  },
];

const FEATURES = [
  {
    title: 'Trustless Escrow',
    desc: 'Smart contracts hold funds securely and release instantly when work is verified.',
    color: '#3b82f6',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
        <rect x="12" y="20" width="24" height="20" rx="4" fill="none" stroke="#3b82f6" strokeWidth="2"/>
        <path d="M16 20v-6a8 8 0 1 1 16 0v6" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="24" cy="30" r="3" fill="#3b82f6"/>
        <line x1="24" y1="33" x2="24" y2="36" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
        {/* Grid base */}
        <rect x="4" y="38" width="40" height="2" rx="1" fill="#3b82f6" opacity="0.2"/>
        <rect x="8" y="34" width="4" height="4" rx="1" fill="#3b82f6" opacity="0.15"/>
        <rect x="36" y="34" width="4" height="4" rx="1" fill="#3b82f6" opacity="0.15"/>
      </svg>
    ),
  },
  {
    title: 'Portable Reputation',
    desc: 'Your reputation travels with you. Verifiable, transparent, and soulbound with GIWA ID.',
    color: '#8b5cf6',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
        <circle cx="24" cy="16" r="8" stroke="#8b5cf6" strokeWidth="2"/>
        <path d="M12 36c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="36" cy="14" r="4" fill="#8b5cf6" opacity="0.2" stroke="#8b5cf6" strokeWidth="1.5"/>
        <polyline points="34,14 35.5,15.5 38,12.5" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <text x="8" y="42" fontSize="6" fill="#8b5cf6" opacity="0.5" fontFamily="monospace">GIWA ID</text>
      </svg>
    ),
  },
  {
    title: 'Built on GIWA Chain',
    desc: 'Fast, secure, and gas-efficient. Built for real-world gig economy at global scale.',
    color: '#22d3ee',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
        <circle cx="24" cy="24" r="14" stroke="#22d3ee" strokeWidth="2" opacity="0.4"/>
        <circle cx="24" cy="24" r="8" stroke="#22d3ee" strokeWidth="2"/>
        <circle cx="24" cy="24" r="3" fill="#22d3ee"/>
        {[0,60,120,180,240,300].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const x1 = 24 + 8 * Math.cos(rad);
          const y1 = 24 + 8 * Math.sin(rad);
          const x2 = 24 + 14 * Math.cos(rad);
          const y2 = 24 + 14 * Math.sin(rad);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#22d3ee" strokeWidth="1.5" opacity="0.6"/>;
        })}
        <circle cx="24" cy="10" r="2.5" fill="#22d3ee" opacity="0.8"/>
        <circle cx="36" cy="17" r="2.5" fill="#22d3ee" opacity="0.6"/>
        <circle cx="36" cy="31" r="2.5" fill="#22d3ee" opacity="0.4"/>
      </svg>
    ),
  },
  {
    title: 'Open & Composable',
    desc: 'Integrate Escrow, Reputation, and GIWA ID into any platform with our open APIs.',
    color: '#f59e0b',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
        <rect x="6" y="6" width="16" height="16" rx="3" stroke="#f59e0b" strokeWidth="2"/>
        <rect x="26" y="6" width="16" height="16" rx="3" stroke="#f59e0b" strokeWidth="2" opacity="0.6"/>
        <rect x="6" y="26" width="16" height="16" rx="3" stroke="#f59e0b" strokeWidth="2" opacity="0.6"/>
        <rect x="26" y="26" width="16" height="16" rx="3" stroke="#f59e0b" strokeWidth="2" opacity="0.3"/>
        <line x1="22" y1="14" x2="26" y2="14" stroke="#f59e0b" strokeWidth="2"/>
        <line x1="14" y1="22" x2="14" y2="26" stroke="#f59e0b" strokeWidth="2"/>
        <line x1="34" y1="22" x2="34" y2="26" stroke="#f59e0b" strokeWidth="2" opacity="0.6"/>
        <line x1="22" y1="34" x2="26" y2="34" stroke="#f59e0b" strokeWidth="2" opacity="0.6"/>
      </svg>
    ),
  },
];

const ECOSYSTEMS = [
  { name: 'DeliveryX', sub: 'On-chain delivery infrastructure', color: '#f97316', letter: 'D' },
  { name: 'FreelanceX', sub: 'Global freelance marketplace', color: '#3b82f6', letter: 'X' },
  { name: 'WorkFlow', sub: 'Project management on-chain', color: '#10b981', letter: 'W' },
  { name: 'TaskHub', sub: 'Decentralized gig platform', color: '#8b5cf6', letter: 'T' },
];

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const w = 80, h = 24;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / (max - min)) * h}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(w / (data.length - 1)) * (data.length - 1)} cy={h - ((data[data.length - 1] - min) / (max - min)) * h} r="2.5" fill={color} />
    </svg>
  );
}

function DonutChart({ pct, color }: { pct: number; color: string }) {
  const r = 18, cx = 22, cy = 22;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={44} height={44}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={`${circ * pct / 100} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="8" fill={color} fontWeight="bold">
        {pct}%
      </text>
    </svg>
  );
}

export function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    heroRef.current?.addEventListener('mousemove', onMouse);
    return () => heroRef.current?.removeEventListener('mousemove', onMouse);
  }, []);

  return (
    <div className="min-h-screen">
      {/* ===== HERO ===== */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden hero-grid"
      >
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] transition-transform duration-1000 ease-out"
            style={{
              background: 'radial-gradient(circle, #3b82f6, transparent)',
              left: `${mousePos.x * 0.03 - 100}px`,
              top: `${mousePos.y * 0.03 - 100}px`,
            }}
          />
          <div className="absolute w-[400px] h-[400px] rounded-full opacity-15 blur-[100px] right-[-50px] top-1/3"
            style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }} />
          <div className="absolute w-[300px] h-[300px] rounded-full opacity-10 blur-[80px] left-1/3 bottom-0"
            style={{ background: 'radial-gradient(circle, #22d3ee, transparent)' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center w-full">
          {/* Left */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 border border-[#3b82f6]/30 bg-[#3b82f6]/5 rounded-full px-4 py-1.5 mb-8">
              <div className="size-4 rounded bg-gradient-to-br from-[#3b82f6] to-[#7c3aed]" />
              <span className="text-xs font-medium text-white/70">POWERED BY GIWA CHAIN</span>
            </div>

            <h1 className="text-5xl xl:text-6xl font-black leading-[1.1] tracking-tight">
              The Trust Layer
              <br />
              for the
              <br />
              <span className="text-gradient-blue">Gig Economy</span>
            </h1>

            <p className="mt-6 text-lg text-white/50 leading-relaxed">
              Instant escrow payments.<br />
              Portable reputation.<br />
              Built on GIWA Chain.
            </p>

            <div className="flex flex-wrap gap-4 mt-10">
              <Link to="/app">
                <button className="btn-primary flex items-center gap-2 text-sm">
                  Launch Protocol
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </Link>
              <Link to="/docs">
                <button className="btn-outline flex items-center gap-2 text-sm">
                  Explore Smart Contracts
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-4 mt-10">
              {TRUST_BADGES.map((b) => (
                <div
                  key={b.label}
                  className="flex items-center gap-2 text-xs text-white/50"
                >
                  <div className="size-6 rounded border border-white/10 bg-white/5 flex items-center justify-center text-sm">
                    {b.icon}
                  </div>
                  <div>
                    <div className="font-medium text-white/70">{b.label}</div>
                    <div className="text-[10px] text-white/35">{b.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Escrow flow card */}
          <div className="animate-float">
            <EscrowFlowCard />
          </div>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <section className="border-y border-white/5 bg-[#070c1e]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((stat) => (
            <div key={stat.label} className="stat-card">
              <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
                {stat.label}
              </div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-2xl font-black text-white">{stat.value}</span>
                {stat.unit && <span className="text-xs text-white/40 mb-0.5">{stat.unit}</span>}
              </div>
              {stat.change && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: stat.color }}>
                    ↑ {stat.change}
                  </span>
                  {stat.sparkline && <Sparkline data={stat.sparkline} color={stat.color} />}
                  {stat.donut && <DonutChart pct={62} color={stat.color} />}
                </div>
              )}
              {stat.sub && <p className="text-[10px] text-white/30 mt-1">{stat.sub}</p>}
              {stat.icon && (
                <div className="flex items-center gap-2 mt-1">
                  <svg className="w-8 h-8 text-[#22d3ee] opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  <span className="text-[10px] text-white/30">{stat.sub}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block text-xs font-semibold text-[#8b5cf6] uppercase tracking-widest mb-3">
              Built for the Next Economy
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Decentralized Trust Infrastructure
            </h2>
            <p className="text-lg text-white/40 max-w-xl mx-auto">
              GigLock replaces intermediaries with code.
              <br />Escrow, reputation, and identity — all on-chain.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feat) => (
              <div key={feat.title} className="feature-card group cursor-pointer">
                {/* Illustration */}
                <div className="relative mb-6 h-32 rounded-xl overflow-hidden flex items-center justify-center"
                     style={{ background: `radial-gradient(circle at center, ${feat.color}15, transparent 70%)`, border: `1px solid ${feat.color}20` }}>
                  <div className="w-20 h-20 opacity-80 group-hover:opacity-100 transition-opacity duration-300">
                    {feat.icon}
                  </div>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                       style={{ background: `radial-gradient(circle at center, ${feat.color}10, transparent)` }} />
                </div>

                <h3 className="text-base font-bold text-white mb-2">{feat.title}</h3>
                <p className="text-sm text-white/45 leading-relaxed">{feat.desc}</p>

                <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                     style={{ color: feat.color }}>
                  Learn more
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ECOSYSTEM ===== */}
      <section className="py-16 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-2xl border border-white/5 bg-[#070c1e]/60 p-8 md:p-12">
            <div className="grid md:grid-cols-5 gap-8 items-center">
              {/* Left */}
              <div className="md:col-span-1">
                <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-3">
                  Trust by Ecosystems
                </div>
                <h3 className="text-xl font-bold text-white mb-4">
                  Building the future of work on-chain.
                </h3>
                <button className="btn-outline text-xs px-4 py-2 flex items-center gap-1.5">
                  Explore Ecosystem
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Partners */}
              <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {ECOSYSTEMS.map((eco) => (
                  <div
                    key={eco.name}
                    className="rounded-xl border border-white/5 bg-white/2 hover:border-white/10 hover:bg-white/5 p-4 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="size-9 rounded-xl flex items-center justify-center text-sm font-black"
                        style={{ background: `${eco.color}20`, color: eco.color, border: `1px solid ${eco.color}30` }}
                      >
                        {eco.letter}
                      </div>
                      <span className="font-semibold text-white/80 text-sm group-hover:text-white transition-colors">
                        {eco.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/35">{eco.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
            Ready to work without
            <br />payment anxiety?
          </h2>
          <p className="text-white/40 mb-10 text-lg">
            Join thousands of gig professionals building trust on-chain.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/app">
              <button className="btn-primary flex items-center gap-2">
                Launch GigLock
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </Link>
            <Link to="/docs">
              <button className="btn-outline">Read Documentation</button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
