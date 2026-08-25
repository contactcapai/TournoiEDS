/**
 * Ce que DEUX surfaces de saisie paient à l'identique (Story 6.4, extraction).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 EXTRAIT AU 2ᵉ CONSOMMATEUR, ET LE COMPTE EST ÉCRIT — jamais « au cas où »
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * La Story 6.3 a écrit la première surface de saisie en s'interdisant explicitement de
 * fabriquer un framework pour six consommateurs qui n'existaient pas. La 6.4 est le 2ᵉ
 * consommateur : c'est ici, et seulement ici, que l'extraction se paie. La leçon de R9
 * n'est PAS « ne jamais dupliquer », c'est **« toujours COMPTER »** — le décompte initial
 * de R9 était faux parce que personne n'avait compté. Le compte de cette story vit dans son
 * Dev Agent Record, y compris pour ce qu'elle a décidé de NE PAS extraire.
 *
 * ⚠️ CE MODULE NE PORTE PAS `"use server"`. Un fichier `"use server"` n'a le droit
 * d'exporter que des fonctions asynchrones : `ResultatAction` (un type) et `identifiant`
 * (un schéma) y seraient refusés. Ce n'est pas une Server Action, c'est le vocabulaire
 * qu'elles partagent.
 *
 * ⚠️ ET IL NE PORTE PAS `import "server-only"` NON PLUS, contrairement à `server/db/**` et
 * `server/medias/`. Ceux-là touchent la base ou le disque ; celui-ci ne contient qu'un
 * type, un schéma de format et deux fonctions pures. La garde `server-only` casserait un
 * `import type { ResultatAction }` depuis un formulaire client — un coût réel pour une
 * protection qui n'a ici rien à protéger.
 */
import { z } from "zod";

import { parisWallClockOptionnelFromInput } from "../../lib/date-paris";

/**
 * Retour discriminé commun à toutes les actions d'administration (AR-API1).
 *
 * Né dans `actions/agenda.ts` (6.3), repayé à l'identique par la galerie : 2 consommateurs.
 * ⚠️ `submitSolicitation` (5.1) n'en fait PAS partie et ne doit pas être aligné dessus :
 * elle n'a pas de `data`, parce que son écran n'a rien à consommer. Uniformiser pour
 * uniformiser lui ferait rendre une valeur que personne ne lit.
 */
export type ResultatAction<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Identifiant attendu par une action de mise à jour ou de suppression.
 *
 * ⚠️ Les pages valident déjà l'`id` de route avant d'atteindre la base, mais une Server
 * Action n'est **pas** une page : elle est atteignable par un POST direct. Sans cette
 * garde, un identifiant malformé y lève le `22P02` brut de Postgres — derrière
 * la garde de rôle de l'action, donc sans risque, mais incohérent avec la doctrine du projet.
 */
export const identifiant = z.uuid();

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 L'HEURE DE FIN SAISIE — DEUX ACTIONS, **UNE** LECTURE (Story 9.6)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `agenda.ts` et `tournois.ts` lisent le même champ facultatif, avec la même règle, dès le
 * premier jour (arbitrage A1 : les deux colonnes arrivent ensemble). Deux copies d'une règle de
 * fuseau divergent **en silence** et **invisiblement en local** — le poste est à Paris, le
 * conteneur de production tourne en UTC. C'est le mécanisme de la dette **R37**, où
 * `texteOptionnel` a vécu en trois exemplaires divergents pendant quatre stories.
 *
 * 🔴 **CE QU'ELLE PROTÈGE : QU'UNE FAUTE DE FRAPPE N'EFFACE PAS UNE FIN DÉJÀ ENREGISTRÉE.**
 * `parisWallClockFromInput` rend `null` sur une chaîne **vide** comme sur une saisie
 * **invalide** (mesuré). Traiter les deux pareil ferait passer `"2026-13-45T99:99"` pour « pas
 * renseigné », et la mise à jour **viderait la colonne** sans un mot. C'est très exactement le
 * motif déjà écrit sur `entierOptionnel` (`actions/tournois.ts`) : *« On ne transforme PAS une
 * saisie illisible en `null` : une faute de frappe effacerait alors silencieusement la valeur
 * déjà enregistrée, au lieu d'être signalée. »*
 *
 * ⚠️ **ELLE NE REND PAS L'AVERTISSEMENT DE CHANGEMENT D'HEURE** (dette R23), et c'est une
 * correction née de la revue : elle le rendait, ce qui donnait **deux propriétaires** au même
 * message — celui du début vivait dans l'action, celui de la fin ici, et l'action les
 * assemblait par un ternaire qui en jetait un. Le message des **deux** bornes se compose
 * désormais en un seul endroit, `avertissementHeuresMurales` (`lib/date-paris.ts`), qui sait
 * aussi préfixer chaque moitié — sans quoi *« L'événement sera enregistré à 3h00 »* serait faux
 * appliqué à une fin.
 * ⚠️ **La règle « la fin est après le début » n'est PAS ici** non plus : elle regarde DEUX
 * champs, donc elle vit dans les schémas Zod (et dans les `CHECK`), là où le formulaire sait
 * poser le focus.
 * ⇒ Cette fonction ne décide plus que d'**une** chose : lire la fin, ou dire pourquoi elle est
 * illisible.
 */
