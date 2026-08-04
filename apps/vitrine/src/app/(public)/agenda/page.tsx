import type { Metadata } from "next";
import { Brush, Button } from "@repo/ui";
import { EventList, EventRow } from "@/components/agenda/EventList/EventList";
import { NextEventCard } from "@/components/agenda/NextEventCard/NextEventCard";
import { PastCarousel } from "@/components/agenda/PastCarousel/PastCarousel";
import { PastEvent } from "@/components/agenda/PastEvent/PastEvent";
import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import { DISCORD_URL, NEW_TAB_SR, classerDestination } from "@/lib/links";
import { getPastEvents, getUpcomingEvents } from "@/server/db/queries/events";
import { getPhotosForEvents } from "@/server/db/queries/photos";
import editorial from "@/styles/editorial.module.css";
import motion from "@/styles/motion.module.css";
import styles from "./page.module.css";

// Page « Agenda » (Story 3.3) — TROISIÈME page dédiée du site, et la première à lire
// la base. Server Component pur : aucune interactivité, donc aucun 'use client'.
//
// ⚠️ AUCUNE MAQUETTE NE DÉCRIT CETTE PAGE (décision UX tracée, .decision-log.md l.96 :
// « Maquettes pages dédiées : AUCUNE »). Le `<section class="agenda">` de la maquette
// est le HUB DE LA HOME (Story 3.2), pas cette page. Ce qui suit est donc une
// COMPOSITION à partir des composants extraits en `components/agenda/` et du
// vocabulaire éditorial partagé — validée au gate visuel.
//
// Elle clôt les sept déclarations `href="/agenda"` qui renvoyaient un 404 assumé
// depuis la Story 1.4 (header, menu mobile, footer, hero, /l-asso, et trois liens du
// hub). ✅ `/partenaires`, dernier 404 interne du site, a été fermé par la Story 4.2 :
// le site n'en compte plus AUCUN — recompté sur le HTML servi des 5 pages (15 routes
// internes distinctes, toutes en 200), pas supposé.

export const metadata: Metadata = {
  // Le root layout pose `title.template: "%s · Esport des Sacres"` → le <title>
  // rendu est « Agenda · Esport des Sacres ».
  title: "Agenda",
  description:
    "Tous nos rendez-vous : les jeudis jeux en roulement sur quatre bars rémois, les temps forts, et ce qui s'est déjà passé. Les dates sont ici, pas sur Discord.",
  // ⚠️ DEUX pièges distincts, tous deux mesurés sur le HTML rendu en Story 2.6 :
  //  1. openGraph NE DÉRIVE PAS du `title` de la page quand le parent en déclare un ;
  //  2. Next REMPLACE l'objet `openGraph` du parent, il ne le fusionne PAS champ par
  //     champ. Sans les trois premières lignes, cette page perdrait `og:type`,
  //     `og:locale` et `og:site_name` → carte de partage sans nom de site.
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Esport des Sacres",
    title: "Agenda · Esport des Sacres",
    description:
      "Les jeudis jeux en roulement sur quatre bars rémois, les temps forts, et ce qui s'est déjà passé.",
  },
};

/**
 * 🔴 DYNAMIQUE, ET SANS AUCUN CACHE — LE CADRAGE D'ORIGINE A ÉTÉ CORRIGÉ, PAS APPLIQUÉ.
 *
 * `epics.md` et `AR-DB5` prescrivaient « ISR + revalidation à la demande par tag
 * `events` ». Trois faits s'y opposent, et les trois sont vérifiables :
 *
 * 1. **Un cache rendrait des données FAUSSES, pas seulement fraîches.** Le partage
 *    entre « à venir » et « passé » est `starts_at ≷ now()` : le résultat change avec
 *    le TEMPS SEUL, sans qu'aucune mutation ne survienne. Un cache invalidé uniquement
 *    par tag afficherait un jeudi déjà passé dans « à venir ». C'est une régression de
 *    correction, pas de fraîcheur.
 * 2. **Rien ne peut déclencher `revalidateTag('events')` avant la Story 6.3.** Aucune
 *    mutation n'existe. Un tag que personne n'appelle n'est pas un cache invalidable :
 *    c'est un cache figé.
 * 3. **L'API prescrite n'existe plus telle quelle ici.** Next 16.2 : `unstable_cache`
 *    est déprécié au profit de `use cache` + `cacheTag`, qui exigent le drapeau
 *    `cacheComponents` — réglage APPLICABLE À TOUTE L'APPLICATION (il supprime la
 *    sémantique de `dynamic` sur les 4 routes et impose des frontières `<Suspense>`).
 *    Basculer tout le site pour une page serait hors de proportion.
 *
 * `force-dynamic` satisfait donc simultanément « build sûr sans `DATABASE_URL` »
 * (garde-fou 1.7, la CI n'a aucun secret) et « donnée juste à chaque requête ».
 * Les sources ont été corrigées : ne pas repayer ce garde-fou une 3ᵉ fois.
 */
