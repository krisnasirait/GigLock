import { Link } from 'react-router-dom';

const footerLinks = {
  Product: ['Overview', 'Escrow', 'Reputation', 'For Clients'],
  Resources: ['Documentation', 'Guides', 'API Reference', 'Blog'],
  Community: ['Twitter', 'Discord', 'GitHub', 'Forum'],
  Company: ['About', 'Careers', 'Contact'],
  Legal: ['Terms of Service', 'Privacy Policy', 'Cookie Policy'],
};

export function Footer() {
  return (
    <footer className="bg-[#030712] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="size-8 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#7c3aed] flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L4 6v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6l-8-4z" />
                </svg>
              </div>
              <span className="font-bold text-white">GigLock</span>
            </Link>
            <p className="text-xs text-white/40 leading-relaxed">
              On-chain escrow and portable reputation for the gig economy. Built on GIWA Chain.
            </p>
            <div className="flex gap-3 mt-4">
              {['X', '◆', 'G', '✈'].map((s, i) => (
                <a
                  key={i}
                  href="#"
                  className="size-7 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all text-xs"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-white/90 uppercase tracking-wider mb-4">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-xs text-white/40 hover:text-white/80 transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/25">
            © 2026 GigLock Protocol. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/25">Built on</span>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded bg-gradient-to-br from-[#3b82f6] to-[#7c3aed]" />
              <span className="text-xs text-white/50 font-medium">GIWA Chain</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
