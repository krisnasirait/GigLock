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
          ? 'bg-[#030712]/90 backdrop-blur-xl border-b border-white/5'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative size-9">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#7c3aed] opacity-80 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#7c3aed] blur-md opacity-40 group-hover:opacity-70 transition-opacity" />
            <svg
              className="absolute inset-0 w-full h-full p-2"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M12 2L4 6v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6l-8-4z"
                fill="white"
                opacity="0.9"
              />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight">GigLock</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`nav-link text-sm font-medium ${
                location.pathname === link.href ? 'text-white' : 'text-white/60'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Wallet connect */}
        <div className="hidden md:block">
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
        <div className="md:hidden bg-[#0a0e22]/95 backdrop-blur-xl border-t border-white/5 px-6 py-4 flex flex-col gap-4">
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
          <div className="pt-2">
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
          </div>
        </div>
      )}
    </nav>
  );
}
