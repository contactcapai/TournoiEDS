/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * INSTANT AVEC FUSEAU — **UNE SEULE DÉFINITION**, EXTRAITE PAR LA STORY 9.1
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 EXTRAIT AU **DEUXIÈME** CONSOMMATEUR, ET C'EST L'ÉCART DÉLIBÉRÉ QUE LE PROJET A DÉJÀ
 * TRANCHÉ DEUX FOIS. La règle de tête (`METHODE.md` §5, leçon R9) est d'attendre le
 * troisième. `texte.ts` s'en est écarté au deuxième pour `visiblementVide`, et le critère
 * retenu — écrit noir sur blanc dans son en-tête — n'est pas « est-ce générique ? » mais
 * **« sa divergence serait-elle SILENCIEUSE ? »**.
 *
 * Ici elle le serait **doublement**, et c'est mesuré :
 *   ① le piège de fuseau est **invisible en local** — en développement le poste est à Paris
 *      et le résultat tombe juste **par coïncidence** ; le conteneur de production tourne en
 *      **UTC** et la même saisie glisse de deux heures. Ni le lint, ni le typecheck, ni le
 *      build, ni le gate visuel ne voient un décalage de deux heures sur une date d'août ;
 *   ② il est **bidirectionnel** (lecture *et* écriture), constat de la Story 6.3.
 * ⚠️ Et le coût de la copie n'est pas théorique : `texteOptionnel` a vécu en **trois**
 * exemplaires **divergents** (dette R37), dont la divergence n'a été vue qu'à la 6.10 — quinze
 * instruments verts pendant ce temps.
 *
 * 🔴 CODE DÉPLACÉ **VERBATIM** DEPUIS `event.ts`, OÙ IL EST NÉ (Story 3.1, durci en 6.3).
 * Aucune règle n'a été « améliorée » au passage : `event.ts` est une story mergée, et modifier
 * son comportement depuis une story qui porte par ailleurs un modèle neuf serait exactement ce
 * que la 6.9 s'est interdit avant que la 6.10 ne le paie proprement. Le seul changement est
 * l'endroit où le code vit — `event.ts` le CONSOMME désormais au lieu de le déclarer.
 *
 * ⚠️ Ce module ne contient QUE ce qui est réellement partagé. Ne pas y déverser les helpers de
 * date propres à un domaine : `date-paris.ts` porte le formatage et la construction d'heure
 * murale, et c'est lui qu'il faut consommer pour FABRIQUER une valeur.
 */
import { z } from "zod";

/** Une date sérialisée doit porter son fuseau : `…Z` ou `…+02:00`. */
const HAS_EXPLICIT_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * 🔴 UNE CHAÎNE SANS FUSEAU EST REJETÉE, ET C'EST LE CŒUR DE LA GARDE.
 * `new Date('2026-08-06T19:00')` — le format exact que produit un
 * `<input type="datetime-local">` — s'interprète dans le fuseau du **process**. En
 * développement le poste est à Paris et le résultat tombe juste par coïncidence ; le
 * conteneur de production tourne en UTC et la même saisie glisse de deux heures. C'est
 * le piège `date-tz.md`, et un commentaire d'avertissement ne l'empêche pas : ici il est
 * refusé par le schéma. Construire la valeur avec `src/lib/date-paris.ts`, ou sérialiser
 * avec l'offset.
 */
const NO_TIMEZONE_MESSAGE =
  "Date sans fuseau horaire. Sérialisez l'offset (ex. 2026-08-06T19:00:00+02:00) ou " +
  "construisez la valeur avec parisWallClock() — sans quoi l'heure glisse en production.";

/**
 * Un instant, accepté comme `Date` ou comme chaîne ISO **portant son offset**.
 *
 * ⚠️ Volontairement PAS un `z.union([z.date(), z.string()…])` : quand toutes les branches
 * d'une union échouent, zod ne remonte que « Invalid input » et le message ci-dessus est
 * perdu. Or ici le message EST le garde-fou — il dit quoi faire. Mesuré à la revue.
 */
export const instantAvecFuseau = z
  .unknown()
  .superRefine((value, ctx) => {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        ctx.addIssue({ code: "custom", message: "Date invalide." });
      }
      return;
    }
    if (typeof value !== "string") {
      ctx.addIssue({
        code: "custom",
        message: "Date attendue : un objet Date, ou une chaîne ISO avec son fuseau.",
      });
      return;
    }
    const trimmed = value.trim();
    if (!HAS_EXPLICIT_OFFSET.test(trimmed)) {
      ctx.addIssue({ code: "custom", message: NO_TIMEZONE_MESSAGE });
      return;
    }
    if (Number.isNaN(new Date(trimmed).getTime())) {
      ctx.addIssue({ code: "custom", message: "Date invalide." });
    }
  })
  .transform((value) => (value instanceof Date ? value : new Date(String(value).trim())));

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LE MÊME INSTANT, **FACULTATIF** — Story 9.6, deux consommateurs dès le premier jour
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `event.endsAt` et `tournament.endsAt` arrivent **ensemble** (arbitrage A1) : la règle a donc
 * deux consommateurs à la seconde où elle naît, et le critère d'extraction de ce module — *« sa
 * divergence serait-elle SILENCIEUSE ? »* — répond oui **doublement**, exactement comme pour
 * `instantAvecFuseau` : le piège de fuseau est **invisible en local** et **bidirectionnel**.
 *
 * 🔴 `z.nullable()` COURT-CIRCUITE L'INNER SUR `null`, ET C'EST CE QUI REND LA COMPOSITION SÛRE.
 * `instantAvecFuseau` part d'un `z.unknown()` : sans le court-circuit, un `null` y serait jugé
 * *« Date attendue »*, c'est-à-dire qu'un champ **facultatif** refuserait d'être vide. On ne
 * réécrit donc **rien** — on enveloppe. Redéclarer la garde ici en serait la 2ᵉ copie, et
 * `texteOptionnel` a vécu en **trois** exemplaires divergents pendant quatre stories (dette R37).
 *
 * ⚠️ **CE SCHÉMA NE VOIT JAMAIS UNE CHAÎNE DE `<input type="datetime-local">`**, et c'est le
 * partage de responsabilité qu'il faut connaître : la distinction « champ vide » / « saisie
 * illisible » se fait **avant**, à la frontière d'écriture, par `parisWallClockOptionnelFromInput`
 * (`lib/date-paris.ts`). Ici, `null` veut dire **absent**, et rien d'autre.
 */
export const instantAvecFuseauOptionnel = instantAvecFuseau.nullable().default(null);
