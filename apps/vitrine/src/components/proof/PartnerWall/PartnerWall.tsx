import Image from "next/image";
import { NEW_TAB_SR, isExternalUrl } from "@/lib/links";
import type { PartnerEntry } from "@/server/db/queries/partners";
import editorial from "@/styles/editorial.module.css";
import styles from "./PartnerWall.module.css";

// Un MUR de partenaires — une catégorie, un titre, une grille de tuiles (Story 4.2).
// Transcription de `.lbl` + `.logos-wall` + `.logo-tile` de
// docs/refonte-2026/maquette/index.html (CSS l.160-164, markup l.386-403).
//
// Server Component : rien n'est interactif ici. Le survol est du CSS, le lien est un
// <a>. Cette page est la première de l'Epic 4 entièrement RSC — ne pas l'entamer.
//
// Vit dans `components/proof/` (et non `components/partenaires/`) parce que la Story
// 4.1 a créé cette famille en annonçant précisément que « la Story 4.2 réutilisera le
// rendu d'un partenaire » (architecture.md l.560, ProofBand.tsx l.21-23).
//
// 🔴 CE COMPOSANT EST LE PENDANT DOCUMENTAIRE DU BANDEAU DE LA HOME, PAS SA COPIE.
// Le bandeau (PartnerMarquee) OMET une entrée sans logo ; ce mur l'AFFICHE, avec son
// nom dans la tuile. C'est l'arbitrage de Brice du 2026-07-31, et c'est aussi ce que
// rend la maquette : ses « cases » portent le NOM en texte — elles SONT le
// « placeholder maîtrisé » d'UX-DR12, il n'y a pas de cadre vide à inventer.

export interface PartnerWallProps {
  /** Libellé public de la catégorie (« Nos sponsors »). Contractuel — voir la page. */
  label: string;
  /** Id posé sur le <h2>, pour l'`aria-labelledby` de la <section>. */
  titleId: string;
  /** Les entrées de CETTE catégorie, déjà triées par la requête. Jamais vide : la page
   *  omet le mur entier plutôt que de rendre un titre orphelin (AC4). */
  entries: PartnerEntry[];
  /** Variante `.inst` de la maquette (filet or léger) — réservée aux soutiens. */
  institutionnel?: boolean;
}

