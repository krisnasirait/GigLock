import { ConnectButton } from "@rainbow-me/rainbowkit";

export function App() {
  return (
    <div className="min-h-screen bg-ink-900 bg-grid-glow">
      <header className="flex items-center justify-between px-8 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-gradient-to-br from-neon-blue to-neon-violet" />
          <span className="text-xl font-semibold">GigLock</span>
        </div>
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
      </header>

      <main className="max-w-5xl mx-auto px-8 py-16">
        <h1 className="text-5xl font-bold tracking-tight">
          The Trust Layer for the{" "}
          <span className="bg-gradient-to-r from-neon-blue to-neon-violet bg-clip-text text-transparent">
            Gig Economy
          </span>
        </h1>
        <p className="mt-4 text-lg text-white/70 max-w-2xl">
          Instant escrow payments. Portable reputation. Built on GIWA Chain.
        </p>

        <div className="mt-12 rounded-xl border border-white/10 bg-ink-800/50 p-6 text-sm text-white/60">
          <p>
            Scaffold base ready. Job board, post-job, and profile screens will be added in the next
            plan.
          </p>
        </div>
      </main>
    </div>
  );
}
