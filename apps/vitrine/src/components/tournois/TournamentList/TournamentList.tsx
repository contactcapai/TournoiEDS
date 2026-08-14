import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { PhotoFrame } from "@repo/ui";

import { formatLongDate, formatTime } from "@/lib/date-paris";
import { LIBELLES_ETAT_INSCRIPTION } from "@/lib/libelles-tournoi";
import { cleanText } from "@/lib/text";
import type { PublicTournament } from "@/server/db/queries/tournaments";
import styles from "./TournamentList.module.css";

/**
 * Liste publique de tournois et sa carte (Story 9.2, A20/A23) — Server Components purs.
 *
 * Ils ne requêtent PAS : la page `(public)/tournois` appelle `getUpcomingTournaments` /
 * `getPastTournaments` puis distribue en props (patron AC1 de la 3.2). C'est ce qui garantit
 * qu'« à venir » et « passés » sont partagés par **une seule** lecture d'horloge, faite dans la
 * couche données.
 *
 * 🔴 LES DEUX EXPORTS VIVENT DANS LE MÊME FICHIER, ET C'EST UNE GARDE — doctrine reprise
 * telle quelle d'`EventList` (Story 3.3) : `<ul>`/`<li>` sont indissociables, et
 * `list-style: none` retire la sémantique de liste dans Safari/VoiceOver — c'est `role="list"`
 * qui la restaure. Les séparer laisserait un appelant écrire son propre `<ul>` en oubliant le
 * rôle, et l'annonce « liste de N éléments » disparaîtrait sans qu'aucune porte ne le voie.
 * Ici, l'appelant n'écrit pas de `<ul>` : il ne peut pas se tromper.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 TOUTE CARTE EST UN LIEN VERS SA FICHE — **ARBITRAGE A1, INVERSÉ PAR LA STORY 9.3**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Ce bloc disait l'inverse, et il annonçait lui-même son renversement : *« TÉMOIN QUI
 * S'INVERSE EN 9.3 : aucune carte n'est un lien aujourd'hui, toutes le seront dans le commit
 * qui crée la fiche »*. La 9.2 refusait `href="#"`, la page *stub* et l'`onClick` parce que
 * `/tournois/<slug>` **n'existait pas** (`CLAUDE.md` §5) ; **elle existe**, et le motif du
 * refus est mort avec elle. Il est réécrit plutôt que laissé : une borne annoncée qui n'existe
 * plus est un mensonge exactement aussi coûteux qu'une borne tue (leçon **R33 ②**).
 *
 * 🔴 **UN SEUL `<a>` PAR CARTE, ET IL EST SUR LE TITRE.** C'est ce qui décide de ce
 * qu'entend un lecteur d'écran : un `<a>` qui envelopperait la carte entière lui ferait
 * annoncer d'une traite la date, le nom, le jeu, le lieu et l'état des inscriptions comme
 * **un seul intitulé de lien**. Le titre seul dit exactement où l'on va.
 * ⇒ La surface cliquable est étendue à toute la carte par un `::after` en `inset: 0` (voir
 * le CSS jumelé), et le halo de focus se pose sur la **carte** via `:focus-within` — le
 * clavier voit donc la même cible que la souris.
 * ⚠️ **COÛT ASSUMÉ ET CONNU** : l'overlay empêche la **sélection du texte** de la carte. On
 * l'accepte parce que le contenu à copier (le nom, la date) est repris **entier** sur la fiche
 * où l'on arrive, et parce que l'alternative — attacher le clic en JavaScript — exigerait un
 * `'use client'` sur un composant qui n'a aucune autre raison d'en être un.
 *
 * ⚠️ **`slug` VIENT DE `COLONNES_PUBLIQUES`, QUI L'A GAGNÉ DANS LE MÊME COMMIT.** La 9.2 l'en
 * excluait explicitement (*« une colonne remontée que personne ne rend ferait croire au type
 * dérivé qu'une destination existe »*) : le type `PublicTournament` le porte désormais, et
 * c'est ce qui rend ce lien typé de bout en bout plutôt que construit à la main.
 */

export function TournamentList({ children }: { children: ReactNode }) {
  return (
    <ul className={styles.grille} role="list">
      {children}
    </ul>
  );
}

