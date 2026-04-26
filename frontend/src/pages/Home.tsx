import { useState } from 'react';
import InscriptionForm from '../components/inscription/InscriptionForm';

const tournamentDays = [
  {
    label: 'Samedi 16 mai 2026',
    role: 'Qualifications',
    detail: 'Check-in 14h00 — Manche 1 à 14h30 — 4 manches en lobbies de 8',
  },
  {
    label: 'Dimanche 17 mai 2026',
    role: 'Finale Top 8',
    detail: 'Check-in 14h00 — Manche 1 à 14h30 — Format matchpoint',
  },
];

const baremePoints = [
  { place: '1er', pts: 8 },
  { place: '2e', pts: 7 },
  { place: '3e', pts: 6 },
  { place: '4e', pts: 5 },
  { place: '5e', pts: 4 },
  { place: '6e', pts: 3 },
  { place: '7e', pts: 2 },
  { place: '8e', pts: 1 },
];

const cashPrize = [
  { place: '1er', amount: '25 €' },
  { place: '2e', amount: '15 €' },
  { place: '3e', amount: '10 €' },
];

const reglementSections = [
  {
    title: 'Format du tournoi',
    content:
      "Le Tournoi se déroule en deux jours. Le samedi 16 mai, 4 manches de qualification opposent l'ensemble des participants en lobbies de 8 (32 joueurs maximum). Les 8 meilleurs au classement cumulé sont qualifiés pour la finale du dimanche 17 mai.",
  },
  {
    title: 'Barème de points',
    content: null,
    isBareme: true,
  },
  {
    title: 'Système de redistribution des lobbies',
    content:
      "À chaque manche de qualification, les lobbies sont recomposés selon un principe proche du système suisse : les joueurs sont pondérés en fonction de leurs points acquis pour assurer des affrontements équilibrés.",
  },
  {
    title: 'Finale — règle du matchpoint',
    content:
      "Les 8 finalistes démarrent la finale à 0 point (les points des qualifications ne sont pas reportés). Le vainqueur est le premier joueur à remplir simultanément deux conditions : entamer la manche avec au minimum 20 points cumulés sur la finale ET la terminer à la 1ère place. Un joueur qui atteint 20 points sans Top 1 conserve son statut de matchpoint pour les manches suivantes.",
  },
  {
    title: 'Garde-fou de la finale',
    content:
      "Si aucun joueur n'a été sacré au bout de 6 manches, la règle du matchpoint est levée et le vainqueur est désigné au total de points cumulés. Cette disposition est un filet de sécurité.",
  },
  {
    title: 'Forfait, déconnexion, abandon',
    content:
      "Tout joueur n'ayant pas rejoint son lobby dans les 10 minutes suivant la diffusion du code est considéré forfait sur la manche (0 point). En cas de déconnexion ponctuelle, la partie se poursuit et le placement final fait foi. Un crash serveur Riot confirmé entraîne le rejeu de la manche. L'abandon volontaire est sanctionné d'une 8ème place.",
  },
  {
    title: 'Départage en cas d\'égalité',
    content:
      "Meilleur placement moyen sur l'ensemble des manches, puis meilleur placement sur la dernière manche disputée, puis tirage au sort par le staff EDS en dernier recours.",
  },
];

