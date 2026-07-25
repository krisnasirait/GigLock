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
    badgeColor: '#34d399',
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
    badgeColor: '#059669',
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
    <div className="min-h-screen pt-28 pb-16 bg-[#050b08]">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 mb-20 text-center">
        <div className="inline-flex items-center gap-2 border border-[#10b981]/30 bg-[#10b981]/10 rounded-full px-4 py-1.5 mb-6">
          <div className="size-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-xs font-bold text-[#34d399] uppercase tracking-widest">Documentation</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-4">GigLock Docs</h1>
        <p className="text-base sm:text-lg text-white/50 max-w-2xl mx-auto leading-relaxed">
          Step-by-step guides for clients, workers, and developers integrating the GigLock protocol.
        </p>
      </section>

      {/* Guides */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <h2 className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-6">Guides</h2>
        <div className="flex gap-6 flex-col md:flex-row">
          {/* Sidebar */}
          <div className="md:w-60 shrink-0 space-y-2">
            {GUIDES.map((g, i) => (
              <button
                key={g.id}
                onClick={() => setActiveGuide(i)}
                className={`w-full text-left px-4 py-3.5 rounded-2xl text-sm transition-all border ${
                  activeGuide === i
                    ? 'bg-[#10b981]/15 text-white border-[#10b981]/35 shadow-lg shadow-[#10b981]/5'
                    : 'bg-[#09140e] border-[#10b981]/10 text-white/50 hover:text-white hover:border-[#10b981]/25'
                }`}
              >
                <div className="font-bold leading-tight mb-1">{g.title}</div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${g.badgeColor}20`, color: g.badgeColor, border: `1px solid ${g.badgeColor}30` }}>
                    {g.badge}
                  </span>
                  <span className="text-[10px] text-white/30 font-medium">{g.time}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 rounded-3xl border border-[#10b981]/20 bg-[#09140e] p-7">
            <h3 className="text-xl font-bold text-white mb-6">{GUIDES[activeGuide]?.title}</h3>
            <div className="space-y-6">
              {(GUIDES[activeGuide]?.sections ?? []).map((s) => (
                <div key={s.heading}>
                  <h4 className="font-bold text-white text-base mb-2">{s.heading}</h4>
                  <p className="text-sm text-white/50 leading-relaxed mb-3">{s.body}</p>
                  {s.code && (
                    <pre className="rounded-2xl bg-[#07110c] border border-[#10b981]/20 p-4 text-xs text-[#34d399] font-mono overflow-x-auto">
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
        <h2 className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-6">FAQ</h2>
        <div className="space-y-3">
          {FAQ.map((f, i) => (
            <div key={i} className="rounded-2xl border border-[#10b981]/15 bg-[#09140e] overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4.5 text-left hover:bg-[#10b981]/5 transition-colors"
              >
                <span className="font-bold text-white text-sm sm:text-base">{f.q}</span>
                <span className="text-lg font-bold text-[#10b981] ml-4">
                  {openFaq === i ? '−' : '+'}
                </span>
              </button>
              {openFaq === i && (
                <div className="px-6 pb-5 text-sm text-white/50 leading-relaxed border-t border-[#10b981]/10 pt-3">
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
          <Link to="/protocol" className="group rounded-2xl border border-[#10b981]/15 bg-[#09140e] p-6 hover:border-[#10b981]/35 transition-all">
            <div className="text-3xl mb-3">⚙️</div>
            <div className="font-bold text-white text-base mb-1 group-hover:text-[#34d399] transition-colors">Protocol →</div>
            <p className="text-xs text-white/40 leading-relaxed">Contract mechanics and security model</p>
          </Link>
          <Link to="/developers" className="group rounded-2xl border border-[#10b981]/15 bg-[#09140e] p-6 hover:border-[#10b981]/35 transition-all">
            <div className="text-3xl mb-3">🛠️</div>
            <div className="font-bold text-white text-base mb-1 group-hover:text-[#34d399] transition-colors">Developers →</div>
            <p className="text-xs text-white/40 leading-relaxed">ABIs, relayer API, and code examples</p>
          </Link>
          <Link to="/giwa-id" className="group rounded-2xl border border-[#10b981]/15 bg-[#09140e] p-6 hover:border-[#10b981]/35 transition-all">
            <div className="text-3xl mb-3">🪪</div>
            <div className="font-bold text-white text-base mb-1 group-hover:text-[#34d399] transition-colors">GIWA ID →</div>
            <p className="text-xs text-white/40 leading-relaxed">Soulbound identity and reputation score</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