export const dynamic = "force-dynamic";

/**
 * Bornes EXPLICITES, jamais de lecture non bornée : une page dont le temps de rendu
 * dépend du volume de contenu est un défaut qui n'apparaîtrait qu'une fois la base
 * remplie par les bénévoles — c'est-à-dire en production, chez quelqu'un d'autre.
 *
 * 50 « à venir » : exhaustif en pratique (un jeudi par semaine = presque un an
 * d'avance) tout en restant borné. « Exhaustivité » n'est pas « non borné ».
 * **4 « passés »** : la section est un CARROUSEL, et cette borne est la sienne
 * (arbitrage de Brice, 2026-07-30). Un agenda n'est pas une archive — la mémoire longue
 * viendra avec la galerie (Epic 4), qui a ses propres écrans. Les 4 sont chargés d'un
 * coup et tous rendus : le carrousel fait défiler, il ne pagine pas.
 */
const UPCOMING_LIMIT = 50;
const PAST_LIMIT = 4;

/* ⚠️ `RECAP_MAX` et `PAST_TITLE_MAX` ONT SUIVI `PastEvent` dans son composant (Story 6.4,
   dette R34) : ce sont ses bornes de rendu, elles n'ont jamais concerné cette page. */

/** Lien Discord — même traitement que le footer, le menu mobile et le hub. */
function DiscordLink({ className, classNameActif }: { className?: string; classNameActif?: string }) {
  const destination = classerDestination(DISCORD_URL);
  const external = destination === "externe";

    // 🔴 SANS DESTINATION, LE MOT N'EST PLUS UN LIEN (Story 5.5, dette R2). La phrase,
    // elle, N'EST PAS reformulée : c'est du contenu ÉDITORIAL, et le choix le moins
    // destructeur est aussi le plus réversible — le jour où l'invitation Discord existe,
    // la phrase redevient juste sans qu'on ait touché à un mot.
    // ⚠️ Point présenté au gate ÉDITORIAL de Brice : une tuile morte ne promet rien, un
    // MOT mort dans une phrase promet une action impossible. C'est la seule occurrence
    // de cette famille sur le site (avec l'aside et l'état vide d'`/agenda`).
  if (destination === "absente") {
    return (
      <span className={className} data-inerte="">
        Discord
      </span>
    );
  }
  return (
    <a
      href={DISCORD_URL}
      className={`${className ?? ""} ${classNameActif ?? ""}`.trim()}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      Discord
      {external ? <span className="sr-only">{NEW_TAB_SR}</span> : null}
    </a>
  );
}

