import type { Metadata } from "next";
import { Brush, Button } from "@repo/ui";

import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import {
  TournamentCard,
  TournamentList,
} from "@/components/tournois/TournamentList/TournamentList";
import { getPublicTournaments } from "@/server/db/queries/tournaments";
import editorial from "@/styles/editorial.module.css";
import motion from "@/styles/motion.module.css";
import styles from "./page.module.css";

// Page « Tournois » (Story 9.2, A20) — SIXIÈME page publique du site, et la première du
// chantier tournois. Server Component pur : aucune interactivité, donc aucun 'use client'.
//
// ⚠️ AUCUNE MAQUETTE NE DÉCRIT CETTE PAGE (décision UX tracée, .decision-log.md l.96 :
// « Maquettes pages dédiées : AUCUNE »). Vérifié au cadrage : la maquette canonique mentionne
// « tournoi » quatorze fois, mais toutes pour la PASSERELLE de l'accueil (`TournamentBridge`,
// Story 5.4). Ce qui suit est donc une COMPOSITION à partir du vocabulaire éditorial partagé
// (`editorial.module.css`) et de la grammaire de card déjà arbitrée par Brice au gate visuel
// du 2026-08-04 — validée au gate visuel, seul filet de la passe 1 (rétro Epic 5).
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CETTE PAGE EST **ORPHELINE** JUSQU'À LA STORY 9.4, ET C'EST UNE ÉTAPE, PAS UNE PANNE
// ══════════════════════════════════════════════════════════════════════════════════════
//
// Mesuré : le lien « Tournois » du header vaut `{ href: TOURNOI_URL, external: true }`, avec
// `TOURNOI_URL = "https://tournoi.esportdessacres.fr"`. Le pied de page l'utilise DEUX fois et
// `TournamentBridge` (l'accueil) une fois. **Aucun de ces quatre liens ne change ici**
// (arbitrage **A4**) : les faire pointer vers `/tournois` change le rendu de surfaces DÉJÀ
// MERGÉES — le lien cesse d'être sortant, donc perd son `target="_blank"`, son `ExternalIcon`
// et sa mention `NEW_TAB_SR` chez ses consommateurs. C'est un livrable à part entière, avec son
// propre gate visuel et son témoin inversé : c'est la **Story 9.4**.
// ⇒ D'ici là, `/tournois` ne s'atteint qu'en tapant l'URL, y compris pour le gate visuel.
// ⚠️ Le dire ici évite qu'on le lise comme un défaut : une page publique que la navigation
// n'atteint pas *ressemble* à une panne. C'en est une si personne ne l'a écrit ; c'est une
// étape si quelqu'un l'a écrit.

export const metadata: Metadata = {
  // Le root layout pose `title.template: "%s · Esport des Sacres"` → le <title> rendu est
  // « Tournois · Esport des Sacres ».
  title: "Tournois",
  description:
    "Les tournois d'Esport des Sacres : ceux qui arrivent, comment s'y inscrire, et ceux qui ont déjà eu lieu avec leur podium.",
  // ⚠️ DEUX pièges distincts, tous deux mesurés sur le HTML rendu en Story 2.6 :
  //  1. openGraph NE DÉRIVE PAS du `title` de la page quand le parent en déclare un ;
  //  2. Next REMPLACE l'objet `openGraph` du parent, il ne le fusionne PAS champ par champ.
  //     Sans les trois premières lignes, cette page perdrait `og:type`, `og:locale` et
  //     `og:site_name` → carte de partage sans nom de site.
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Esport des Sacres",
    title: "Tournois · Esport des Sacres",
    description:
      "Ceux qui arrivent, comment s'y inscrire, et ceux qui ont déjà eu lieu avec leur podium.",
  },
};

/**
 * 🔴 DYNAMIQUE, ET SANS AUCUN CACHE — MÊME RAISONNEMENT QUE LES CINQ AUTRES PAGES.
 *
 * Le partage entre « à venir » et « passés » est `starts_at ≷ now()` : le résultat change avec
 * le TEMPS SEUL, sans qu'aucune mutation ne survienne. Un cache invalidé par tag afficherait un
 * tournoi déjà joué dans « à venir » — une régression de CORRECTION, pas de fraîcheur. Le
 * raisonnement complet (et les trois faits qui ont fait corriger `epics.md` plutôt que
 * l'appliquer) vit dans `(public)/agenda/page.tsx`.
 *
 * ⚠️ `force-dynamic` satisfait aussi « build sûr sans `DATABASE_URL` » (garde-fou 1.7) : la CI
 * n'a aucun secret, et le seul `○` du build reste `/_not-found`.
 */
export const dynamic = "force-dynamic";

