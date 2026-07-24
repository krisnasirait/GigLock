import { useState } from 'react';
import { Link } from 'react-router-dom';

const GUIDES = [
  {
    id: 'quickstart',
    title: 'Quickstart: Create a Job',
    badge: 'Beginner',
    badgeColor: '#10b981',
    time: '5 min',
    sections: [
      {
        heading: '1. Get MockUSDC from the Faucet',
        body: 'Navigate to the app dashboard and click "Claim 1000 USDC". This calls the MockUSDCFaucet contract and mints test USDC to your wallet. You can only claim once per 24h per address.',
        code: null,
      },
      {
        heading: '2. Create a Job',
        body: 'Click "Post a Job" → fill in the title, description, and milestone amounts in USDC. Each milestone is a separate on-chain payment. Upload completes first, then you approve USDC spend and fund the contract.',
        code: null,
      },
      {
        heading: '3. Wait for a Worker',
        body: 'Your job is now visible in the "Available" tab. Any wallet with a GIWA ID can accept it. Once accepted, the worker wallet is locked to the contract.',
        code: null,
      },
      {
        heading: '4. Confirm or Dispute',
        body: 'When the worker submits proof (IPFS link + on-chain hash), you have 48 hours to confirm or raise a dispute. If you take no action, the worker can auto-release after the deadline.',
        code: null,
      },
    ],
  },
  {
    id: 'worker',
    title: 'Worker Guide: Accept & Get Paid',
    badge: 'Beginner',
    badgeColor: '#10b981',
    time: '5 min',
    sections: [
      {
        heading: '1. Browse Available Jobs',
        body: 'The "Available" tab shows all funded, unassigned jobs. Click any job card to see the full description, milestones, and IPFS-hosted metadata.',
        code: null,
      },
      {
        heading: '2. Accept the Job',
        body: 'Click "Accept Job" on a job detail page. This calls acceptJob() on the EscrowJob contract. Your wallet address is now locked as the worker — no one else can claim.',
        code: null,
      },
      {
        heading: '3. Submit Milestone Proof',
        body: 'When your milestone work is done, upload a proof file (PDF, image, zip — up to 10 MiB). The file is pinned to IPFS via the relayer and a keccak256 hash is computed. Both the hash and CID are stored on-chain.',
        code: null,
      },
      {
        heading: '4. Get Paid',
        body: 'When the client confirms, USDC transfers directly from the EscrowJob contract to your wallet. If they don\'t respond in 48h, click "Claim Timeout" to auto-release.',
        code: null,
      },
    ],
  },
  {
    id: 'integrate',
    title: 'Integration: Add GigLock to Your App',
    badge: 'Advanced',
    badgeColor: '#f59e0b',
    time: '20 min',
    sections: [
      {
        heading: '1. Install Dependencies',
        body: 'Add the shared types package and viem to your project:',
        code: 'pnpm add @giglock/shared viem wagmi',
      },
      {
        heading: '2. Import ABIs and Addresses',
        body: 'Use the pre-generated typed ABIs and chain addresses:',
        code: `import { JobFactoryAbi } from "@giglock/shared/abis";
import { GIWA_SEPOLIA_ADDRESSES } from "@giglock/shared/addresses";`,
      },
      {
        heading: '3. Read Factory State',
        body: 'List all jobs and batch-read their status:',
        code: `const jobs = await publicClient.readContract({
  address: GIWA_SEPOLIA_ADDRESSES.jobFactory,
  abi: JobFactoryAbi,
  functionName: "getJobsByClient",
  args: [clientAddress],
});`,
      },
      {
        heading: '4. Create a Job',
        body: 'Call createJob with milestone amounts and a metadata CID from IPFS:',
        code: `await walletClient.writeContract({
  address: GIWA_SEPOLIA_ADDRESSES.jobFactory,
  abi: JobFactoryAbi,
  functionName: "createJob",
  args: [
    [parseUnits("100", 6), parseUnits("50", 6)],
    "bafybeig...", // IPFS CID from your upload
  ],
});`,
      },
    ],
  },
];