export function lireHeureDeFin(
  formData: FormData,
  champ = "endsAt",
):
  | { ok: true; fin: Date | null }
  | { ok: false; error: string; fieldErrors: Record<string, string> } {
  const lecture = parisWallClockOptionnelFromInput(String(formData.get(champ) ?? ""));

  if (lecture.cas === "absent") return { ok: true, fin: null };

  if (lecture.cas === "invalide") {
    return {
      ok: false,
      error: "Cette heure de fin n'existe pas.",
      fieldErrors: {
        [champ]: "Vérifiez le jour, le mois et l'heure : cette date n'existe pas.",
      },
    };
  }

  return { ok: true, fin: lecture.instant };
}

/** Première erreur par champ, dans la forme attendue par les formulaires. */
export function erreursParChamp(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const erreurs: Record<string, string> = {};
  for (const issue of issues) {
    const clef = issue.path[0];
    if (typeof clef === "string" && !(clef in erreurs)) erreurs[clef] = issue.message;
  }
  return erreurs;
}

/**
 * Traduit une erreur Postgres en phrase utilisable par un bénévole.
 *
 * 🔴 SANS CETTE TRADUCTION, LA GARDE LA PLUS SOIGNÉE DU PROJET REND
 * `violates check constraint "photo_alt_valide"` À QUELQU'UN QUI VEUT JUSTE PUBLIER UNE
 * PHOTO. Les `CHECK` sont le garde-fou qu'on ne peut pas contourner ; ils ne sont pas
 * censés parler, et Zod devrait les avoir devancés. Si l'un d'eux tire quand même, c'est
 * soit un chemin qui contourne Zod, soit une divergence entre les deux — les deux méritent
 * une trace, d'où le `console.error` de l'appelant.
 *
 * 🔴 LE TRADUCTEUR EST PARTAGÉ, SA TABLE NE L'EST PAS — ET C'EST LE POINT DE L'EXTRACTION.
 * `CHAMP_PAR_CONTRAINTE` compte dix entrées, toutes `event_*` / `bar_*` : la fusionner avec
 * celle de la galerie ferait qu'un ajout de contrainte côté agenda toucherait un fichier de
 * la galerie, et réciproquement. Chaque domaine passe donc SA table en paramètre.
 *
 * ⚠️ `constraint_name` AVANT `constraint`, et ce n'est pas au hasard : le projet parle à
 * Postgres par **postgres.js**, qui remplit `constraint_name` (MESURÉ le 2026-08-03 —
 * `constraint` y est `undefined`). Le repli existe pour ne pas dépendre de ce détail si le
 * driver changeait. C'est aussi ce qui a réfuté, par la mesure, un finding « réel » de la
 * revue de la 6.3 qui raisonnait sur le driver `pg`.
 *
 * @param champParContrainte table du DOMAINE appelant : nom de contrainte → nom lisible du
 *   champ. Une contrainte absente de la table retombe sur un message générique — utilisable,
 *   mais qui ne nomme aucun champ : c'est le défaut trouvé en revue de la 6.3, où **huit**
 *   contraintes sur dix y tombaient.
 * @param cas particuliers du domaine, pour les contraintes dont le message ne se déduit pas
 *   du nom d'un champ (`event_has_venue` en est le seul exemple à ce jour).
 */
export function messageErreurBase(
  erreur: unknown,
  champParContrainte: Record<string, string>,
  cas: Record<string, string> = {},
): string {
  const details = erreur as { code?: string; constraint_name?: string; constraint?: string };
  const contrainte = details.constraint_name ?? details.constraint ?? "";

  if (details.code === "23503") {
    return "L'élément choisi n'existe plus. Rechargez la page et choisissez-en un autre.";
  }

  if (details.code === "22P02") {
    return "Cet identifiant n'est pas valide. Rechargez la page.";
  }

  /**
   * 🔴 `23505` — VIOLATION D'UNICITÉ, AJOUTÉE PAR LA STORY 6.4. `photo.filename` est
   * `unique()` depuis la 4.3, et son commentaire nommait déjà cette story : *« des
   * bénévoles re-téléverseront le même fichier sans le savoir »*. Avec un nom généré par
   * UUID la collision de NOM est hors d'atteinte en pratique — mais une contrainte qui peut
   * tirer et dont personne n'a écrit le message rend du texte de driver.
   * ⚠️ Ce message ne couvre PAS le doublon de CONTENU : deux téléversements de la même
   * image sous deux noms différents sont parfaitement acceptés par la base. C'est un fait à
   * DIRE à l'écran, pas une erreur à traduire ici.
   */
  if (details.code === "23505") {
    return "Cet élément existe déjà. Rechargez la page pour voir l'état réel.";
  }

  if (details.code === "23514") {
    const particulier = cas[contrainte];
    if (particulier) return particulier;

    const champ = champParContrainte[contrainte];
    if (champ) {
      return `La base refuse ${champ} : il est vide ou trop long. Reprenez ce champ dans le formulaire.`;
    }
    return "Une des valeurs saisies est refusée par la base (texte vide ou trop long). Reprenez le formulaire.";
  }

  return "Une erreur est survenue à l'enregistrement, merci de réessayer.";
}
