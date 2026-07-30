import { Button } from "@repo/ui";
import { formatBigDate, formatTime } from "@/lib/date-paris";
import { cleanText } from "@/lib/text";
import type { AgendaEvent } from "@/server/db/queries/events";
import styles from "./NextEventCard.module.css";

// Carte du prochain rendez-vous (`.next` de la maquette) — Server Component pur.
//
// Écrite par la Story 3.2 dans `components/home/EventHub/`, EXTRAITE ICI par la 3.3
// à l'arrivée de son deuxième consommateur réel (la page /agenda). C'est le
// déclencheur d'extraction du projet — « payé DEUX fois », METHODE.md §5 — et
// `EXPERIENCE.md` l.128 place explicitement cette carte sur les DEUX surfaces
// (« Hub, page Agenda »).
//
// ⚠️ NOMMAGE : `architecture.md` l.500 annonçait `NextThursdayCard`. Le nom serait
// FAUX : la Story 3.2 a établi (AC5) que la prochaine date n'est pas forcément un
// jeudi — un temps fort peut tomber n'importe quel jour, et la carte le rend sans
// distinction. `architecture.md` est corrigé plutôt que le code renommé à tort.

export interface NextEventCardProps {
  event: AgendaEvent;
  /** Cible du CTA. La home renvoie vers /agenda ; la page /agenda n'a pas de CTA
   *  de carte (elle EST la destination) et ne passe donc rien. */
  cta?: { label: string; href: string };
}

/* Icônes des faits. Transcrites de la maquette (l.265-267), sauf la dernière.
   Toutes décoratives : le sens est porté par le texte qui suit, d'où `aria-hidden`
   + `focusable="false"` — même patron que les icônes du SiteFooter. */

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <path d="M9 7v10" strokeDasharray="2 2" />
    </svg>
  );
}

/* 4ᵉ icône : AUCUNE référence dans la maquette (elle n'affiche pas les jeux).
   Composée dans la même grammaire que les trois autres — viewBox 24, contour 2px,
   pas d'aplat sauf les deux boutons. Validée au gate visuel de la Story 3.2. */
function GamepadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <rect x="2.5" y="7.5" width="19" height="9" rx="4.5" />
      <path d="M7 10.5v3M5.5 12h3" strokeLinecap="round" />
      <circle cx="16.5" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="14" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function NextEventCard({ event, cta }: NextEventCardProps) {
  const bigDate = formatBigDate(event.startsAt);
  const games = cleanText(event.games);
  const venueName = cleanText(event.venueName);
  const venueAddress = cleanText(event.venueAddress);

  return (
    <div className={styles.next}>
      <div className={styles.bigDate}>
        <b>{bigDate.day}</b>
        <span>{bigDate.month}</span>
      </div>

      <div className={styles.body}>
        {/* <h3> : sous le <h2> d'une tête de section, lui-même sous le <h1> de la
            page. Vrai sur la home (h1 du Hero) comme sur /agenda (h1 de page) —
            aucun saut de niveau, audit Lighthouse `heading-order`. */}
        <h3 className={styles.nextTitle}>{event.title}</h3>

        <div className={styles.facts}>
          {/* Lieu — DEUX branches, comme le modèle (bar du roulement, ou lieu libre
              pour un temps fort). Un nom de bar provisoire (« Bar partenaire #2 »)
              se rend TEL QUEL : la tolérance est réglée côté données par la 3.1,
              aucune branche UI. Si aucune des deux branches n'a de quoi nommer un
              lieu, la ligne disparaît plutôt que d'annoncer un rendez-vous nulle
              part (NFR8). */}
          {event.bar ? (
            <div>
              <PinIcon />
              <span>
                <strong>{event.bar.name}</strong> — {event.bar.district}, {event.bar.city}
              </span>
            </div>
          ) : venueName ? (
            <div>
              <PinIcon />
              <span>
                <strong>{venueName}</strong>
                {venueAddress ? <> — {venueAddress}</> : null}
              </span>
            </div>
          ) : null}

          {/* Heure : formatée en horloge de Paris, jamais avec getHours(). Le reste
              de la phrase est une copie FIXE, pas une donnée. */}
          <div>
            <ClockIcon />
            <span>{formatTime(event.startsAt)} — on reste tant qu&apos;on veut</span>
          </div>

          {/* Conditions : copie fixe, JAMAIS data-dépendante. Le modèle ne porte ni
              prix ni jauge, et il ne doit pas commencer à en porter par ce biais. */}
          <div>
            <TicketIcon />
            <span>Gratuit · ouvert à tous, même sans matériel</span>
          </div>

          {/* 4ᵉ fait, CONDITIONNEL : ligne masquée plutôt que placeholder vide
              (UX-DR10). Le jeudi `thursday2` du seed, semé SANS `games`, existe
              pour l'éprouver. */}
          {games ? (
            <div>
              <GamepadIcon />
              <span>Jeux : {games}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* CTA optionnel : pas de billetterie en v1 (UX-DR10). La home renvoie vers
          /agenda ; la page /agenda ne passe rien — elle EST la destination, un CTA
          qui s'y renvoie serait un lien mort (arbitrage de Brice, Story 3.3). */}
      {cta ? (
        <div className={styles.act}>
          <Button variant="gold" href={cta.href}>
            {cta.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
