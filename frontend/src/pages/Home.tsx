import { useState } from 'react';
import InscriptionForm from '../components/inscription/InscriptionForm';

const qualificationDates = [
  { label: 'Journée 1', date: 'Dimanche 17 mai 2026' },
  { label: 'Journée 2', date: 'Dimanche 24 mai 2026' },
  { label: 'Journée 3', date: 'Dimanche 31 mai 2026' },
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

const reglementSections = [
  {
    title: 'Format du tournoi',
    content:
      'Le tournoi se compose de 3 journées de qualifications suivies d\'une finale. Chaque journée de qualification comprend jusqu\'à 6 rounds. Les 8 meilleurs joueurs au classement cumulé se qualifient pour la finale.',
  },
  {
    title: 'Barème de points',
    content: null,
    isBareme: true,
  },
  {
    title: 'Système suisse',
    content:
      'À chaque round, les joueurs sont répartis en lobbies de 8 par classement. Le lobby 1 regroupe les joueurs classés 1 à 8, le lobby 2 les joueurs classés 9 à 16, etc. Cette redistribution assure des matchs équilibrés tout au long de la journée.',
  },
  {
    title: 'Condition de victoire en finale',
    content:
      'La finale se joue en lobby unique (top 8). Les rounds se poursuivent jusqu\'à ce qu\'un joueur termine 1er d\'un round AVEC un cumul de 20 points ou plus. Ce joueur est déclaré vainqueur du tournoi.',
  },
  {
    title: 'Gestion des drops',
    content:
      'Un joueur peut se retirer (drop) à tout moment entre deux rounds. Il conserve ses points acquis au classement cumulé mais ne participe plus aux rounds suivants de la journée.',
  },
  {
    title: 'Nombre de rounds',
    content:
      'Chaque journée de qualification comprend un maximum de 6 rounds. La finale n\'a pas de limite de rounds : elle continue jusqu\'à ce que la condition de victoire soit remplie.',
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
          Set 17 — Saison 2026
        </p>

        {/* Infos essentielles */}
        <div className="mt-12 grid w-full max-w-4xl gap-6 md:grid-cols-3">
          {/* Dates */}
          <div className="rounded-lg border border-eds-cyan/20 bg-eds-dark p-6 shadow-lg shadow-eds-cyan/5">
            <h2 className="font-heading text-2xl text-eds-cyan">Dates</h2>
            <ul className="mt-4 space-y-2 font-body text-sm text-eds-light/80">
              {qualificationDates.map((d) => (
                <li key={d.label}>
                  <span className="font-medium text-eds-white">{d.label}</span>
                  <br />
                  {d.date}
                </li>
              ))}
              <li>
                <span className="font-medium text-eds-gold">Finale</span>
                <br />
                Date à confirmer
              </li>
            </ul>
          </div>

          {/* Format */}
          <div className="rounded-lg border border-eds-cyan/20 bg-eds-dark p-6 shadow-lg shadow-eds-cyan/5">
            <h2 className="font-heading text-2xl text-eds-cyan">Format</h2>
            <ul className="mt-4 space-y-3 font-body text-sm text-eds-light/80">
              <li>
                <span className="font-medium text-eds-white">Qualifications</span>
                <br />
                3 journées × 6 rounds max
              </li>
              <li>
                <span className="font-medium text-eds-white">Système suisse</span>
                <br />
                Lobbies de 8, redistribution par classement
              </li>
              <li>
                <span className="font-medium text-eds-white">Finale</span>
                <br />
                Top 8, lobby unique, rounds illimités
              </li>
            </ul>
          </div>

          {/* Cash Prize */}
          <div className="rounded-lg border border-eds-gold/30 bg-eds-dark p-6 shadow-lg shadow-eds-gold/5">
            <h2 className="font-heading text-2xl text-eds-gold">Cash Prize</h2>
            <p className="mt-4 font-heading text-4xl text-eds-gold">
              À venir
            </p>
            <p className="mt-2 font-body text-sm text-eds-light/60">
              Détails communiqués prochainement
            </p>
          </div>
        </div>
      </section>

      {/* Section Inscription */}
      <section id="inscription" className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="mb-8 text-center font-heading text-3xl text-eds-cyan md:text-4xl">
          Inscription
        </h2>
        <InscriptionForm />
      </section>

      {/* Section Règlement */}
      <section id="reglement" className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="mb-8 text-center font-heading text-3xl text-eds-white md:text-4xl">
          Règlement
        </h2>
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
