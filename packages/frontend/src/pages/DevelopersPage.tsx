import { useState } from 'react';
import { Link } from 'react-router-dom';

const ABI_SNIPPETS = {
  createJob: `// JobFactory — createJob
// milestoneAmounts: USDC amounts in 6-decimal units
// metadataCid: IPFS CID of JobMetadataV1 JSON
await jobFactory.write.createJob([
  [parseUnits("100", 6), parseUnits("50", 6)],
  "bafybeig..." // IPFS CID
]);`,
  submitMilestone: `// EscrowJob — submitMilestone
// proofHash: keccak256 of the uploaded file bytes
// proofCid: IPFS CID returned by the relayer
await escrowJob.write.submitMilestone([
  0n,           // milestoneId
  proofHash,    // 0x...32 bytes
  "bafybeip..." // IPFS CID
]);`,
  score: `// ReputationRegistry — read score
// Returns 0-100 on-chain reliability score
const score = await registry.read.reliabilityScore([
  "0xWorkerAddress"
]);
// 40% on-time + 40% rating + 20% dispute-free`,
};

const SDKS = [
  { lang: 'TypeScript / viem', icon: '🟦', note: 'First-class support — all ABIs shipped in @giglock/shared' },
  { lang: 'wagmi React hooks', icon: '⚛️', note: 'Use useReadContract / useWriteContract with exported ABIs' },
  { lang: 'ethers.js v6', icon: '🟨', note: 'Import ABIs from @giglock/shared — compatible out of the box' },
  { lang: 'Python (web3.py)', icon: '🐍', note: 'Use the ABI JSON from packages/shared/src/abis/ directly' },
];

const ENDPOINTS = [
  { method: 'GET', path: '/health', desc: 'Relayer health check. Returns 200 + { ok: true }.' },
  { method: 'POST', path: '/ipfs/pin', desc: 'Multipart upload (max 10 MiB). Returns { cid, url, size }.' },
];

const ADDRESSES = [
  { label: 'JobFactory', addr: '0xb01fDC7B8df1A5E4f7F843046f734C6fD622DDFF' },
  { label: 'ReputationRegistry', addr: '0xE8BCF79C93d40565DdCFaAE4bA3d9a24C7dC8B6E' },
  { label: 'Arbiter', addr: '0xEC61bf4e000B72B8a4f94556B608e03673Df629E' },
  { label: 'MockUSDC', addr: '0xf5d40D37cA17eC7e5a2e4Ae170e4deF0e57B99eb' },
  { label: 'MockUSDCFaucet', addr: '0xc04f1831C8821a5eff267c6cB4D7e6ba847b5A9b' },
];

type TabKey = 'createJob' | 'submitMilestone' | 'score';

export function DevelopersPage() {
  const [tab, setTab] = useState<TabKey>('createJob');

  return (
    <div className="min-h-screen pt-24 pb-16">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 mb-20 text-center">
        <div className="inline-flex items-center gap-2 border border-[#f59e0b]/30 bg-[#f59e0b]/5 rounded-full px-4 py-1.5 mb-6">
          <div className="size-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
          <span className="text-xs font-semibold text-[#f59e0b] uppercase tracking-widest">Open Protocol</span>
        </div>
        <h1 className="text-5xl font-black text-white mb-4">Build on GigLock</h1>
        <p className="text-lg text-white/50 max-w-2xl mx-auto">
          Integrate trustless escrow payments into any platform. Use our ABIs, relayer API,
          and shared TypeScript types to ship in hours.
        </p>
      </section>

      {/* Quick start */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-6">Quick Start</h2>
        <div className="rounded-xl border border-white/5 bg-[#070c1e] overflow-hidden">
          <div className="flex border-b border-white/5">
            {(Object.keys(ABI_SNIPPETS) as TabKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-5 py-3 text-xs font-semibold transition-all ${
                  tab === k
                    ? 'text-[#f59e0b] border-b-2 border-[#f59e0b]'
                    : 'text-white/30 hover:text-white/60'
                }`}
              >
                {k}()
              </button>
            ))}
          </div>
          <pre className="p-6 text-sm text-[#22d3ee] overflow-x-auto leading-relaxed">
            <code>{ABI_SNIPPETS[tab]}</code>
          </pre>
        </div>
      </section>

      {/* Contract addresses */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-6">
          GIWA Sepolia — Chain 91342
        </h2>
        <div className="rounded-xl border border-white/5 bg-[#0a0e22]/60 overflow-hidden divide-y divide-white/5">
          {ADDRESSES.map((a) => (
            <div key={a.label} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-all">
              <span className="text-sm font-semibold text-white">{a.label}</span>
              <a
                href={`https://sepolia-explorer.giwa.io/address/${a.addr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-white/40 hover:text-[#f59e0b] transition-colors flex items-center gap-1.5"
              >
                {a.addr}
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                </svg>
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Relayer API */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-6">Relayer API</h2>
        <div className="space-y-3 mb-6">
          {ENDPOINTS.map((e) => (
            <div key={e.path} className="flex items-center gap-4 rounded-xl border border-white/5 bg-[#0a0e22]/60 p-4">
              <span className={`text-xs font-black px-2 py-1 rounded font-mono shrink-0 ${
                e.method === 'GET' ? 'bg-[#10b981]/15 text-[#10b981]' : 'bg-[#f59e0b]/15 text-[#f59e0b]'
              }`}>
                {e.method}
              </span>
              <code className="text-sm text-[#22d3ee] font-mono">{e.path}</code>
              <span className="text-sm text-white/40">{e.desc}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/5 bg-[#070c1e] p-5">
          <div className="text-xs text-white/30 mb-3 uppercase tracking-widest">Upload evidence example</div>
          <pre className="text-sm text-[#22d3ee] overflow-x-auto leading-relaxed"><code>{`const form = new FormData();
form.append("file", fileBlob, "proof.pdf");

const res = await fetch(\`\${RELAYER_URL}/ipfs/pin\`, {
  method: "POST",
  body: form,
});
const { cid } = await res.json();
// cid → "bafybeig..." — use as proofCid on-chain`}</code></pre>
        </div>
      </section>

      {/* SDKs */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-6">Language Support</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {SDKS.map((s) => (
            <div key={s.lang} className="flex gap-3 rounded-xl border border-white/5 bg-[#0a0e22]/60 p-4">
              <span className="text-2xl shrink-0">{s.icon}</span>
              <div>
                <div className="font-semibold text-white text-sm mb-1">{s.lang}</div>
                <p className="text-xs text-white/40">{s.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6">
        <div className="rounded-2xl border border-[#f59e0b]/20 bg-[#f59e0b]/5 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Open source, forkable, auditable.</h3>
            <p className="text-sm text-white/50">All contracts, tests, and frontend code on GitHub under MIT.</p>
          </div>
          <a href="https://github.com/krisnasirait/GigLock" target="_blank" rel="noopener noreferrer">
            <button className="btn-primary text-sm flex items-center gap-2">
              View on GitHub ↗
            </button>
          </a>
        </div>
      </section>
    </div>
  );
}