export default async function Agenda() {
  // Deux lectures, une par section. Pas de tri en mémoire à partir d'une seule
  // requête : chaque liste a sa borne et son ordre propres, et les faire sortir de
  // Postgres est ce qui garantit que la borne s'applique EN BASE et non après coup.
  const [upcoming, past] = await Promise.all([
    getUpcomingEvents(UPCOMING_LIMIT),
    getPastEvents(PAST_LIMIT),
  ]);

  // 🔴 UNE SEULE REQUÊTE POUR LES N VIGNETTES, PAS UNE PAR CARTE (dette R25). Une
  // lecture par événement serait un N+1 sur une page `force-dynamic`, donc payé à
  // CHAQUE visite. ⚠️ Elle vient APRÈS le `Promise.all` et non dedans : elle dépend de
  // ses résultats (les identifiants des passés), donc elle ne peut pas être
  // parallélisée avec eux. C'est le seul aller-retour séquentiel de la page.
  const photosParEvenement = await getPhotosForEvents(past.map((event) => event.id));

  const next = upcoming[0] ?? null;
  const rest = upcoming.slice(1);

  return (
    <>
      {/* ① Tête de page. Seul <h1> du document ; le <main id="content"> est fourni
          par (public)/layout.tsx → pas de <main> ici. Pas de `motion.reveal` : le
          chapô de SectionHead est en --grey, non conforme sous un fondu (voir ②). */}
      <section className={editorial.head} aria-labelledby="agenda-title">
        <Wrap>
          <SectionHead
            headingLevel={1}
            titleId="agenda-title"
            eyebrow="Où et quand"
            title={
              <>
                Nos <Brush>rendez-vous</Brush>
              </>
            }
            intro="Les jeudis jeux tournent sur quatre bars rémois, et les temps forts s'ajoutent au fil de l'année. Tout est ici — vous n'avez pas besoin d'un compte pour savoir où on se retrouve."
          />
        </Wrap>
      </section>

      {/* ② « À venir » — section relevée sur --navy, procédé de la maquette pour ses
          sections d'agenda (DESIGN.md l.171).

          🔴 `motion.reveal` n'est PAS sur la <section> : elle contient le <h2> et son
          chapô en --grey, qui tombe à 3,24:1 sur --navy pendant le fondu (mesuré en
          Story 3.2, plancher d'opacité 0,985 contre 0,75 pour ce motif). La classe
          n'enveloppe donc que le contenu, dont les textes sont en --cream/--gold/
          --light. Même découpe que le hub de la home. */}
      <section
        className={`${editorial.section} ${styles.upcoming}`}
        aria-labelledby="a-venir-title"
      >
        <Wrap>
          <SectionHead eyebrow="Prochainement" titleId="a-venir-title" title="À venir" />

          <div className={motion.reveal}>
            {next ? (
              <>
                {/* Pas de CTA sur la carte : elle renverrait vers cette page même
                    (arbitrage de Brice — le CTA « participer » d'epics.md n'a aucune
                    destination en v1, il est remplacé par l'adresse des lignes). */}
                <NextEventCard event={next} />

                {rest.length > 0 ? (
                  <EventList>
                    {rest.map((event) => (
                      <EventRow key={event.id} event={event} variant="detailed" />
                    ))}
                  </EventList>
                ) : null}
              </>
            ) : (
              /* État vide. ⚠️ La formulation du hub n'est PAS reprise telle quelle :
                 son CTA « Voir l'agenda » pointerait vers cette page. Variante validée
                 au gate éditorial (même procédé qu'en Stories 2.6 et 2.7). */
              <div className={styles.empty}>
                <p className={styles.emptyText}>
                  Aucune date calée pour l&apos;instant — on prépare la suite. Les
                  jeudis reprennent vite&nbsp;: le plus simple, en attendant, c&apos;est
                  de passer dire bonjour sur{" "}
                  <DiscordLink className={styles.emptyLink} classNameActif={styles.emptyLinkActif} />.
                </p>
              </div>
            )}

            {/* CTA de PAGE, unique — et non un CTA par événement. */}
            <p className={styles.aside}>
              Une question sur un rendez-vous, ou envie de prévenir que vous
              venez&nbsp;? On répond sur <DiscordLink className={styles.asideLink} classNameActif={styles.asideLinkActif} />.
            </p>
          </div>
        </Wrap>
      </section>

      {/* ③ « Déjà passé » — OMISE quand il n'y a rien à montrer : pas de section vide,
          pas de « rien à afficher ». Fond par défaut (--navy-deep) : le contraste des
          textes clairs y est encore meilleur que sur --navy. */}
      {past.length > 0 ? (
        <section
          className={`${editorial.section} ${styles.pastSection}`}
          aria-labelledby="passes-title"
        >
          <Wrap>
            <SectionHead
              eyebrow="Ce qu'on a déjà fait"
              titleId="passes-title"
              title="Déjà passé"
            />

            {/* Le carrousel affiche la vignette la PLUS RÉCENTE en premier : c'est
                déjà l'ordre de `getPastEvents` (décroissant), rien à trier ici. */}
            <div className={motion.reveal}>
              <PastCarousel label="Événements passés, du plus récent au plus ancien">
                {past.map((event) => (
                  <PastEvent
                    key={event.id}
                    event={event}
                    photo={photosParEvenement.get(event.id)}
                  />
                ))}
              </PastCarousel>
            </div>
          </Wrap>
        </section>
      ) : null}

      {/* ④ Renvoi final. Le CTA d'adhésion n'est PAS ici : cette page parle de dates,
          la porte d'adhésion est la double porte de la home (Story 2.5). */}
      <section className={`${editorial.section} ${motion.reveal}`}>
        <Wrap>
          <div className={styles.outro}>
            <p>
              Les animations et interventions, c&apos;est une autre porte&nbsp;: elle
              est décrite sur la page dédiée.
            </p>
            <Button variant="outline" href="/animations">
              Voir les animations
            </Button>
          </div>
        </Wrap>
      </section>
    </>
  );
}
