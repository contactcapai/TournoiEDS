import { cleanText } from "@/lib/text";
import type { WorkshopEntry } from "@/server/db/queries/workshops";
import styles from "./WorkshopCatalog.module.css";

/**
 * Catalogue des ateliers d'UNE famille, rendu sous la prose de cette famille sur
 * `/animations` (Story 6.9, FR34 → FR10).
 *
 * Server Component pur : aucune interactivité, donc aucun `'use client'`. Il ne requête PAS —
 * la page appelle `getPublishedWorkshops()` puis distribue en props (patron AC1 de la 3.2).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 DES CARDS, ET C'EST UN ARBITRAGE DE BRICE AU GATE VISUEL (2026-08-04)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * La première version rendait une **liste à puces** dans la prose. Elle a été refusée au gate
 * visuel — passe 1, « ça ne ressemble pas à ce qu'on voulait ». La source de la story le disait
 * pourtant depuis le 2026-07-29 : *« les ateliers seront ajoutés et supprimés via le
 * back-office, **comme les cards de `07 site MSL`** »* — la mention avait été lue comme
 * décrivant le patron du back-office, alors qu'elle décrivait le **rendu**.
 * ⚠️ C'est exactement ce que le gate visuel existe pour attraper, et **rien d'autre ne
 * l'aurait vu** : les 13 portes étaient vertes et Lighthouse à 100/100 sur la liste à puces.
 *
 * Référence relue : `07 site MSL/src/components/training/{TrainingCard,TrainingGrid}.tsx`.
 * On en reprend la **FORME** (grille responsive, coins arrondis, fond légèrement détaché,
 * titre puis description, méta séparée par un filet, survol qui soulève) et **PAS** la charte
 * (MSL est en Tailwind + framer-motion + accents multicolores ; ici c'est CSS Modules, tokens
 * EDS, zéro dépendance).
 *
 * 🔴 TROIS BLOCS DE LA CARD MSL SONT VOLONTAIREMENT ABSENTS, ET C'EST LE LIVRABLE.
 * MSL affiche **durée**, **nombre max de participants** et **prix**. Ici :
 *   · **FR10** — la page est une offre d'**utilité sociale**, jamais une prestation ;
 *   · **FR16** — aucun chiffre de communauté nulle part sur le site ;
 *   · et la page **le dit déjà en ligne** depuis la Story 2.7 : « Le format exact — durée,
 *     nombre de postes, jeux, âge du public — se définit avec vous ».
 * La table `workshop` **n'a pas ces colonnes** (garde de schéma, AC6) : la card ne peut donc
 * pas les afficher, même si quelqu'un le voulait. ⚠️ Ne pas « compléter » cette card.
 *
 * 🔴 ET PAS DE BOUTON « EN SAVOIR PLUS ». Chez MSL la card ouvre une modale portant le détail
 * de la formation. Un atelier n'a que **trois champs** — il n'existe aucun détail à révéler.
 * Un bouton mènerait dans le vide, et une card cliquable sans destination est le défaut que
 * `gate:links` a été écrite pour interdire (dette R2). Le CTA de la page reste « Nous
 * solliciter », en bas.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 IL SE REND `null` QUAND LA FAMILLE N'A AUCUN ATELIER PUBLIÉ — C'EST LE CAS NOMINAL
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Et il le sera **le jour du merge** : la liste des ateliers n'existe dans aucune source du
 * projet (dette R17), elle arrivera par la saisie. La page doit donc rester **exactement**
 * celle d'aujourd'hui tant que la table est vide — les trois familles, leur prose, la phrase
 * de clôture. **Jamais** une grille vide, **jamais** un « Aucun atelier », **jamais** un titre
 * orphelin (NFR8, doctrine `PartnerWall` de la 4.2 : une catégorie vide est entièrement omise,
 * pas rendue creuse).
 */

export interface WorkshopCatalogProps {
  /** Les ateliers publiés de CETTE famille, déjà triés par la requête. */
  ateliers: readonly WorkshopEntry[];
}

export function WorkshopCatalog({ ateliers }: WorkshopCatalogProps) {
  if (ateliers.length === 0) return null;

  return (
    /* `<ul>`/`<li>` et non des `<div>` : c'est une liste d'éléments équivalents, elle doit
       être annoncée comme telle (« liste de 3 éléments »). La grille est portée par le `<ul>`,
       ce qui ne coûte AUCUN nœud supplémentaire.
       ⚠️ `list-style: none` est ici LÉGITIME et ne casse pas la sémantique, contrairement à la
       liste `.publics` de cette même page : le `role="list"` explicite rétablit ce que Safari
       retire quand il voit `list-style: none` (bug WebKit connu). Sans lui, VoiceOver
       n'annoncerait plus « liste de N éléments » — c'est la raison pour laquelle `.publics`,
       elle, garde ses puces natives. Deux cas, deux traitements, et celui-ci est explicite. */
    <ul className={styles.grille} role="list">
      {ateliers.map((atelier) => {
        // `cleanText` ramène `''`, `'   '` et les chaînes de caractères invisibles à `null` :
        // c'est ce qui garantit qu'aucune branche ci-dessous ne rend un fragment vide. La base
        // les refuse déjà (CHECK de la `0010`) et Zod aussi (`visiblementVide`) — ceci est le
        // FILET du rendu, contre un `UPDATE` direct ou une restauration de sauvegarde.
        const resume = cleanText(atelier.summary);
        const publicVise = cleanText(atelier.audience);

        return (
          <li key={atelier.id} className={styles.carte}>
            {/* 🔴 `<h4>` ET NON UN `<strong>`, ET LE PLAN DU DOCUMENT RESTE VALIDE.
                La page tient `h1` (titre) → `h2` (section « Ce qu'on propose ») → `h3` (la
                famille, rendue INCONDITIONNELLEMENT) → `h4` (l'atelier). Aucun niveau n'est
                sauté : une famille sans atelier ne rend simplement aucun `h4`, ce qui est
                valide — un saut n'existerait que si l'on passait de `h3` à `h5`.
                ⚠️ La version précédente utilisait `<strong>` par prudence sur `heading-order`
                (dette R1, payée en 2.1). Avec des cards, le titre EST un titre : le `<h4>`
                rend la page navigable par titres pour un lecteur d'écran, ce qu'un `<strong>`
                ne fait pas. Lighthouse `heading-order` re-mesuré après ce changement. */}
            <h4 className={styles.titre}>{atelier.title}</h4>

            {resume ? <p className={styles.resume}>{resume}</p> : null}

            {/* La méta est séparée par un filet, comme la ligne « prix » de la card MSL — mais
                elle porte le PUBLIC VISÉ, seule donnée de contexte que ce projet s'autorise.
                Absente, elle ne laisse ni filet orphelin, ni étiquette vide : le bloc entier
                disparaît. */}
            {publicVise ? (
              <p className={styles.meta}>
                <span className={styles.metaLabel}>Public</span>
                <span className={styles.metaValeur}>{publicVise}</span>
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
