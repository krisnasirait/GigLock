import { Link } from 'react-router-dom';

const footerLinks = {
  Product: ['Overview', 'Escrow', 'Reputation', 'For Clients'],
  Resources: ['Documentation', 'Guides', 'API Reference', 'GitHub'],
  Community: ['Twitter / X', 'Discord', 'Telegram', 'Forum'],
  Company: ['About', 'Careers', 'Brand Kit', 'Contact'],
  Legal: ['Terms of Service', 'Privacy Policy', 'Cookie Policy'],
};

export function Footer() {
  return (
    <footer className="bg-[#050b08] border-t border-[#10b981]/15">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-gradient-to-br from-[#10b981] to-[#059669] flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                <svg
                  className="w-4 h-4 text-slate-950"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <span className="font-black text-white text-lg tracking-tight">GigLock</span>
            </Link>
            <p className="text-xs text-white/40 leading-relaxed">
              Autonomous escrow and portable reputation for Web3 freelancers. Built on GIWA Sepolia.
            </p>
            <div className="flex gap-2.5 pt-2">
              {['X', '◆', 'G', '✈'].map((s, i) => (
                <a
                  key={i}
                  href="https://github.com/krisnasirait/GigLock"
                  target="_blank"
                  rel="noreferrer"
                  className="size-8 rounded-lg bg-[#0a1610] border border-[#10b981]/15 hover:border-[#10b981]/40 flex items-center justify-center text-white/50 hover:text-[#34d399] transition-all text-xs"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-bold text-[#10b981] uppercase tracking-widest mb-4">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-xs text-white/50 hover:text-white transition-colors font-medium"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-6 border-t border-[#10b981]/15 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            © 2026 GigLock Protocol. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30">Built on</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/20">
              <div className="size-2 rounded-full bg-[#10b981]" />
              <span className="text-xs text-[#34d399] font-bold">GIWA Chain</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