/**
 * Bornes EXPLICITES, jamais de lecture non bornée : une page dont le temps de rendu dépend du
 * volume saisi est un défaut qui n'apparaîtrait qu'une fois la base remplie par les bénévoles —
 * c'est-à-dire en production, chez quelqu'un d'autre. **« Généreux » n'est pas « non borné ».**
 *
 * 50 de chaque côté : la Game'in Reims, le plus gros événement de l'année, porte **dix**
 * animations à elle seule. Cinquante couvre donc plusieurs années d'historique tout en restant
 * borné.
 * ⚠️ **Aucune pagination**, et c'est assumé : elle serait une surface de plus (URL, état, gate)
 * pour un volume qui n'existera pas avant longtemps. Le jour où la borne serrera, elle se
 * verra — la liste s'arrêtera net —, et c'est ce moment-là qui devra la traiter.
 */
const A_VENIR_MAX = 50;
const PASSES_MAX = 50;

export default async function Tournois() {
  // Deux lectures, une par section, derrière UN SEUL point d'entrée. Pas de tri en mémoire à
  // partir d'une seule requête : chaque liste a sa borne et son ordre propres, et les faire
  // sortir de Postgres est ce qui garantit que la borne s'applique EN BASE et non après coup.
  //
  // 🔴 UN SEUL APPEL, ET C'EST UNE CORRECTION DE REVUE : les deux requêtes doivent partager
  // le MÊME instant, sans quoi un tournoi dont `starts_at` tombe entre les deux lectures
  // d'horloge sort dans les DEUX listes. Le raisonnement complet vit sur
  // `getPublicTournaments` — et l'horloge y reste lue dans la couche données, jamais ici
  // (lire l'heure pendant un rendu est l'impureté que `react-hooks/purity` refuse).
  //
  // ⚠️ Les cartes reçoivent une VARIANTE (`a-venir` / `passe`) dérivée de la requête qui les a
  // produites : les deux frontières ne peuvent donc pas diverger.
  const { aVenir, passes } = await getPublicTournaments(A_VENIR_MAX, PASSES_MAX);

  return (
    <>
      {/* ① Tête de page. Seul <h1> du document ; le <main id="content"> est fourni par
          (public)/layout.tsx → pas de <main> ici. Pas de `motion.reveal` : le chapô de
          SectionHead est en --grey, non conforme sous un fondu (voir ②). */}
      <section className={editorial.head} aria-labelledby="tournois-title">
        <Wrap>
          <SectionHead
            headingLevel={1}
            titleId="tournois-title"
            eyebrow="Compétition"
            title={
              <>
                Nos <Brush>tournois</Brush>
              </>
            }
            intro="On joue pour de vrai : des tournois ouverts, en bar comme sur les gros événements de la région. Vous trouverez ici ce qui arrive, comment s'y inscrire, et ce qui s'est déjà joué."
          />
        </Wrap>
      </section>

      {/* ② « À venir » — section relevée sur --navy, procédé de la maquette pour ses sections
          d'agenda (DESIGN.md l.171), repris tel quel par /agenda.

          🔴 `motion.reveal` n'est PAS sur la <section> : elle contient le <h2> et son éventuel
          chapô en --grey, qui tombe à **3,25:1** sur --navy pendant le fondu (4,60:1 au plein).
          C'est le patron par défaut de toute section animée à fond --navy depuis qu'il a été
          payé DEUX fois — `EventHub` (3.2) puis `ProofBand` (4.1) —, et `motion.module.css`
          l'écrit noir sur blanc. La classe n'enveloppe donc que le contenu, dont les textes
          sont en --cream/--light. Même découpe que /agenda.
          ⚠️ Valeur RE-MESURÉE ici plutôt que recopiée : `/agenda` écrit « 3,24:1 » et
          `motion.module.css` « 3,25:1 ». Le calcul rend **3,25** à o=0,75 (et 3,20 au plancher
          0,747). L'écart est au centième et ne change aucune décision — les deux dépassent le
          seuil de 4,5 par le bas dans tous les cas —, mais on ne recopie pas un chiffre. */}
      <section className={`${editorial.section} ${styles.upcoming}`} aria-labelledby="a-venir-title">
        <Wrap>
          <SectionHead eyebrow="Prochainement" titleId="a-venir-title" title="À venir" />

          <div className={motion.reveal}>
            {aVenir.length > 0 ? (
              <TournamentList>
                {aVenir.map((tournoi) => (
                  <TournamentCard key={tournoi.id} tournoi={tournoi} variante="a-venir" />
                ))}
              </TournamentList>
            ) : (
              /* ══════════════════════════════════════════════════════════════════════════
                 ÉTAT VIDE — IL DIT CE QUI SE PASSE ET QUOI FAIRE, JAMAIS « aucun tournoi »
                 ══════════════════════════════════════════════════════════════════════════
                 Doctrine tenue depuis la 3.2, et la leçon 4.2 la rend non négociable : *un
                 état « tout à zéro » ressemble à « tout va bien »* — donc aussi à une panne.
                 ⚠️ Il renvoie vers l'AGENDA, une route INTERNE qui existe depuis la 3.3 : pas
                 vers Discord, dont l'adresse est une donnée de `site_setting` pouvant être
                 absente (dette R29) et qui obligerait cette page à refaire le composant de
                 lien inerte d'`/agenda`. Une quatrième copie pour un cas que la page peut
                 éviter entièrement. */
              <div className={styles.empty}>
                <p className={styles.emptyText}>
                  Aucun tournoi annoncé pour l&rsquo;instant — le prochain apparaîtra ici dès
                  qu&rsquo;il est calé, avec sa date et la façon de s&rsquo;y inscrire. En
                  attendant, on se retrouve tous les jeudis&nbsp;: c&rsquo;est dans
                  l&rsquo;agenda.
                </p>
                <p className={styles.emptyCta}>
                  <Button variant="outline" href="/agenda">
                    Voir l&rsquo;agenda
                  </Button>
                </p>
              </div>
            )}
          </div>
        </Wrap>
      </section>

      {/* ③ « Déjà joués » — OMISE quand il n'y a rien à montrer : pas de section vide, pas de
          « rien à afficher » (même traitement que le carrousel d'/agenda et que les catégories
          vides de /partenaires).
          🔴 C'EST L'ÉTAT RÉEL DU SITE AU MERGE : aucun tournoi passé n'existe en base. Cette
          section est donc à regarder EXPRÈS au gate visuel — par son absence.
          ⚠️ Les tournois passés ne disparaissent JAMAIS d'eux-mêmes (arbitrage A3) : c'est
          l'historique de l'association. La bascule « à venir » → « passés » se dérive de la
          date, elle n'est le geste de personne.
          Fond par défaut (--navy-deep) : le contraste des textes clairs y est encore meilleur
          que sur --navy — RE-MESURÉ, `--light` sous fondu donne **8,71:1** contre **7,47:1**
          (`/agenda` écrit 8,67 / 7,46 ; écart au centième, sans conséquence). */}
      {passes.length > 0 ? (
        <section
          className={`${editorial.section} ${styles.pastSection}`}
          aria-labelledby="passes-title"
        >
          <Wrap>
            <SectionHead
              eyebrow="Ce qui s'est déjà joué"
              titleId="passes-title"
              title="Déjà joués"
            />

            <div className={motion.reveal}>
              <TournamentList>
                {passes.map((tournoi) => (
                  <TournamentCard key={tournoi.id} tournoi={tournoi} variante="passe" />
                ))}
              </TournamentList>
            </div>
          </Wrap>
        </section>
      ) : null}

      {/* ④ Renvoi final.
          🔴 CONDITIONNÉ SUR `aVenir.length`, ET **PAS** SUR LE TOTAL — DÉFAUT RÉEL TROUVÉ EN
          REVUE (Edge Case Hunter), ET LA PREMIÈRE VERSION AVAIT LE BON RAISONNEMENT SUR LA
          MAUVAISE GRANDEUR. Elle testait `aVenir.length + passes.length > 0`, en traitant
          « la page porte au moins un tournoi » comme équivalent à « l'état vide n'est pas
          affiché ». Les deux peuvent être vrais EN MÊME TEMPS : dans l'état « aucun à venir
          mais des passés » — que l'AC3 exige explicitement de traiter — la page rendait DEUX
          fois le même bouton « Voir l'agenda », à deux blocs d'intervalle. C'est très
          exactement la page qui bégaie que ce commentaire disait vouloir éviter.
          ⚠️ ET AUCUN FILET NE POUVAIT LE VOIR : au merge, staging ne porte AUCUN tournoi
          passé, donc ni le gate visuel ni aucune porte ne rencontrait cette branche. La revue
          était le seul regard extérieur possible sur elle.
          ⇒ Le renvoi n'existe que lorsque la section « À venir » a rendu une LISTE ; dès
          qu'elle rend son état vide, c'est lui qui porte le renvoi, et il n'y en a qu'un.
          ⚠️ La page reste ENTIÈRE dans tous les cas (AC3) — tête, chapô, chrome, et au moins un
          bloc qui parle. */}
      {aVenir.length > 0 ? (
        <section className={`${editorial.section} ${motion.reveal}`}>
          <Wrap>
            <div className={styles.outro}>
              <p>
                Un tournoi se joue toujours pendant un rendez-vous&nbsp;: une soirée en bar, un
                salon, un temps fort. Le reste du programme est dans l&rsquo;agenda.
              </p>
              <Button variant="outline" href="/agenda">
                Voir l&rsquo;agenda
              </Button>
            </div>
          </Wrap>
        </section>
      ) : null}
    </>
  );
}
