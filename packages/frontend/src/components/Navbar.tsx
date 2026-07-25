import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const navLinks = [
  { label: 'Protocol', href: '/protocol' },
  { label: 'Ecosystem', href: '/ecosystem' },
  { label: 'Developers', href: '/developers' },
  { label: 'GIWA ID', href: '/giwa-id' },
  { label: 'Docs', href: '/docs' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#050b08]/90 backdrop-blur-xl border-b border-[#10b981]/15 shadow-lg shadow-black/40'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative size-9 flex items-center justify-center">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#10b981] to-[#059669] opacity-90 group-hover:opacity-100 transition-opacity shadow-[0_0_15px_rgba(16,185,129,0.4)]" />
            <div className="absolute inset-0 rounded-xl bg-[#10b981] blur-md opacity-30 group-hover:opacity-60 transition-opacity" />
            <svg
              className="relative size-5 text-slate-950"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-tight text-white group-hover:text-[#34d399] transition-colors">
              GigLock
            </span>
            <span className="text-[9px] font-bold text-[#10b981] tracking-widest uppercase -mt-1">
              Autonomous Escrow
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#08120d]/80 border border-[#10b981]/15 backdrop-blur-md">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                location.pathname === link.href
                  ? 'bg-[#10b981]/20 text-[#34d399] border border-[#10b981]/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Action items & Wallet */}
        <div className="hidden md:flex items-center gap-3">
          <Link to="/app">
            <button className="btn-primary text-xs px-5 py-2.5 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              Launch dApp
            </button>
          </Link>
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white/70 hover:text-white transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#07100c]/95 backdrop-blur-2xl border-t border-[#10b981]/15 px-6 py-5 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-white/70 hover:text-white text-sm font-medium transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 flex flex-col gap-3">
            <Link to="/app" onClick={() => setMobileOpen(false)}>
              <button className="btn-primary w-full text-xs py-3">
                Launch dApp
              </button>
            </Link>
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
          </div>
        </div>
      )}
    </nav>
  );
}
