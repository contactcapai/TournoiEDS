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
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-body text-xs text-eds-gray/60">
            <Link
              to="/mentions-legales"
              className="hover:text-eds-cyan transition-colors"
            >
              Mentions légales
            </Link>
            <a
              href="/reglement.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-eds-cyan transition-colors"
            >
              Règlement (PDF)
            </a>
          </div>
          <p className="mx-auto mt-3 max-w-2xl font-body text-[11px] italic text-eds-gray/50 leading-relaxed">
            Ce tournoi n'est ni organisé ni soutenu par Riot Games, Inc. Teamfight Tactics
            est une marque déposée de Riot Games, Inc. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
