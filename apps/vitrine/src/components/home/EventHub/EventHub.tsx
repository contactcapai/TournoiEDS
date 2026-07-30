import { Brush, Button, LinkArrow, Tag } from "@repo/ui";
import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import { formatBigDate, formatRowDate, formatTime } from "@/lib/date-paris";
import { DISCORD_URL, NEW_TAB_SR, isExternalUrl } from "@/lib/links";
import type { UpcomingEvent } from "@/server/db/queries/events";
import motion from "@/styles/motion.module.css";
import styles from "./EventHub.module.css";

// Hub événementiel de l'accueil (Story 3.2) — transcription de la section `.agenda`
// de docs/refonte-2026/maquette/index.html (CSS l.94-116, markup l.251-281).
//
// Server Component pur : aucune interactivité, donc aucun 'use client'. C'est la PAGE
// qui lit la base (AC1) et distribue en props — ce composant ne requête rien. Cette
// règle n'est pas cosmétique : le badge « CE JEUDI » du hero et la carte ci-dessous
// doivent désigner la MÊME date, ce que seule une lecture unique garantit.
//
// Vit dans `components/home/` et NON `components/agenda/` (que `architecture.md` l.500
// nomme pour la future page /agenda) : ce bloc est un voisin de Hero/ThreeAxes/
// QuoteBand/AnimationsTeaser/DoubleDoor. Pas d'abstraction avant un 2ᵉ consommateur
// réel — la Story 3.3 tranchera si elle veut extraire une ligne ou un tag partagés.
//
// Les formulations sont CONTRACTUELLES (UX-DR18) — ne pas les reformuler.

export interface EventHubProps {
  /** Prochain événement publié, ou `null` s'il n'y en a aucun (état vide, AC6). */
  next: UpcomingEvent | null;
  /** Les suivants — le roulement. Peut être vide sans que ce soit l'état vide. */
  rest: UpcomingEvent[];
}

/**
 * Un texte blanc n'est pas un texte (leçon de la revue 3.1) : le CHECK `event_has_venue`
 * protège la BASE, pas le rendu. Une ligne écrite avant le durcissement Zod, ou par du
 * SQL direct, peut porter un `venueName` d'espaces — il doit se comporter comme absent.
 */