function AccordionItem({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = `accordion-${title.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="border-b border-eds-gray/30">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between py-4 text-left font-body text-lg font-medium text-eds-white transition-colors hover:text-eds-cyan"
      >
        {title}
        <span
          aria-hidden="true"
          className={`ml-2 text-eds-cyan transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </button>
      {open && (
        <div id={panelId} role="region" aria-label={title} className="pb-4 font-body text-eds-light/80 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <main>
      {/* Hero Section */}
      <section className="flex min-h-[80vh] flex-col items-center justify-center bg-eds-dark px-4 py-16 text-center">
        <h1 className="font-heading text-4xl text-eds-white md:text-6xl lg:text-8xl">
          Tournoi TFT
        </h1>
        <p className="mt-1 font-heading text-2xl text-eds-cyan md:text-3xl lg:text-4xl">
          Esport des Sacres
        </p>
        <p className="mt-2 font-body text-lg text-eds-gold md:text-xl">
          Set 17 — Défi Cosmique
        </p>
        <p className="mt-1 font-body text-sm text-eds-light/70">
          16 &amp; 17 mai 2026 • En ligne (EUW) • 32 joueurs max • Inscription gratuite
        </p>

        {/* Infos essentielles */}
        <div className="mt-12 grid w-full max-w-4xl gap-6 md:grid-cols-3">
          {/* Dates */}
          <div className="rounded-lg border border-eds-cyan/20 bg-eds-dark p-6 shadow-lg shadow-eds-cyan/5">
            <h2 className="font-heading text-2xl text-eds-cyan">Dates</h2>
            <ul className="mt-4 space-y-3 font-body text-sm text-eds-light/80">
              {tournamentDays.map((d) => (
                <li key={d.label}>
                  <span className="font-medium text-eds-white">{d.label}</span>
                  <br />
                  <span className="text-eds-gold">{d.role}</span>
                  <br />
                  <span className="text-eds-light/60">{d.detail}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Format */}
          <div className="rounded-lg border border-eds-cyan/20 bg-eds-dark p-6 shadow-lg shadow-eds-cyan/5">
            <h2 className="font-heading text-2xl text-eds-cyan">Format</h2>
            <ul className="mt-4 space-y-3 font-body text-sm text-eds-light/80">
              <li>
                <span className="font-medium text-eds-white">Qualifications</span>
                <br />
                4 manches en lobbies de 8
              </li>
              <li>
                <span className="font-medium text-eds-white">Redistribution</span>
                <br />
                Système suisse pondéré aux points
              </li>
              <li>
                <span className="font-medium text-eds-white">Finale Top 8</span>
                <br />
                Lobby unique • Matchpoint à 20 pts + Top 1
              </li>
            </ul>
          </div>

          {/* Cash Prize */}
          <div className="rounded-lg border border-eds-gold/30 bg-eds-dark p-6 shadow-lg shadow-eds-gold/5">
            <h2 className="font-heading text-2xl text-eds-gold">Cash Prize</h2>
            <p className="mt-3 font-heading text-3xl text-eds-gold">50 €</p>
            <ul className="mt-3 space-y-1 font-body text-sm text-eds-light/80">
              {cashPrize.map((p) => (
                <li key={p.place} className="flex justify-between">
                  <span>{p.place}</span>
                  <span className="font-medium text-eds-gold">{p.amount}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-body text-xs text-eds-light/50">
              Virement bancaire ou PayPal
            </p>
          </div>
        </div>

        {/* Stream */}
        <p className="mt-10 font-body text-sm text-eds-light/70">
          Diffusion en direct sur la chaîne de{' '}
          <span className="text-eds-cyan">Skydow</span> les deux jours du Tournoi.
        </p>
      </section>

      {/* Section Inscription */}
      <section id="inscription" className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="mb-2 text-center font-heading text-3xl text-eds-cyan md:text-4xl">
          Inscription
        </h2>
        <p className="mb-8 text-center font-body text-sm text-eds-light/70">
          Clôture dès 32 inscrits ou jeudi 14 mai 2026 à 14h00
        </p>
        <InscriptionForm />
      </section>

      {/* Section Règlement */}
      <section id="reglement" className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="mb-2 text-center font-heading text-3xl text-eds-white md:text-4xl">
          Règlement
        </h2>
        <p className="mb-8 text-center font-body text-sm text-eds-light/70">
          Synthèse — la version intégrale fait foi.{' '}
          <a
            href="/reglement.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-eds-cyan hover:underline"
          >
            Télécharger le règlement complet (PDF)
          </a>
        </p>
        <div className="rounded-lg border border-eds-gray/20 bg-eds-dark p-6">
          {reglementSections.map((section) => (
            <AccordionItem key={section.title} title={section.title}>
              {section.isBareme ? (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {baremePoints.map((b) => (
                    <div
                      key={b.place}
                      className="flex flex-col items-center rounded bg-eds-dark border border-eds-cyan/20 p-2"
                    >
                      <span className="font-heading text-lg text-eds-cyan">{b.place}</span>
                      <span className="font-body text-sm font-bold text-eds-gold">{b.pts} pts</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>{section.content}</p>
              )}
            </AccordionItem>
          ))}
        </div>
      </section>
    </main>
  );
}
