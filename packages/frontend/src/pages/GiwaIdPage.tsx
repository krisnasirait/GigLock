import { Link } from 'react-router-dom';

const HOW_IT_WORKS = [
  {
    n: '01',
    title: 'Connect Your Wallet',
    desc: 'Link any EVM-compatible wallet (MetaMask, WalletConnect). Your wallet address becomes your GIWA ID anchor.',
    color: '#10b981',
  },
  {
    n: '02',
    title: 'Verify with Upbit KYC',
    desc: 'GigLock uses GIWA Dojang — a Soulbound attestation layer backed by Upbit KYC. One verification, portable everywhere.',
    color: '#34d399',
  },
  {
    n: '03',
    title: 'Earn Your On-Chain Reputation',
    desc: 'Complete jobs on-chain and your ReputationRegistry score updates automatically. No platform can take it away.',
    color: '#6ee7b7',
  },
  {
    n: '04',
    title: 'Use Everywhere in the Ecosystem',
    desc: 'Any platform built on GigLock reads your GIWA ID and score. One identity, every app.',
    color: '#059669',
  },
];

const SCORE_BREAKDOWN = [
  { label: 'On-Time Completion', weight: '40%', color: '#10b981', desc: 'Jobs completed before confirmation deadline' },
  { label: 'Average Rating', weight: '40%', color: '#34d399', desc: 'Client ratings averaged across completed jobs (1–5 stars)' },
  { label: 'Dispute-Free Bonus', weight: '20%', color: '#059669', desc: 'Max bonus of 20 pts, reduced by 5 per dispute received' },
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
    <div className="min-h-screen pt-28 pb-16 bg-[#050b08]">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 mb-20 text-center">
        <div className="inline-flex items-center gap-2 border border-[#10b981]/30 bg-[#10b981]/10 rounded-full px-4 py-1.5 mb-6">
          <div className="size-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-xs font-bold text-[#34d399] uppercase tracking-widest">Soulbound Identity</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">GIWA ID</h1>
        <p className="text-base sm:text-lg text-white/50 max-w-2xl mx-auto leading-relaxed">
          Your on-chain identity. Verified once, trusted everywhere. GIWA ID is a soulbound attestation
          that gates your reputation score and makes it Sybil-proof.
        </p>
      </section>

      {/* Score breakdown */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-6">Reliability Score — 0 to 100</h2>
        <div className="rounded-3xl border border-[#10b981]/20 bg-[#09140e] p-7">
          <div className="flex gap-1.5 h-3 rounded-full overflow-hidden mb-6 bg-black/40">
            {SCORE_BREAKDOWN.map((s) => (
              <div key={s.label} className="h-full rounded-full transition-all" style={{ width: s.weight, background: s.color }} />
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {SCORE_BREAKDOWN.map((s) => (
              <div key={s.label} className="flex gap-3">
                <div className="size-3 rounded-full mt-1.5 shrink-0" style={{ background: s.color }} />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white">{s.label}</span>
                    <span className="text-xs font-black" style={{ color: s.color }}>{s.weight}</span>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-5 border-t border-[#10b981]/15 rounded-2xl bg-[#07110c] px-5 py-4">
            <code className="text-xs text-[#34d399] font-mono leading-relaxed">
              {`score = (onTimeCount/jobs × 40) + (ratingSum/ratingCount/5 × 40) + (20 − disputesReceived × 5)`}
            </code>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-6">How Verification Works</h2>
        <div className="space-y-4">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.n} className="flex gap-5 items-start p-5 rounded-2xl bg-[#09140e] border border-[#10b981]/15">
              <div className="size-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0"
                   style={{ background: `${step.color}15`, color: step.color, border: `1px solid ${step.color}30` }}>
                {step.n}
              </div>
              <div>
                <div className="font-bold text-white text-base mb-1">{step.title}</div>
                <p className="text-sm text-white/50 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-6">Why GIWA ID?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-2xl border border-[#10b981]/15 bg-[#09140e] p-6 hover:border-[#10b981]/30 transition-all">
              <div className="text-3xl mb-3">{b.icon}</div>
              <div className="font-bold text-white text-base mb-1">{b.title}</div>
              <p className="text-xs text-white/40 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Dojang info */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <div className="rounded-3xl border border-[#10b981]/25 bg-[#09140e] p-7">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-2xl bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-2xl shrink-0">
              🥋
            </div>
            <div>
              <h3 className="font-bold text-white text-lg mb-2">Powered by GIWA Dojang</h3>
              <p className="text-sm text-white/50 leading-relaxed mb-3">
                GIWA Dojang is the attestation layer that backs GIWA ID. It issues a Soulbound Token
                to wallets that complete KYC through Upbit — the attester ID is stored on-chain and
                checked by ReputationRegistry on every write.
              </p>
              <a
                href="https://sepolia-explorer.giwa.io/address/0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono font-bold text-[#34d399] hover:underline"
              >
                DojangScroll: 0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9 ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6">
        <div className="rounded-3xl border border-[#10b981]/25 bg-[#09140e] p-8 text-center shadow-xl shadow-[#10b981]/5">
          <h3 className="text-2xl font-black text-white mb-3">Get your GIWA ID</h3>
          <p className="text-sm text-white/50 mb-6 max-w-lg mx-auto">
            Complete GIWA KYC through Upbit and start building your on-chain reputation today.
          </p>
          <Link to="/app">
            <button className="btn-primary text-xs">Launch App to Get Started</button>
          </Link>
        </div>
      </section>
    </div>
  );
}
