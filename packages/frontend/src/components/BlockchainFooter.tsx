import { useEffect, useState } from 'react';

const BLOCK_TIME = 0.4;
const INITIAL_BLOCK = 9182741;

export function BlockchainFooter() {
  const [block, setBlock] = useState(INITIAL_BLOCK);
  const [gas, setGas] = useState('0.001');
  const [tps, setTps] = useState(3420);

  useEffect(() => {
    const interval = setInterval(() => {
      setBlock((b) => b + 1);
      setGas((parseFloat(gas) + (Math.random() * 0.0002 - 0.0001)).toFixed(4));
      setTps((t) => t + Math.floor(Math.random() * 20 - 10));
    }, 2000);
    return () => clearInterval(interval);
  }, [gas]);

  return (
    <div className="bg-[#040806] border-t border-[#10b981]/15">
      <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        {/* Chain info */}
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-xl bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.3)]">
            <svg className="w-4 h-4 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-black text-white tracking-tight">GIWA SEPOLIA</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="size-1.5 rounded-full bg-[#10b981] animate-pulse" />
              <span className="text-[10px] text-[#34d399] font-bold uppercase tracking-wider">Testnet · 91342</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 md:gap-10 flex-wrap">
          <Stat label="LATEST BLOCK" value={block.toLocaleString()} />
          <Stat label="BLOCK TIME" value={`${BLOCK_TIME}s`} />
          <Stat label="GAS PRICE" value={`${gas} GWEI`} />
          <Stat label="TPS" value={tps.toLocaleString()} />
        </div>

        {/* Social */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-[#10b981] tracking-widest uppercase hidden lg:block">CONNECT</span>
          {[
            { icon: 'X', href: 'https://github.com/krisnasirait/GigLock' },
            { icon: 'Discord', href: 'https://github.com/krisnasirait/GigLock' },
            { icon: 'GitHub', href: 'https://github.com/krisnasirait/GigLock' },
            { icon: 'Telegram', href: 'https://github.com/krisnasirait/GigLock' },
          ].map((s) => (
            <a
              key={s.icon}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="text-white/40 hover:text-[#34d399] transition-colors text-xs font-medium"
              title={s.icon}
            >
              <SocialIcon name={s.icon} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-[#10b981] uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-xs font-mono font-bold text-white">{value}</div>
    </div>
  );
}

function SocialIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    X: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.846L1.542 2.25H8.08l4.713 6.231zM17.083 20.001h1.832L7.084 4.126H5.117z" />
      </svg>
    ),
    Discord: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.11 18.13.149 18.197.205 18.24a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
      </svg>
    ),
    GitHub: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
    Telegram: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  };
  return icons[name] || null;
}
