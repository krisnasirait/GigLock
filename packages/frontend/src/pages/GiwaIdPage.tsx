import { Link } from 'react-router-dom';

const HOW_IT_WORKS = [
  {
    n: '01',
    title: 'Connect Your Wallet',
    desc: 'Link any EVM-compatible wallet (MetaMask, WalletConnect). Your wallet address becomes your GIWA ID anchor.',
    color: '#8b5cf6',
  },
  {
    n: '02',
    title: 'Verify with Upbit KYC',
    desc: 'GigLock uses GIWA Dojang — a Soulbound attestation layer backed by Upbit KYC. One verification, portable everywhere.',
    color: '#8b5cf6',
  },
  {
    n: '03',
    title: 'Earn Your On-Chain Reputation',
    desc: 'Complete jobs on-chain and your ReputationRegistry score updates automatically. No platform can take it away.',
    color: '#8b5cf6',
  },
  {
    n: '04',
    title: 'Use Everywhere in the Ecosystem',
    desc: 'Any platform built on GigLock reads your GIWA ID and score. One identity, every app.',
    color: '#8b5cf6',
  },
];

const SCORE_BREAKDOWN = [
  { label: 'On-Time Completion', weight: '40%', color: '#10b981', desc: 'Jobs completed before confirmation deadline' },
  { label: 'Average Rating', weight: '40%', color: '#3b82f6', desc: 'Client ratings averaged across completed jobs (1–5 stars)' },
  { label: 'Dispute-Free Bonus', weight: '20%', color: '#8b5cf6', desc: 'Max bonus of 20 pts, reduced by 5 per dispute received' },
];

const BENEFITS = [
  { icon: '🔒', title: 'Soulbound', desc: 'Cannot be transferred or sold. Tied to your verified identity forever.' },
  { icon: '🌐', title: 'Portable', desc: 'Works on every GigLock-integrated platform without re-verification.' },
  { icon: '🛡️', title: 'Sybil-Resistant', desc: 'Fresh wallets cannot inherit reputation. Stops reputation laundering attacks.' },
  { icon: '📊', title: 'Transparent', desc: 'Every score is computed on-read from public on-chain data. No black-box algorithms.' },
  { icon: '⚡', title: 'Real-Time', desc: 'Score updates the instant a job is confirmed or rated. No sync delay.' },
  { icon: '🤝', title: 'Mutual', desc: 'Both clients and workers have verifiable scores. Trust flows both ways.' },
];

export function GiwaIdPage() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 mb-20 text-center">
        <div className="inline-flex items-center gap-2 border border-[#8b5cf6]/30 bg-[#8b5cf6]/5 rounded-full px-4 py-1.5 mb-6">
          <div className="size-1.5 rounded-full bg-[#8b5cf6] animate-pulse" />
          <span className="text-xs font-semibold text-[#8b5cf6] uppercase tracking-widest">Soulbound Identity</span>
        </div>
        <h1 className="text-5xl font-black text-white mb-4">GIWA ID</h1>
        <p className="text-lg text-white/50 max-w-2xl mx-auto">
          Your on-chain identity. Verified once, trusted everywhere. GIWA ID is a soulbound attestation
          that gates your reputation score and makes it Sybil-proof.
        </p>
      </section>

      {/* Score breakdown */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-6">Reliability Score — 0 to 100</h2>
        <div className="rounded-2xl border border-white/5 bg-[#0a0e22]/60 p-6">
          <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-6">
            {SCORE_BREAKDOWN.map((s) => (
              <div key={s.label} className="h-full rounded-full transition-all" style={{ width: s.weight, background: s.color }} />
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {SCORE_BREAKDOWN.map((s) => (
              <div key={s.label} className="flex gap-3">
                <div className="size-2 rounded-full mt-2 shrink-0" style={{ background: s.color }} />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">{s.label}</span>
                    <span className="text-xs font-black" style={{ color: s.color }}>{s.weight}</span>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-5 border-t border-white/5 rounded-xl bg-white/[0.02] px-4 py-3">
            <code className="text-xs text-[#22d3ee] leading-relaxed">
              {`score = (onTimeCount/jobs × 40) + (ratingSum/ratingCount/5 × 40) + (20 − disputesReceived × 5)`}
            </code>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-6">How Verification Works</h2>
        <div className="space-y-3">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={step.n} className="flex gap-5 items-start">
              <div className="flex flex-col items-center pt-1">
                <div className="size-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0"
                     style={{ background: `${step.color}15`, color: step.color, border: `1px solid ${step.color}30` }}>
                  {step.n}
                </div>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="w-px mt-2" style={{ background: `linear-gradient(to bottom, ${step.color}40, transparent)`, minHeight: '24px' }} />
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

      {/* Benefits */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-6">Why GIWA ID?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-xl border border-white/5 bg-[#0a0e22]/60 p-5 hover:border-[#8b5cf6]/20 transition-all">
              <div className="text-2xl mb-3">{b.icon}</div>
              <div className="font-semibold text-white text-sm mb-1">{b.title}</div>
              <p className="text-xs text-white/40 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Dojang info */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <div className="rounded-2xl border border-[#8b5cf6]/20 bg-[#8b5cf6]/5 p-6">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-xl bg-[#8b5cf6]/15 border border-[#8b5cf6]/25 flex items-center justify-center text-2xl shrink-0">
              🥋
            </div>
            <div>
              <h3 className="font-bold text-white mb-2">Powered by GIWA Dojang</h3>
              <p className="text-sm text-white/50 leading-relaxed mb-3">
                GIWA Dojang is the attestation layer that backs GIWA ID. It issues a Soulbound Token
                to wallets that complete KYC through Upbit — the attester ID is stored on-chain and
                checked by ReputationRegistry on every write.
              </p>
              <a
                href="https://sepolia-explorer.giwa.io/address/0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-[#8b5cf6] hover:underline"
              >
                DojangScroll: 0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9 ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6">
        <div className="rounded-2xl border border-[#8b5cf6]/20 bg-[#0a0e22]/60 p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-3">Get your GIWA ID</h3>
          <p className="text-sm text-white/50 mb-6 max-w-lg mx-auto">
            Complete GIWA KYC through Upbit and start building your on-chain reputation today.
          </p>
          <Link to="/app">
            <button className="btn-primary text-sm">Launch App to Get Started</button>
          </Link>
        </div>
      </section>
    </div>
  );
}