export interface TournamentCardProps {
  tournoi: PublicTournament;
  /**
   * D'où vient cette carte : la liste des à venir, ou celle des passés.
   *
   * 🔴 UNE VARIANTE ET PAS UN CALCUL, PARCE QUE L'HORLOGE NE SE LIT PAS DANS LE RENDU.
   * `startsAt <= new Date()` dans ce composant serait une impureté (`react-hooks/purity` la
   * refuse) : deux rendus du même arbre pourraient répondre différemment. La variante est
   * **dérivée de la requête qui a produit la ligne** — c'est-à-dire de la seule lecture
   * d'horloge de la page, celle de la couche données. Deux frontières ne peuvent donc pas
   * diverger.
   */
  variante: "a-venir" | "passe";
}

export function TournamentCard({ tournoi, variante }: TournamentCardProps) {
  // `cleanText` : dernier filet du rendu contre une écriture qui contournerait Zod ET les
  // `CHECK` (`UPDATE` direct, restauration de sauvegarde) — `btrim` ne retire pas U+200B, la
  // limite est déclarée dans `schema.ts` (dette R41, Story 7.8). Jamais un fragment vide.
  const salle = cleanText(tournoi.venueName);
  const passe = variante === "passe";

  /**
   * 🔴 LE PODIUM N'APPARAÎT QUE SUR UN TOURNOI PASSÉ, ET C'EST LA RÈGLE QU'AUCUN `CHECK` NE
   * POUVAIT TENIR (AC4 de la Story 9.1) : une contrainte doit être IMMUABLE, or « passé » se
   * compare à `now()`. Postgres refuse — et une ligne valide aujourd'hui qui deviendrait
   * invalide demain ferait **échouer toute restauration de sauvegarde**, le jour précis où
   * l'on en a le plus besoin. La règle se tient donc **ici**, à l'affichage, et une garde de
   * porte la mesure.
   *
   * ⚠️ Les trois rangs sont filtrés un par un : les `CHECK` `tournament_podium_sans_trou_*`
   * interdisent déjà les trous, mais ils ne voient pas un `podium_second` fait uniquement de
   * caractères sans largeur — que `cleanText` ramène à `null`. Filtrer après nettoyage est ce
   * qui garantit qu'on ne rend jamais « 2ᵉ — » suivi de rien.
   */
  const podium: { rang: string; nom: string }[] = passe
    ? [
        { rang: "1ᵉʳ", nom: cleanText(tournoi.podiumFirst) },
        { rang: "2ᵉ", nom: cleanText(tournoi.podiumSecond) },
        { rang: "3ᵉ", nom: cleanText(tournoi.podiumThird) },
      ].filter((place): place is { rang: string; nom: string } => place.nom !== null)
    : [];

  /**
   * 🔴 LE VISUEL N'EST RENDU QUE S'IL EST **SERVABLE** — la décision se prend ici, pas à
   * l'aveugle. `/medias/[filename]` répond **404** pour une photo non publiée (garde de la
   * Story 6.4), et rien n'empêche de dépublier une photo déjà choisie comme visuel. Le
   * raisonnement complet vit sur `RELATION_VISUEL` dans `queries/tournaments.ts`.
   *
   * ⚠️ **ET L'ABSENCE EST LE CAS NOMINAL** (AC4) : le seul tournoi saisi sur staging n'a pas de
   * visuel. La carte doit donc être belle **sans** — d'où l'omission COMPLÈTE du bloc média,
   * et non le placeholder « Photo à venir » de `PhotoFrame` que la vignette d'`/agenda`, elle,
   * rend volontairement. La différence est voulue : là-bas le cadre porte le rythme du
   * carrousel (toutes les vignettes ont la même hauteur) ; ici un cadre vide serait une
   * promesse de photo dans une grille qui n'en attend pas.
   */
  const visuel = tournoi.photo?.isPublished ? tournoi.photo : null;

  return (
    <li className={styles.carte}>
      <div className={styles.corps}>
        <p className={styles.date}>
          {formatLongDate(tournoi.startsAt)} · {formatTime(tournoi.startsAt)}
        </p>

        {/* `<h3>` : sous le `<h2>` de la section, lui-même sous le `<h1>` de la page. Aucun
            niveau sauté — c'est ce que Lighthouse audite (`heading-order`).
            🔴 Le lien est DANS le titre et non autour : un `<a>` enveloppant un `<h3>` reste
            valide, mais c'est le titre qui doit rester le titre. `next/link` et non `<a>` :
            c'est une route interne, donc navigation client (patron `SiteFooter`, cas 2). */}
        <h3 className={styles.nom}>
          <Link className={styles.lien} href={`/tournois/${tournoi.slug}`}>
            {tournoi.name}
          </Link>
        </h3>

        {/* Le jeu est `notNull` en base et non vide (`tournament_game_valide`) : pas de
            branche conditionnelle, elle serait morte. */}
        <p className={styles.jeu}>{tournoi.game}</p>

        {/* La salle est FACULTATIVE et disparaît entièrement quand elle est absente — jamais
            une ligne vide, jamais une étiquette orpheline (NFR8, UX-DR10). */}
        {salle ? <p className={styles.lieu}>{salle}</p> : null}

        {/* ══════════════════════════════════════════════════════════════════════════════
            🔴 L'ÉTAT DES INSCRIPTIONS NE SE REND QUE SUR UN TOURNOI **À VENIR** — A7
            ══════════════════════════════════════════════════════════════════════════════

            `registration_state` est INDÉPENDANT de la date, et c'est voulu (note
            d'architecture §6 ①, écrit aussi sur l'enum dans `schema.ts`) : un tournoi à venir
            aux inscriptions closes est normal, et l'inverse aussi. Conséquence directe : la
            base autorise parfaitement un tournoi **passé** dont l'état est resté `ouvertes` —
            personne ne referme les inscriptions d'un tournoi terminé, il n'y a aucun geste
            pour ça et le back-office n'en demande aucun.
            ⇒ Le rendre tel quel afficherait « Inscriptions : ouvertes » sur un tournoi qui a
            déjà eu lieu : une **promesse impossible**, exactement la famille de défauts que ce
            projet paie depuis la dette R2 (un mot qui annonce une action qui n'existe pas).
            ⚠️ Sur un tournoi passé, l'information utile n'est pas « pouvait-on s'inscrire »,
            c'est **qui a gagné** — d'où le podium à la place.
            ⚠️ Point porté au gate visuel de Brice : c'est une lecture de l'AC4, pas une
            omission. Le remettre partout est un `passe ? … : …` d'une ligne. */}
        {passe ? (
          podium.length > 0 ? (
            <div className={styles.podium}>
              <p className={styles.podiumLabel}>Podium</p>
              {/* `<ol>` et non `<ul>` : un podium est un CLASSEMENT, l'ordre porte le sens.
                  Le rang est écrit en toutes lettres et pas laissé au marqueur natif — la
                  liste peut ne compter qu'une ou deux places (un 1ᵉʳ seul est valide), et un
                  « 1. » puis « 2. » automatiques diraient la même chose sans la dire. */}
              <ol className={styles.podiumListe} role="list">
                {podium.map((place) => (
                  <li key={place.rang} className={styles.podiumPlace}>
                    <span className={styles.podiumRang}>{place.rang}</span>
                    <span className={styles.podiumNom}>{place.nom}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null
        ) : (
          <p className={styles.inscriptions}>
            <span className={styles.inscriptionsLabel}>Inscriptions</span>
            <span className={styles.inscriptionsValeur}>
              {LIBELLES_ETAT_INSCRIPTION[tournoi.registrationState]}
            </span>
          </p>
        )}
      </div>

      {visuel ? (
        <div className={styles.media}>
          {/* 🔴 AUCUNE `caption` SUR LE CADRE, ET C'EST UN DÉFAUT MESURÉ AILLEURS QU'ON NE
              REFAIT PAS : le `figcaption` de `PhotoFrame` est rendu en Caveat et **ne se coupe
              pas** — en Story 6.4, un titre long y a fait déborder `/agenda` de 33px à 320px.
              La parade retenue là-bas est un libellé **borné par construction** (deux valeurs
              possibles). Ici aucune donnée de tournoi ne l'est : le nom fait jusqu'à 80
              caractères, le jeu jusqu'à 120. On n'en met donc aucune — la carte porte déjà le
              nom, juste à côté.
              ⚠️ `alt` vient de la photo elle-même : il est OBLIGATOIRE depuis la 4.3 (NFR3) et
              il DÉCRIT l'image, là où le texte de la carte décrit le tournoi. Les deux ne se
              répètent pas — contrairement à la vignette d'`/agenda`, où l'image est purement
              illustrative et porte donc `alt=""`. */}
          <PhotoFrame rotation={-2}>
            <Image
              src={`/medias/${visuel.filename}`}
              alt={visuel.alt}
              fill
              sizes="(max-width: 880px) 100vw, 320px"
              loading="lazy"
            />
          </PhotoFrame>
        </div>
      ) : null}
    </li>
  );
}
