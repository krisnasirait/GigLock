import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EscrowFlowCard } from '../components/EscrowFlowCard';
import { toStatCardValues } from '../features/protocolMetrics/model';
import { useProtocolMetrics } from '../features/protocolMetrics/query';

const TRUST_BADGES = [
  { icon: '🛡️', label: 'Non-Custodial', sub: 'Smart Contracts' },
  { icon: '⛓️', label: 'On-Chain', sub: 'Reputation Score' },
  { icon: '🪪', label: 'GIWA ID', sub: 'Soulbound KYC' },
  { icon: '⚡', label: '0.4s Finality', sub: 'GIWA Sepolia' },
];

const PRODUCTS_SERVICES = [
  {
    title: 'Milestone Escrow',
    desc: 'Lock USDC in autonomous per-job contracts. Funds are released instantly upon milestone verification.',
    tag: 'CORE PROTOCOL',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10 text-[#10b981]">
        <rect x="8" y="18" width="32" height="22" rx="4" fill="rgba(16,185,129,0.1)" stroke="#10b981" strokeWidth="2" />
        <path d="M16 18v-6a8 8 0 1 1 16 0v6" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="29" r="3" fill="#10b981" />
      </svg>
    ),
  },
  {
    title: 'GIWA ID Identity',
    desc: 'Soulbound reputation attached to Upbit KYC. Your on-chain work history travels across every platform.',
    tag: 'IDENTITY',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10 text-[#34d399]">
        <circle cx="24" cy="16" r="8" fill="rgba(52,211,153,0.1)" stroke="#34d399" strokeWidth="2" />
        <path d="M12 36c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
        <circle cx="36" cy="14" r="3" fill="#34d399" />
      </svg>
    ),
  },
  {
    title: 'Arbiter Resolution',
    desc: 'Decentralized dispute arbitration. Fair, multi-sig dispute resolution for edge-case work conflicts.',
    tag: 'SECURITY',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-10 h-10 text-[#10b981]">
        <polygon points="24 6 40 14 40 34 24 42 8 34 8 14 24 6" fill="rgba(16,185,129,0.1)" stroke="#10b981" strokeWidth="2" />
        <polyline points="18 24 22 28 30 20" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const SECURITY_GRID = [
  {
    title: 'Secure Asset Storage',
    desc: 'Non-custodial smart contracts ensure your funds remain yours. No central sweep or admin override.',
    icon: '🔐',
  },
  {
    title: 'Strong Account Security',
    desc: 'Integrated with RainbowKit & MetaMask for hardware-grade transaction signing.',
    icon: '🛡️',
  },
  {
    title: 'Trusted Platform',
    desc: 'Audited Solidity 0.8.24 contracts with ReentrancyGuard and CID validation.',
    icon: '💎',
  },
  {
    title: 'Full Transparency',
    desc: 'Every milestone, proof CID, and reputation score is 100% verifiable on GIWA Sepolia.',
    icon: '🌐',
  },
];

const FAQS = [
  {
    q: 'What makes GigLock different from traditional freelance platforms?',
    a: 'GigLock replaces centralized intermediaries with autonomous Solidity smart contracts. Escrow funds live in per-job contracts, milestone proofs are pinned to IPFS, and reputation scores are soulbound to GIWA ID.',
  },
  {
    q: 'How does the milestone funding and release process work?',
    a: 'The client creates a job and locks USDC in escrow. Once a worker completes a milestone, they upload proof to IPFS. The client approves payment, or if inactive for 48 hours, the worker can claim auto-release.',
  },
  {
    q: 'Is GIWA Sepolia free to test?',
    a: 'Yes! You can claim 1,000 MockUSDC from our built-in faucet directly on the app dashboard.',
  },
  {
    q: 'How is the GIWA ID reputation score computed?',
    a: 'Score (0–100) is derived from on-time completion rate (40%), average client rating (40%), and a dispute-free bonus (20%). It is computed directly from on-chain events.',
  },
];

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80, h = 24;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - (((data[data.length - 1] ?? 0) - min) / range) * h} r="2.5" fill={color} />
    </svg>
  );
}

