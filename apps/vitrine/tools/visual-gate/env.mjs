// 🔑 LA RÉSOLUTION DES VARIABLES D'ENVIRONNEMENT DES PORTES — UN SEUL ENDROIT
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 POURQUOI CE FICHIER EXISTE : LE MÊME NOM PORTAIT DEUX SÉMANTIQUES
// ══════════════════════════════════════════════════════════════════════════════════════
//
// Avant la Story 7.11, `lireVariable` était **DUPLIQUÉ dans SEPT fichiers**, et les copies
// ne faisaient pas la même chose :
//
//   · cinq copies (galerie, partenaires, membres, sollicitations, reglages) commençaient par
//       if (process.env[nom]) return process.env[nom]!;
//     ⇒ ces portes étaient **pilotables** par `DATABASE_URL=… pnpm …` ;
//   · celle d'`ateliers` ne le faisait pas          ⇒ porte **bloquée** depuis le 2026-08-13 ;
//   · celle de `tournois` ne le faisait pas non plus, mais compensait par un
//       process.env.DATABASE_URL ?? lireVariable("DATABASE_URL")
//     **à l'appel** — donc pilotable, pour une raison invisible dans le helper ;
//   · `reseaux` n'avait pas de helper du tout : une **regex en ligne** sur le fichier,
//     au milieu de sa garde ⑪ ⇒ porte **bloquée**, et personne ne le savait.
//
// C'est la famille exacte de la dette **R37** (la sémantique divergente de `texteOptionnel`,
// que `gate:membres` ré-exerce sur les trois schémas pour cette raison).
//
// 🔴 CE QUE CETTE DIVERGENCE A COÛTÉ, ET C'EST MESURÉ : `gate:list` a tenté de dériver la
// pilotabilité en **lisant le texte** des portes, et s'est trompée **TROIS FOIS EN UN JOUR**
// (PR #53) — d'abord en accusant **cinq portes innocentes** (leçon n°1 de la rétro Epic 6,
// refaite par l'instrument censé l'appliquer par construction), puis par un **faux négatif**
// qui rendait une porte bloquée **invisible**, puis par un `indexOf` qui tombait dans un
// commentaire d'en-tête. Le chiffre faux avait déjà été recopié dans une dette, dans le
// cadrage d'une story et dans une réponse à Brice avant d'être mesuré.
//
// ⇒ **On ne rend pas la dérivation plus maligne : on supprime ce qu'elle devait deviner.**
// Une porte importe ce module, ou elle ne l'importe pas. `gate:list` lit ce fait **binaire**
// au lieu de reconnaître des motifs. C'est la différence entre dériver et inférer.
//
// ⚠️ **NE JAMAIS RE-DUPLIQUER CE HELPER**, même « pour éviter un import » : c'est exactement
// le geste qui a produit les deux sémantiques.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

// Le chemin se calcule depuis CE fichier, pas depuis l'appelant : une porte déplacée d'un
// sous-dossier continuerait de trouver `.env.local`.
const RACINE_APP = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Résout une variable pour les portes : **l'environnement d'abord**, `.env.local` ensuite.
 *
 * 🔴 L'ORDRE EST LE LIVRABLE. Depuis la règle du 2026-08-13 (« le rendu se regarde sur
 * staging »), il n'y a plus de Postgres local : c'est `DATABASE_URL=… pnpm --filter vitrine
 * gate:x` qui vise la base réelle. Une porte qui lirait `.env.local` en premier resterait
 * collée à `localhost:5434`, une base **supprimée** — et son échec de connexion serait le
 * seul témoin, ce qui a laissé des portes muettes pendant deux jours.
 *
 * ⚠️ **LE REPLI SUR `.env.local` EST CONSERVÉ À DESSEIN** : un poste qui rallumerait une base
 * locale doit continuer de fonctionner sans variable d'environnement. Le supprimer serait
 * élargir la story à une casse gratuite.
 *
 * @param {string} nom
 * @returns {string | null}
 */
export function lireVariable(nom) {
  if (process.env[nom]) return process.env[nom];
  try {
    const contenu = readFileSync(join(RACINE_APP, ".env.local"), "utf8");
    const ligne = contenu.split(/\r?\n/).find((l) => l.trim().startsWith(`${nom}=`));
    return ligne
      ? ligne
          .slice(ligne.indexOf("=") + 1)
          .trim()
          .replace(/^["']|["']$/g, "")
      : null;
  } catch {
    return null;
  }
}

/** Raccourci nommé — `agenda-check.mts` l'appelait ainsi avant l'unification. */
export function lireDatabaseUrl() {
  return lireVariable("DATABASE_URL");
}
