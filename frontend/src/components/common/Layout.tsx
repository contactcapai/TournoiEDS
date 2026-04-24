import { Link, useLocation } from 'react-router';

const navLinks = [
  { to: '/', label: 'Accueil' },
  { to: '/qualifications', label: 'Qualifications' },
  { to: '/finale', label: 'Finale' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex min-h-svh flex-col bg-eds-dark">
      {/* Header */}
      <header className="border-b border-eds-gray/20 bg-eds-dark">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-heading text-xl text-eds-white hover:text-eds-cyan transition-colors">
            Tournoi TFT — EDS
          </Link>
          <nav className="flex gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`font-body text-sm transition-colors ${
                  location.pathname === link.to
                    ? 'text-eds-cyan'
                    : 'text-eds-light/70 hover:text-eds-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1">{children}</div>

      {/* Footer */}
      <footer className="border-t border-eds-gray/20 bg-eds-dark">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center">
          <p className="font-body text-sm text-eds-gray">
            Tournoi TFT — Esport des Sacres &copy; 2026
          </p>
          <Link
            to="/mentions-legales"
            className="mt-1 inline-block font-body text-xs text-eds-gray/60 hover:text-eds-cyan transition-colors"
          >
            Mentions légales
          </Link>
        </div>
      </footer>
    </div>
  );
}