export function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const metricsQuery = useProtocolMetrics();
  const isInitialLoading = metricsQuery.isPending && metricsQuery.data === undefined;
  const isUnavailable = metricsQuery.isError && metricsQuery.data === undefined;
  const cardValues = metricsQuery.data ? toStatCardValues(metricsQuery.data) : null;
  const displayValue = (value: string | undefined) => {
    if (isInitialLoading) return '…';
    if (isUnavailable) return 'Unavailable';
    return value ?? '—';
  };
  const transactionChange = metricsQuery.data?.transactionChangePercent;
  const stats = [
    {
      label: 'TOTAL VALUE LOCKED',
      value: displayValue(cardValues?.tvl),
      unit: cardValues ? 'USDC' : undefined,
      sub: cardValues?.lockedJobs ?? 'Live GigLock escrow balances',
    },
    {
      label: 'TOTAL TRANSACTIONS',
      value: displayValue(cardValues?.transactions),
      change: transactionChange === null || transactionChange === undefined
        ? undefined
        : `${transactionChange >= 0 ? '+' : ''}${transactionChange.toFixed(1)}%`,
      sub: 'On-chain escrow events',
    },
    {
      label: 'ACTIVE ESCROWS',
      value: displayValue(cardValues?.activeJobs),
      unit: cardValues ? 'JOBS' : undefined,
      sub: 'In-flight work agreements',
    },
    {
      label: 'AVG FINALITY TIME',
      value: '0.4s',
      unit: 'SEC',
      sub: 'GIWA Sepolia testnet speed',
    },
  ];

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="relative overflow-hidden bg-[#050b08]">
      {/* Background ambient lighting */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-40 transition-opacity duration-500"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(16, 185, 129, 0.08), transparent 40%)`,
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-[#10b981]/10 via-[#059669]/5 to-transparent blur-3xl pointer-events-none" />

      {/* Hero Section */}
      <section ref={heroRef} className="relative z-10 pt-32 pb-20 hero-grid">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-8">
              {/* Pill badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0d1c14] border border-[#10b981]/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <span className="size-2 rounded-full bg-[#10b981] animate-pulse" />
                <span className="text-xs font-bold tracking-widest text-[#34d399] uppercase">
                  ✦ AUTONOMOUS ESCROW PROTOCOL
                </span>
              </div>

              {/* Main Headline */}
              <div className="space-y-4">
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.08]">
                  Instant Escrow & <br />
                  <span className="text-gradient-mint">Portable Reputation</span>
                </h1>
                <p className="text-base sm:text-lg text-white/60 max-w-xl leading-relaxed">
                  GigLock is the preferred non-custodial escrow platform for Web3 freelancers and clients.
                  Smart contracts hold funds, IPFS pins proof, and reputation lives on-chain.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link to="/app">
                  <button className="btn-primary text-sm px-8 py-3.5 shadow-lg shadow-[#10b981]/25 flex items-center gap-2">
                    Launch dApp
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </Link>
                <Link to="/protocol">
                  <button className="btn-outline text-sm px-7 py-3.5 border-[#10b981]/30 hover:border-[#10b981]/60 text-white">
                    Explore Protocol
                  </button>
                </Link>
              </div>

              {/* Mini Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-8 border-t border-[#10b981]/15">
                <div>
                  <div className="text-2xl font-black text-white">100%</div>
                  <div className="text-xs text-white/40 font-medium mt-0.5">Non-Custodial</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-[#34d399]">$12.4M+</div>
                  <div className="text-xs text-white/40 font-medium mt-0.5">Testnet Volume</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">8,400+</div>
                  <div className="text-xs text-white/40 font-medium mt-0.5">Escrows Created</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-[#34d399]">0.4s</div>
                  <div className="text-xs text-white/40 font-medium mt-0.5">Finality Speed</div>
                </div>
              </div>
            </div>

            {/* Right Card Widget */}
            <div className="lg:col-span-5 relative">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-[#10b981]/30 to-transparent blur-xl opacity-50" />
              <EscrowFlowCard />
            </div>
          </div>
        </div>
      </section>

      {/* Protocol Metrics Grid */}
      <section className="relative z-10 py-12 border-y border-[#10b981]/15 bg-[#08120d]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div key={s.label} className="stat-card group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#10b981] tracking-widest uppercase">{s.label}</span>
                  {s.change && (
                    <span className="text-xs font-bold text-[#34d399] px-2 py-0.5 rounded-full bg-[#10b981]/15">
                      {s.change}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white tracking-tight">{s.value}</span>
                  {s.unit && <span className="text-xs font-bold text-[#34d399]">{s.unit}</span>}
                </div>
                <p className="text-xs text-white/40 mt-1.5">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="relative z-10 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TRUST_BADGES.map((b) => (
              <div
                key={b.label}
                className="flex items-center gap-4 p-5 rounded-2xl bg-[#09140e]/70 border border-[#10b981]/15 hover:border-[#10b981]/35 transition-all group"
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">{b.icon}</span>
                <div>
                  <div className="text-sm font-bold text-white leading-tight">{b.label}</div>
                  <div className="text-xs text-[#34d399] font-medium">{b.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products & Services (KuCoin-style 3D Cards) */}
      <section className="relative z-10 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-[#10b981] tracking-widest uppercase px-3 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/20">
              ✦ CORE INFRASTRUCTURE
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-4">
              Discover GigLock Products & Services
            </h2>
            <p className="text-sm text-white/50 mt-3">
              Comprehensive trustless escrow primitives built for seamless Web3 freelance workflows.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {PRODUCTS_SERVICES.map((p) => (
              <div key={p.title} className="feature-card group flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="p-3 rounded-2xl bg-[#0d1c14] border border-[#10b981]/25 group-hover:scale-105 transition-transform">
                      {p.icon}
                    </div>
                    <span className="text-[10px] font-bold text-[#10b981] px-2.5 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/20">
                      {p.tag}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#34d399] transition-colors">
                    {p.title}
                  </h3>
                  <p className="text-sm text-white/50 leading-relaxed mb-6">
                    {p.desc}
                  </p>
                </div>
                <Link to="/app">
                  <button className="btn-outline w-full text-xs py-2.5 border-[#10b981]/20 group-hover:border-[#10b981]/50 text-white">
                    Discover →
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Grid Section */}
      <section className="relative z-10 py-20 bg-[#08120d]/60 border-y border-[#10b981]/15">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 space-y-6">
              <span className="text-xs font-bold text-[#10b981] tracking-widest uppercase">
                ✦ AUDITED & VERIFIABLE
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                Your Reliable & Secure Escrow Infrastructure
              </h2>
              <p className="text-sm text-white/50 leading-relaxed">
                From contract creation to IPFS proof verification and on-chain release, every step is protected by auditable code on GIWA Sepolia.
              </p>
              <Link to="/docs">
                <button className="btn-primary text-xs px-6 py-3">
                  Read Documentation
                </button>
              </Link>
            </div>

            <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
              {SECURITY_GRID.map((s) => (
                <div
                  key={s.title}
                  className="p-6 rounded-2xl bg-[#09140e] border border-[#10b981]/15 hover:border-[#10b981]/35 transition-all group"
                >
                  <div className="text-3xl mb-3">{s.icon}</div>
                  <h4 className="text-base font-bold text-white mb-1.5 group-hover:text-[#34d399] transition-colors">
                    {s.title}
                  </h4>
                  <p className="text-xs text-white/40 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="relative z-10 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <span className="text-xs font-bold text-[#10b981] tracking-widest uppercase">✦ FAQ</span>
            <h2 className="text-3xl font-black text-white tracking-tight mt-2">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-white/50 mt-2">
              Everything you need to know about the GigLock protocol.
            </p>
          </div>

          <div className="space-y-4">
            {FAQS.map((f, i) => (
              <div
                key={i}
                className="rounded-2xl bg-[#09140e] border border-[#10b981]/15 overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-[#10b981]/5 transition-colors"
                >
                  <span className="font-bold text-white text-sm sm:text-base">{f.q}</span>
                  <span className="text-lg font-bold text-[#10b981] ml-4">
                    {openFaq === i ? '−' : '+'}
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 text-sm text-white/50 leading-relaxed border-t border-[#10b981]/10 pt-4">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