const FAQ = [
  {
    q: 'What token does GigLock use?',
    a: 'MockUSDC on GIWA Sepolia testnet — a 6-decimal ERC-20 that behaves identically to USDC. On mainnet this will be replaced with real USDC.',
  },
  {
    q: 'What happens if a worker disappears?',
    a: 'After a milestone is submitted, the client has 48 hours to confirm or dispute. If neither happens, the worker can call claimTimeout() to auto-release. If the worker never submits, the client can cancel the job before it is funded.',
  },
  {
    q: 'How is the proof stored?',
    a: 'The proof file is uploaded to IPFS via the GigLock relayer (backed by Filebase). The CID and keccak256 hash are stored on-chain in the EscrowJob contract. Anyone can verify the file matches the hash.',
  },
  {
    q: 'Can I have multiple milestones?',
    a: 'Yes — 1 to 10 milestones per job. Each milestone is funded independently when the job is funded, and released independently on confirmation.',
  },
  {
    q: 'Do I need a GIWA ID to use GigLock?',
    a: 'To post or accept jobs: yes, for reputation writes (GIWA Dojang gate). To browse jobs or view data: no wallet needed.',
  },
  {
    q: 'Is GigLock audited?',
    a: 'The contracts are currently on testnet and pending external audit before mainnet launch.',
  },
];

export function DocsPage() {
  const [activeGuide, setActiveGuide] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen pt-24 pb-16">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 mb-20 text-center">
        <div className="inline-flex items-center gap-2 border border-[#22d3ee]/30 bg-[#22d3ee]/5 rounded-full px-4 py-1.5 mb-6">
          <div className="size-1.5 rounded-full bg-[#22d3ee] animate-pulse" />
          <span className="text-xs font-semibold text-[#22d3ee] uppercase tracking-widest">Documentation</span>
        </div>
        <h1 className="text-5xl font-black text-white mb-4">GigLock Docs</h1>
        <p className="text-lg text-white/50 max-w-2xl mx-auto">
          Step-by-step guides for clients, workers, and developers integrating the GigLock protocol.
        </p>
      </section>

      {/* Guides */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-6">Guides</h2>
        <div className="flex gap-6 flex-col md:flex-row">
          {/* Sidebar */}
          <div className="md:w-56 shrink-0 space-y-1.5">
            {GUIDES.map((g, i) => (
              <button
                key={g.id}
                onClick={() => setActiveGuide(i)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${
                  activeGuide === i
                    ? 'bg-white/5 text-white border border-white/10'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.02]'
                }`}
              >
                <div className="font-semibold leading-tight mb-1">{g.title}</div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ background: `${g.badgeColor}15`, color: g.badgeColor }}>
                    {g.badge}
                  </span>
                  <span className="text-[10px] text-white/25">{g.time}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 rounded-2xl border border-white/5 bg-[#0a0e22]/60 p-6">
            <h3 className="text-xl font-bold text-white mb-6">{GUIDES[activeGuide]?.title}</h3>
            <div className="space-y-6">
              {(GUIDES[activeGuide]?.sections ?? []).map((s) => (
                <div key={s.heading}>
                  <h4 className="font-semibold text-white mb-2">{s.heading}</h4>
                  <p className="text-sm text-white/50 leading-relaxed mb-3">{s.body}</p>
                  {s.code && (
                    <pre className="rounded-xl bg-[#070c1e] border border-white/5 p-4 text-xs text-[#22d3ee] overflow-x-auto">
                      <code>{s.code}</code>
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-6">FAQ</h2>
        <div className="space-y-2">
          {FAQ.map((f, i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-[#0a0e22]/60 overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-all"
              >
                <span className="font-semibold text-white text-sm">{f.q}</span>
                <svg
                  className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm text-white/45 leading-relaxed border-t border-white/5 pt-3">
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Quick links */}
      <section className="max-w-5xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-4">
          <Link to="/protocol" className="group rounded-xl border border-white/5 bg-[#0a0e22]/60 p-5 hover:border-[#3b82f6]/30 transition-all">
            <div className="text-2xl mb-3">⚙️</div>
            <div className="font-semibold text-white text-sm mb-1 group-hover:text-[#3b82f6] transition-colors">Protocol →</div>
            <p className="text-xs text-white/40">Contract mechanics and security model</p>
          </Link>
          <Link to="/developers" className="group rounded-xl border border-white/5 bg-[#0a0e22]/60 p-5 hover:border-[#f59e0b]/30 transition-all">
            <div className="text-2xl mb-3">🛠️</div>
            <div className="font-semibold text-white text-sm mb-1 group-hover:text-[#f59e0b] transition-colors">Developers →</div>
            <p className="text-xs text-white/40">ABIs, relayer API, and code examples</p>
          </Link>
          <Link to="/giwa-id" className="group rounded-xl border border-white/5 bg-[#0a0e22]/60 p-5 hover:border-[#8b5cf6]/30 transition-all">
            <div className="text-2xl mb-3">🪪</div>
            <div className="font-semibold text-white text-sm mb-1 group-hover:text-[#8b5cf6] transition-colors">GIWA ID →</div>
            <p className="text-xs text-white/40">Soulbound identity and reputation score</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
