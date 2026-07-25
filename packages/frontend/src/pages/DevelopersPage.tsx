import { useState } from 'react';

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
  { lang: 'TypeScript / viem', icon: '🟢', note: 'First-class support — all ABIs shipped in @giglock/shared' },
  { lang: 'wagmi React hooks', icon: '⚛️', note: 'Use useReadContract / useWriteContract with exported ABIs' },
  { lang: 'ethers.js v6', icon: '⚡', note: 'Import ABIs from @giglock/shared — compatible out of the box' },
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
    <div className="min-h-screen pt-28 pb-16 bg-[#050b08]">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 mb-20 text-center">
        <div className="inline-flex items-center gap-2 border border-[#10b981]/30 bg-[#10b981]/10 rounded-full px-4 py-1.5 mb-6">
          <div className="size-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-xs font-bold text-[#34d399] uppercase tracking-widest">Open Protocol</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">Build on GigLock</h1>
        <p className="text-base sm:text-lg text-white/50 max-w-2xl mx-auto leading-relaxed">
          Integrate trustless escrow payments into any platform. Use our ABIs, relayer API,
          and shared TypeScript types to ship in hours.
        </p>
      </section>

      {/* Quick start */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-6">Quick Start</h2>
        <div className="rounded-2xl border border-[#10b981]/20 bg-[#07110c] overflow-hidden">
          <div className="flex border-b border-[#10b981]/15 bg-[#050b08]">
            {(Object.keys(ABI_SNIPPETS) as TabKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-5 py-3.5 text-xs font-bold transition-all ${
                  tab === k
                    ? 'text-[#34d399] border-b-2 border-[#10b981] bg-[#10b981]/10'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {k}()
              </button>
            ))}
          </div>
          <pre className="p-6 text-sm text-[#34d399] font-mono overflow-x-auto leading-relaxed">
            <code>{ABI_SNIPPETS[tab]}</code>
          </pre>
        </div>
      </section>

      {/* Contract addresses */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-6">
          GIWA Sepolia — Chain 91342
        </h2>
        <div className="rounded-2xl border border-[#10b981]/15 bg-[#09140e] overflow-hidden divide-y divide-[#10b981]/10">
          {ADDRESSES.map((a) => (
            <div key={a.label} className="flex items-center justify-between px-6 py-4 hover:bg-[#10b981]/5 transition-all">
              <span className="text-sm font-bold text-white">{a.label}</span>
              <a
                href={`https://sepolia-explorer.giwa.io/address/${a.addr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-[#34d399] hover:underline transition-colors flex items-center gap-1.5"
              >
                {a.addr}
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                </svg>
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Relayer API */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-6">Relayer API</h2>
        <div className="space-y-3 mb-6">
          {ENDPOINTS.map((e) => (
            <div key={e.path} className="flex items-center gap-4 rounded-2xl border border-[#10b981]/15 bg-[#09140e] p-4">
              <span className={`text-xs font-black px-2.5 py-1 rounded-full font-mono shrink-0 ${
                e.method === 'GET' ? 'bg-[#10b981]/20 text-[#34d399]' : 'bg-[#10b981]/30 text-white'
              }`}>
                {e.method}
              </span>
              <code className="text-sm text-[#34d399] font-mono">{e.path}</code>
              <span className="text-sm text-white/40">{e.desc}</span>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-[#10b981]/20 bg-[#07110c] p-6">
          <div className="text-xs text-[#10b981] font-bold mb-3 uppercase tracking-widest">Upload evidence example</div>
          <pre className="text-sm text-[#34d399] font-mono overflow-x-auto leading-relaxed"><code>{`const form = new FormData();
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
        <h2 className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-6">Language Support</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {SDKS.map((s) => (
            <div key={s.lang} className="flex gap-4 rounded-2xl border border-[#10b981]/15 bg-[#09140e] p-5">
              <span className="text-2xl shrink-0">{s.icon}</span>
              <div>
                <div className="font-bold text-white text-base mb-1">{s.lang}</div>
                <p className="text-xs text-white/40 leading-relaxed">{s.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6">
        <div className="rounded-3xl border border-[#10b981]/25 bg-[#09140e] p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-[#10b981]/5">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Open source, forkable, auditable.</h3>
            <p className="text-sm text-white/50">All contracts, tests, and frontend code on GitHub under MIT.</p>
          </div>
          <a href="https://github.com/krisnasirait/GigLock" target="_blank" rel="noopener noreferrer">
            <button className="btn-primary text-xs flex items-center gap-2">
              View on GitHub ↗
            </button>
          </a>
        </div>
      </section>
    </div>
  );
}