export function PartnerWall({ label, titleId, entries, institutionnel }: PartnerWallProps) {
  return (
    <section className={styles.wall} aria-labelledby={titleId}>
      {/* `editorial.subtitle` et non `editorial.title` : ces quatre libellés sont
          SUBORDONNÉS au <h1> de la page (Bebas 24px vs l'échelle 40→66px du titre de
          page). C'est le vocabulaire partagé, pas une 3ᵉ copie d'une règle de titre —
          la 3ᵉ page dédiée CONSOMME editorial.module.css (dette R9).
          ⚠️ Ce n'est PAS `.lbl` de la maquette (12px, --grey) : `.lbl` y est un
          sous-label à l'intérieur d'une section déjà titrée « Reconnus, soutenus,
          connectés », alors qu'ici ces libellés STRUCTURENT la page. Et `--grey`
          tomberait à 3,25:1 sous le fondu de motion.reveal (calcul dans le CSS). */}
      <h2 id={titleId} className={editorial.subtitle}>
        {label}
      </h2>

      {/* <ul> et non une suite de <div> : c'est une liste, elle doit être annoncée
          comme telle (« liste de 4 éléments »). Le reset de `list-style` est posé
          dans le CSS — globals.css n'en pose pas pour <ul> (vérifié en 4.1). */}
      <ul className={styles.grille}>
        {entries.map((entry) => (
          <PartnerCard key={entry.id} entry={entry} institutionnel={institutionnel} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Une entrée : la tuile (logo OU nom), puis la description si elle existe.
 *
 * 🔴 LES TROIS BRANCHES DE CE COMPOSANT SONT LE CAS NOMINAL, PAS DES CAS LIMITES.
 * Sur les 11 entrées en base au 2026-07-31 : **4 ont un logo**, **2 une description**,
 * **0 un lien**. Une conception qui traiterait la donnée pleine puis « dégraderait »
 * rendrait aujourd'hui 7 cadres vides et 0 lien.
 */
function PartnerCard({
  entry,
  institutionnel,
}: {
  entry: PartnerEntry;
  institutionnel?: boolean;
}) {
  // 🔴 ON PASSE PAR `isExternalUrl()`, PAS PAR LA SEULE PRÉSENCE DE `link`.
  // Le schéma Zod (`lib/schemas/partner.ts`) garantit une URL http(s) absolue AU POINT
  // DE SAISIE, mais un `UPDATE` direct ne passe par aucun schéma — le `CHECK` en base
  // n'interdit que le blanc. Une valeur relative (« mately.fr ») rendrait ici un lien
  // INTERNE vers une route inexistante de la vitrine, sans que rien ne l'annonce.
  // C'est exactement le défaut que `optionalHttpUrl` décrit (l.99-115) et qu'il ne peut
  // pas empêcher côté lecture. En cas de doute, on n'affiche pas de lien : une tuile
  // muette est toujours moins grave qu'un lien qui ment.
  const lien = entry.link !== null && isExternalUrl(entry.link) ? entry.link : null;

  const classesTuile = [styles.tuile, institutionnel ? styles.inst : null, lien ? styles.cliquable : null]
    .filter(Boolean)
    .join(" ");

  const contenu =
    entry.logo !== null ? (
      // Ce <span> porte la respiration de 10px de la maquette, et il n'est PAS
      // décoratif : `fill` fait poser à next/image des styles EN INLINE qu'aucune
      // classe CSS ne peut surcharger, et un `padding` sur la tuile ne réduirait pas
      // la boîte de l'image (l'`inset` d'un absolu se résout sur la boîte de PADDING
      // de son ancêtre positionné). Raisonnement complet dans PartnerMarquee.module.css.
      <span className={styles.zone}>
        <Image
          src={entry.logo}
          // Le nom du partenaire est le texte alternatif utile (EXPERIENCE.md l.194) :
          // un logo dit QUI soutient l'asso, pas à quoi il ressemble. Sur les 4 entrées
          // à logo, c'est le SEUL endroit où le nom existe — la tuile porte le logo OU
          // le nom, jamais les deux (arbitrage ②).
          alt={entry.name}
          // `fill` et non des dimensions intrinsèques : `partner` ne stocke PAS les
          // dimensions du logo, et la Story 6.5 fera téléverser des fichiers de tailles
          // quelconques. La place est réservée par la TUILE (zéro CLS, NFR2).
          fill
          // `object-fit: contain` (dans le .module.css) et JAMAIS `cover` : `cover`
          // recadrerait un logo, c'est-à-dire mutilerait une marque tierce.
          className={styles.image}
          // La tuile va de 150px (base) à 210px (plafond) : `sizes` prend la borne haute.
          sizes="210px"
          loading="lazy"
          // ⚠️ `unoptimized` — même raison de PÉRIMÈTRE qu'en 4.1, pas le motif écrit
          // dans la dette R15 (« sharp absent »), qui est FAUX : sharp est présent et
          // NON DÉCLARÉ. Lever cette dette appartient à la Story 4.3, qui devra
          // d'abord DÉCLARER sharp dans apps/vitrine/package.json.
          unoptimized
        />
      </span>
    ) : (
      // 🔴 LE NOM DANS LA TUILE : c'est le rendu littéral de la maquette, dont les
      // « cases » portent le nom en texte (l.386-403). La note de bas de maquette
      // (« cases = emplacements logos, à remplacer ») parle des IMAGES, pas des NOMS.
      <span className={styles.nom}>{entry.name}</span>
    );

  return (
    <li className={styles.item}>
      {lien !== null ? (
        <a
          className={classesTuile}
          href={lien}
          target="_blank"
          rel="noopener noreferrer"
        >
          {contenu}
          {/* Phrasé unifié du site (`lib/links.ts`), jamais réécrit sur place. */}
          <span className="sr-only">{NEW_TAB_SR}</span>
        </a>
      ) : (
        // 🔴 PAS un <a> sans href, PAS un <div role="link"> : une tuile sans lien n'est
        // pas interactive du tout. Elle ne prend pas le focus, n'a pas de curseur main
        // et n'annonce rien. ⚠️ C'est l'état des 11 entrées d'aujourd'hui (`link` vaut
        // `null` partout) — donc l'état que le gate visuel verra.
        <div className={classesTuile}>{contenu}</div>
      )}

      {/* Une description absente MASQUE la ligne : pas de <p> vide qui ouvrirait un
          blanc sous la tuile et casserait l'alignement du mur. 9 entrées sur 11. */}
      {entry.description !== null ? (
        <p className={styles.description}>{entry.description}</p>
      ) : null}
    </li>
  );
}