function cleanText(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/* Icônes des faits de la carte. Transcrites de la maquette (l.265-267), sauf la
   dernière. Toutes décoratives : le sens est porté par le texte qui suit, donc
   `aria-hidden` + `focusable="false"` — même patron que les icônes du SiteFooter. */

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

/* 4ᵉ icône : AUCUNE référence dans la maquette (elle n'affiche pas les jeux). Composée
   ici dans la même grammaire que les trois autres — viewBox 24, contour 2px, pas
   d'aplat sauf les deux boutons. Le gate visuel de Brice tranche, comme pour les
   éléments sans maquette des Stories 2.6 et 2.7. */
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

/** Carte du prochain rendez-vous (`.next` de la maquette). */
function NextCard({ event }: { event: UpcomingEvent }) {
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
        {/* <h3> : le <h1> est celui du Hero, le <h2> celui de SectionHead — aucun saut. */}
        <h3 className={styles.nextTitle}>{event.title}</h3>

        <div className={styles.facts}>
          {/* Lieu — DEUX branches, comme le modèle (bar du roulement, ou lieu libre pour
              un temps fort). Un nom de bar provisoire (« Bar partenaire #2 ») se rend TEL
              QUEL : la tolérance est réglée côté données par la 3.1, aucune branche UI
              (AC7). Si aucune des deux branches n'a de quoi nommer un lieu, la ligne
              disparaît plutôt que d'annoncer un rendez-vous nulle part (NFR8). */}
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

          {/* Heure : formatée en horloge de Paris, jamais avec getHours() (garde-fou C).
              Le reste de la phrase est une copie FIXE, pas une donnée. */}
          <div>
            <ClockIcon />
            <span>{formatTime(event.startsAt)} — on reste tant qu&apos;on veut</span>
          </div>

          {/* Conditions : copie fixe, JAMAIS data-dépendante (AC3). Le modèle ne porte
              ni prix ni jauge, et il ne doit pas commencer à en porter par ce biais. */}
          <div>
            <TicketIcon />
            <span>Gratuit · ouvert à tous, même sans matériel</span>
          </div>

          {/* 4ᵉ fait, CONDITIONNEL : ligne masquée plutôt que placeholder vide (UX-DR10,
              AC7). C'est précisément ce que le jeudi `thursday2` du seed — semé SANS
              `games` — existe pour éprouver. */}
          {games ? (
            <div>
              <GamepadIcon />
              <span>Jeux : {games}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Pas de billetterie en v1 (UX-DR10) : le CTA renvoie vers l'agenda.
          /agenda arrive en Story 3.3 → 404 attendu d'ici là, comme le hero et les
          teasers avant elle. Ne pas retomber sur href="#". */}
      <div className={styles.act}>
        <Button variant="gold" href="/agenda">
          J&apos;y serai
        </Button>
      </div>
    </div>
  );
}

/** Une ligne du roulement (`.rest .row` de la maquette). */
function EventRow({ event }: { event: UpcomingEvent }) {
  // UNE SEULE DATE, jamais une plage : la maquette écrit « 21-22/11 » pour Game in
  // Reims, mais le modèle ne porte qu'un `starts_at`. Afficher une fin serait inventer
  // une donnée. Écart de transcription assumé, tracé dans `formatRowDate`.
  const place = event.bar ? event.bar.district : (cleanText(event.venueName) ?? cleanText(event.venueAddress));
  const isHighlight = event.type === "special";

  return (
    <li className={styles.row}>
      <div className={styles.rowDate}>{formatRowDate(event.startsAt)}</div>
      <div className={styles.rowText}>
        <b>{event.title}</b>
        {/* Sous-titre OMIS quand rien ne le nourrit (AC7) : date + titre + tag suffisent
            à la ligne. `description` n'est PAS un repli — epics.md la réserve à la page
            Agenda (Story 3.3), l'afficher ici doublonnerait les deux surfaces. */}
        {place ? <p>{place} — {formatTime(event.startsAt)}</p> : null}
      </div>
      {/* Libellés PUBLICS de l'enum : `schema.ts` dit explicitement qu'ils sont du RENDU
          et vivent dans cette story. */}
      <Tag variant={isHighlight ? "highlight" : "default"}>
        {isHighlight ? "Temps fort" : "Hebdo"}
      </Tag>
    </li>
  );
}

/** État vide : aucune date à venir (AC6). */
function EmptyState() {
  // DISCORD_URL vaut encore "#" (finalisé Story 5.5) : `isExternalUrl` le sait, donc
  // aucune annonce « nouvel onglet » trompeuse et aucun target sur une ancre inerte.
  // Le jour où la vraie invitation arrive, ce lien devient sortant SANS retoucher ce
  // fichier — même traitement que le footer et le menu mobile.
  const discordExternal = isExternalUrl(DISCORD_URL);

  return (
    <div className={styles.empty}>
      <p className={styles.emptyText}>
        Pas de jeudi calé pour l&apos;instant — on prépare la suite. En attendant, dis
        bonjour sur{" "}
        <a
          href={DISCORD_URL}
          className={styles.emptyLink}
          {...(discordExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          Discord
          {discordExternal ? <span className="sr-only">{NEW_TAB_SR}</span> : null}
        </a>
        .
      </p>
      <Button variant="gold" href="/agenda">
        Voir l&apos;agenda
      </Button>
    </div>
  );
}

export function EventHub({ next, rest }: EventHubProps) {
  return (
    // aria-labelledby ↔ id du <h2> de la tête de section (pattern acquis review 1.6 F6).
    <section className={styles.section} aria-labelledby="agenda-title">
      <Wrap>
        <SectionHead
          eyebrow="Le rendez-vous"
          titleId="agenda-title"
          title={
            <>
              On se voit{" "}
              {/* &nbsp; avant le « ? » : espace insécable de la typographie française,
                  déjà dans la maquette (`jeudi&nbsp;?`). Le {" "} explicite au-dessus
                  évite l'espace avalée par JSX (leçon 2.6). */}
              <Brush>jeudi{"\u00A0"}?</Brush>
            </>
          }
          intro="Toutes nos dates sont ici, sur le site. Plus besoin de fouiller Discord pour savoir où on se retrouve cette semaine."
        />

        {/* 🔴 `motion.reveal` EST POSÉ ICI, ET SÛREMENT PAS SUR LA <section> — contrairement
            à ThreeAxes et AnimationsTeaser. Raison MESURÉE (garde-fou D de la story) :
            cette section est la seule du site à poser du `--grey` (le chapô de
            SectionHead) sur `--navy`. À pleine opacité la combinaison donne 4,60:1 —
            conforme, mais avec 0,10 de marge seulement. Or `motion.reveal` part de
            `opacity: 0.75`, ce qui mélange 25 % de fond dans le texte et fait tomber le
            rapport à ≈ 3,25:1 pendant toute l'apparition — même magnitude d'échec que
            l'or sur navy-deep attrapé par Lighthouse en Story 2.8.
            L'avertissement était déjà écrit pour cette story en tête de
            motion.module.css : « si une section devait un jour porter du --grey sur
            --navy, ce motif redeviendrait non conforme ».
            Ce <div> n'enveloppe donc QUE la carte et le roulement, dont les textes sont
            en --cream / --gold / --light — tous largement AA même fondus. Le SectionHead
            reste à l'opacité 1 d'emblée.
            ⚠️ Ne pas « simplifier » en remontant cette classe sur la <section>. */}
        <div className={motion.reveal}>
          {next ? (
            <>
              <NextCard event={next} />

              {/* `role="list"` : `list-style: none` retire la sémantique de liste dans
                  Safari/VoiceOver (piège relevé en Story 2.6) — le rôle explicite la
                  restaure. La maquette n'affiche pas de puces, on garde les deux. */}
              {rest.length > 0 ? (
                <ul className={styles.rest} role="list">
                  {rest.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </ul>
              ) : null}

              <p className={styles.footNote}>
                Roulement sur 4 bars rémois — 1 jeudi par mois chacun
              </p>

              <div className={styles.more}>
                <LinkArrow href="/agenda">Voir tout l&apos;agenda</LinkArrow>
              </div>
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </Wrap>
    </section>
  );
}
