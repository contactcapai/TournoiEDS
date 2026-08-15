"use server";

import { and, eq } from "drizzle-orm";

import { avertissementHeuresMurales, parisWallClockFromInput } from "../../lib/date-paris";
import { tournamentInputSchema } from "../../lib/schemas/tournament";
import { requireAdmin } from "../auth/guard";
import { db } from "../db/client";
import { slugDejaPris } from "../db/queries/tournaments";
import { tournament } from "../db/schema";
import {
  erreursParChamp,
  identifiant,
  lireHeureDeFin,
  messageErreurBase as traduireErreurBase,
  type ResultatAction,
} from "./_commun";

/**
 * Server Actions des tournois du back-office (Story 9.1, A21/A22/A23, AR-API1).
 *
 * Le patron de saisie est celui d'`actions/agenda.ts` (6.3), `actions/ateliers.ts` (6.9) puis
 * `actions/reglages.ts` (6.13), repris **littéralement** : `await requireAdmin()` en PREMIÈRE
 * LIGNE de chaque action, retour discriminé, `identifiant` sur tout `id` reçu, aucun
 * `revalidateTag` (les pages publiques sont `force-dynamic`, il n'y a rien à invalider —
 * `check:docs` a une règle qui le tient).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 `requireAdmin()` EST PAYÉ **ICI**, PAS SEULEMENT DANS LE PROXY — FAIT MESURÉ EN 6.1
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Documentation Next 16 (`proxy.js`, § Execution order), citée dans `server/auth/guard.ts` :
 * *« Server Functions are not separate routes in this chain […] a Proxy matcher that excludes
 * a path will also skip Proxy coverage […] Always verify authentication and authorization
 * inside each Server Function rather than relying on Proxy alone. »*
 * ⇒ Une garde oubliée ici serait **silencieuse** : elle ne casse rien, elle laisse passer.
 *
 * ⚠️ **CETTE SECTION EST OUVERTE AUX ADMINISTRATEURS ACTUELS**, et l'écart est écrit plutôt que
 * subi (A22) : `requireAdmin()` ne connaît **qu'un seul rôle**. La restriction au rôle **admin
 * tournoi** arrive avec la **Story 8.1** (A2, dette **R39** rouverte le 2026-08-13 : trois
 * comptes existent sur staging). Jusque-là, quiconque peut modifier le site peut modifier les
 * tournois — c'est un fait connu, pas une découverte à faire plus tard.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QUI EST PLUS SIMPLE ICI QUE PARTOUT AILLEURS, ET POURQUOI ON N'IMPORTE PAS LE RESTE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Un tournoi n'a **aucun fichier** (le visuel viendra de la galerie, A2, et pas dans cette
 * story) et **aucun ordre manuel** — il est ordonné par sa DATE. Il n'y a donc ici ni
 * `server/medias`, ni `sharp`, ni octets orphelins, ni renumérotation, ni **concurrence
 * optimiste sur un rang**. Les importer « par symétrie » avec les ateliers ou les partenaires
 * ajouterait du code qui ne protège rien.
 */

/**
 * Nom lisible du champ derrière chaque contrainte de la table `tournament`.
 *
 * 🔴 LES NOMS SONT CEUX DES MIGRATIONS `0014`, `0015` ET `0017`, VÉRIFIÉS DANS LES `.sql`
 * GÉNÉRÉS. ⚠️ **Ce bloc annonçait « les QUATORZE noms » — le compte est retiré le 2026-08-14
 * (Story 9.6), et c'est le correctif.** Il valait pour les deux tables réunies au moment où il a
 * été écrit ; il s'est désaligné à la première contrainte ajoutée, exactement comme les cinq
 * comptes à la main que ce projet a déjà payés (`_sections.ts`, `CHAMPS_URL`, la couverture
 * d'autotest de `gate:reseaux`, la liste `INTERDITS` de `gate:tournois`, l'en-tête de
 * `tournament`). Ce qui fait foi est le `.sql`, pas un nombre recopié ici. Une
 * contrainte absente de cette table retombe sur un message générique qui **ne nomme aucun
 * champ** — c'est le défaut trouvé en revue de la 6.3, où huit contraintes sur dix y tombaient.
 * ⚠️ TABLE PROPRE À CE DOMAINE : le traducteur d'`_commun.ts` est partagé, sa table ne l'est
 * pas. Une table commune ferait qu'ajouter une contrainte côté agenda toucherait les tournois.
 */
const CHAMP_PAR_CONTRAINTE: Record<string, string> = {
  tournament_name_valide: "le nom du tournoi",
  tournament_game_valide: "le jeu",
  tournament_slug_valide: "l'identifiant de l'adresse",
  // ⚠️ « la salle ou l'espace » jusqu'à la 9.5 : le champ ne précisait alors QUE l'intérieur
  // du lieu de l'événement. Détaché, il EST le lieu — et l'écran l'appelle « Lieu du tournoi ».
  // Un message qui nomme un autre concept que l'étiquette du champ fait chercher.
  tournament_venue_name_valide: "le lieu du tournoi",
  tournament_format_text_valide: "le déroulé annoncé",
  tournament_prizes_valide: "les lots",
  tournament_price_text_valide: "le tarif", // Story 9.6

  tournament_match_duration_valide: "la durée d'un match",
  tournament_capacity_valide: "le nombre de places",
  tournament_registration_url_valide: "l'adresse d'inscription",
  tournament_podium_first_valide: "la première place du podium",
  tournament_podium_second_valide: "la deuxième place du podium",
  tournament_podium_third_valide: "la troisième place du podium",
};

/**
 * Cas dont le message ne se déduit PAS du nom d'un champ.
 *
 * Ils portent des règles qui mettent **deux colonnes en relation** : nommer un seul champ
 * serait faux la moitié du temps (patron `event_has_venue`).
 */
const CAS_PARTICULIERS: Record<string, string> = {
  /**
   * 🔴 CE CAS EST CENSÉ ÊTRE INATTEIGNABLE — ET C'EST EXACTEMENT POUR ÇA QU'IL EST ÉCRIT.
   *
   * Le `superRefine` de `tournamentInputSchema` porte la même règle et parle **avant** la base
   * (avec le focus sur le bon champ). Ce message-ci ne sert donc que si la base est atteinte
   * autrement : une écriture concurrente, un `UPDATE` direct, une restauration. Sans lui, le
   * bénévole lirait un `violates check constraint "tournament_a_un_lieu"` brut — et c'est
   * précisément le défaut trouvé en revue de la 6.3, où huit contraintes sur dix rendaient un
   * message qui ne nommait aucun champ.
   */
  tournament_a_un_lieu:
    "Un tournoi sans événement d'agenda doit indiquer son lieu : c'est ce lieu que " +
    "l'agenda affichera. Choisissez un événement, ou renseignez le lieu du tournoi.",
  tournament_mately_a_son_url:
    "Un tournoi dont les inscriptions passent par MATELY doit porter une adresse " +
    "d'inscription : sans elle, la fiche annoncerait des inscriptions sans aucun moyen de " +
    "s'inscrire.",
  tournament_podium_sans_trou_2:
    "Renseignez la première place du podium avant la deuxième.",
  tournament_podium_sans_trou_3:
    "Renseignez la deuxième place du podium avant la troisième.",
  /**
   * Story 9.6. Elle regarde **deux** colonnes, donc elle est ici et pas dans la table
   * précédente : nommer « l'heure de fin » seule laisserait croire que la valeur est
   * malformée, alors que c'est sa RELATION au début qui ne va pas.
   * ⚠️ Le message parle du **jour** autant que de l'heure : la faute la plus probable est une
   * fin après minuit saisie avec la date du début.
   */
  tournament_fin_apres_debut:
    "L'heure de fin doit être après le début. Vérifiez le jour autant que l'heure : une fin " +
    "après minuit tombe le lendemain.",
};

/**
 * Traducteur partagé (`_commun.ts`), appliqué à la table de CE domaine.
 *
 * ⚠️ DEUX CODES SONT RÉÉCRITS ICI, ET CHACUN POUR UNE RAISON PROPRE À CETTE TABLE :
 *   · `23505` — `_commun.ts` rend « Cet élément existe déjà », vrai mais inutilisable : la
 *     **seule** contrainte d'unicité de `tournament` est celle de l'identifiant d'adresse, et
 *     c'est la seule chose que le bénévole peut corriger ;
 *   · `23503` — la **seule** clé étrangère est l'événement de rattachement (A4). Le message
 *     générique parle d'« élément » parce qu'il sert plusieurs domaines ; le nommer évite de
 *     faire chercher. ⚠️ Symétrique du correctif posé dans `actions/agenda.ts` par cette même
 *     story, dans l'autre sens (là-bas : une suppression d'événement **bloquée** par un
 *     tournoi ; ici : un rattachement à un événement **disparu**).
 */
function messageErreurBase(erreur: unknown): string {
  const details = erreur as { code?: string; constraint_name?: string; constraint?: string };
  const contrainte = details.constraint_name ?? details.constraint ?? "";

  if (details.code === "23505" && contrainte.includes("slug")) {
    return (
      "Cette adresse est déjà utilisée par un autre tournoi. Changez l'identifiant de " +
      "l'adresse — deux tournois ne peuvent pas partager la même page."
    );
  }
  if (details.code === "23503") {
    return (
      "L'événement d'agenda choisi n'existe plus. Rechargez la page et choisissez-en un autre."
    );
  }
  return traduireErreurBase(erreur, CHAMP_PAR_CONTRAINTE, CAS_PARTICULIERS);
}

/** Ce que l'écran reçoit après un enregistrement réussi. */
export type TournoiEnregistre = {
  id: string;
  /** Message R23 quand l'heure saisie est inexistante ou ambiguë. `null` sinon. */
  avertissement: string | null;
};

/**
 * Lit un entier facultatif d'un `FormData`.
 *
 * 🔴 LA CHAÎNE VIDE DOIT VALOIR `null` ET **JAMAIS `0`** — et c'est le premier piège de ce
 * helper. `Number("")` rend **`0`**, une valeur parfaitement plausible qui **change le sens** :
 * « aucune capacité annoncée » deviendrait « zéro place ». On teste donc la chaîne AVANT de
 * convertir.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CHIFFRES SEULEMENT — ET CE BLOC A ÉTÉ CORRIGÉ APRÈS REVUE, PARCE QU'IL DÉCRIVAIT UNE
 * GARDE QUI N'EXISTAIT PAS
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Il disait : *« `Number("12abc")` rend `NaN`, que `z.number()` refuse avec un message
 * lisible »*. 🔬 **Mesuré, et c'est FAUX** : `z.number()` refuse bien, mais avec son message
 * natif — **`« Invalid input: expected number, received NaN »`**, en anglais, remonté tel quel
 * au bénévole par `erreursParChamp`. C'est-à-dire exactement ce que `_commun.ts` existe pour
 * empêcher côté base (*« sans cette traduction, la garde la plus soignée du projet rend
 * `violates check constraint` à quelqu'un qui veut juste publier »*), reproduit côté Zod.
 * ⇒ Piège `pieges/avertissement-commentaire.md` : **un commentaire affirmatif et faux est un
 * défaut à part entière, parce que quelqu'un s'y fiera.**
 *
 * 🔴 ET `Number()` EST TROP PERMISSIF POUR UN CHAMP DE SAISIE HUMAIN, ce que la même mesure a
 * montré : `Number("1e2")` rend **100** et `Number("0x10")` rend **16**. Ni l'un ni l'autre
 * n'est dangereux (les plafonds 600 et 4096 bornent largement), mais un bénévole qui tape
 * `1e2` obtiendrait **100** sans jamais comprendre pourquoi. On exige donc des **chiffres**,
 * avec un signe facultatif — et tout le reste est rendu à Zod sous une forme qu'il refuse avec
 * **le message français du champ**.
 *
 * @returns `null` si le champ est vide · le nombre si la saisie est un entier littéral ·
 *   `NaN` sinon, que le schéma refuse avec son propre message (voir `tournament.ts`).
 */
function entierOptionnel(valeur: FormDataEntryValue | null): number | null {
  const texte = String(valeur ?? "").trim();
  if (texte.length === 0) return null;
  // ⚠️ On ne transforme PAS une saisie illisible en `null` : une faute de frappe **effacerait**
  // alors silencieusement la valeur déjà enregistrée, au lieu d'être signalée.
  if (!/^[+-]?\d+$/.test(texte)) return Number.NaN;
  return Number(texte);
}

/**
 * Crée ou met à jour un tournoi.
 *
 * 🔴 LA DATE EST CONVERTIE **AVANT** ZOD, ET C'EST L'ORDRE QUI COMPTE. Le champ
 * `<input type="datetime-local">` rend `"2026-11-21T14:00"` — **sans fuseau, par
 * spécification** —, c'est-à-dire exactement la forme que `instantAvecFuseau` REFUSE. La
 * conversion passe par `parisWallClockFromInput`, seul pont autorisé, et Zod reçoit un `Date`
 * déjà juste. Inverser les deux ferait échouer toute saisie avec le message « Date sans fuseau
 * horaire », que le bénévole ne pourrait pas corriger. Piège `date-tz.md`, mesuré en 6.3, et
 * il est **bidirectionnel et invisible en local**.
 *
 * ⚠️ `idExistant` est passé en ARGUMENT par l'appelant — **jamais lu depuis `formData`**, où
 * il serait modifiable par le client.
 *
 * ⚠️ `isPublished` est **ABSENT** de ce qui est écrit, et **l'omission EST la garde** : il a sa
 * propre action, donc ce formulaire ne peut pas écraser une publication basculée depuis la
 * liste pendant qu'il était ouvert. C'est la dette **R35** rendue sans objet par le découpage
 * plutôt que par un jeton de version (patron 6.9).
 */
export async function enregistrerTournoi(
  idExistant: string | null,
  formData: FormData,
): Promise<ResultatAction<TournoiEnregistre>> {
  await requireAdmin();

  if (idExistant !== null && !identifiant.safeParse(idExistant).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  const saisieDate = String(formData.get("startsAt") ?? "");
  const instant = parisWallClockFromInput(saisieDate);

  if (instant === null) {
    return {
      ok: false,
      error: "Cette date n'existe pas.",
      fieldErrors: {
        startsAt: "Vérifiez le jour, le mois et l'heure : cette date n'existe pas.",
      },
    };
  }

  // 🔴 Story 9.6 — l'heure de fin est FACULTATIVE, et sa lecture ne peut pas être celle du
  // début : `null` y voudrait dire à la fois « pas renseigné » et « illisible », donc une faute
  // de frappe EFFACERAIT une fin déjà enregistrée. C'est le symétrique exact de ce
  // qu'`entierOptionnel` fait quelques lignes plus haut, et pour le même motif — d'où une
  // lecture partagée, `lireHeureDeFin`, plutôt qu'une seconde règle de fuseau.
  const lectureFin = lireHeureDeFin(formData);
  if (!lectureFin.ok) {
    return { ok: false, error: lectureFin.error, fieldErrors: lectureFin.fieldErrors };
  }

  const analyse = tournamentInputSchema.safeParse({
    eventId: String(formData.get("eventId") ?? ""),
    photoId: formData.get("photoId"),
    name: formData.get("name"),
    game: formData.get("game"),
    slug: formData.get("slug"),
    startsAt: instant,
    endsAt: lectureFin.fin,
    priceText: formData.get("priceText"),
    venueName: formData.get("venueName"),
    formatText: formData.get("formatText"),
    prizes: formData.get("prizes"),
    matchDurationMinutes: entierOptionnel(formData.get("matchDurationMinutes")),
    capacity: entierOptionnel(formData.get("capacity")),
    registrationMode: formData.get("registrationMode"),
    registrationUrl: formData.get("registrationUrl"),
    registrationState: formData.get("registrationState") ?? undefined,
    podiumFirst: formData.get("podiumFirst"),
    podiumSecond: formData.get("podiumSecond"),
    podiumThird: formData.get("podiumThird"),
  });

  if (!analyse.success) {
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  const valeurs = analyse.data;

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * 🔴 L'IDENTIFIANT D'ADRESSE SE **FIGE À LA PUBLICATION** — A3, ET CE N'EST PAS UN `CHECK`
   * ══════════════════════════════════════════════════════════════════════════════════════
   *
   * Une URL partagée sur Discord, imprimée sur un flyer ou lue dans une description de stream
   * doit rester valide. Tant que le tournoi est un **brouillon**, personne n'a pu la diffuser :
   * elle se modifie librement. Dès qu'il est **publié**, elle est gelée.
   *
   * ⚠️ CETTE RÈGLE N'EST **PAS** EXPRIMABLE PAR UN `CHECK` : elle compare la valeur **nouvelle**
   * à la valeur **précédente**, c'est-à-dire deux versions de la même ligne, ce qu'une
   * contrainte ne voit pas. Elle se tient donc **à la frontière d'écriture**, exactement comme
   * la note d'architecture (§7 ②) le prescrit pour l'invariant « 1..N membres ». Un `UPDATE`
   * direct la contourne, et c'est assumé : le risque est un lien cassé, pas une corruption.
   * 🔴 `gate:tournois` la prouve **DANS LES DEUX SENS** — un brouillon dont l'identifiant
   * change, un publié dont il ne change pas. Un seul des deux sens ne prouverait rien.
   */
  /** Message unique du gel — écrit une fois, servi par les DEUX contrôles ci-dessous. */
  const MESSAGE_ADRESSE_FIGEE =
    "Ce tournoi est publié : son adresse est figée, parce qu'elle a pu être partagée " +
    "sur Discord, imprimée ou lue en direct. Pour la changer, retirez d'abord le " +
    "tournoi du site — les visiteurs qui suivraient l'ancien lien tomberaient sinon " +
    "sur une page introuvable.";

  let changeDeSlug = false;

  if (idExistant !== null) {
    const actuel = await db.query.tournament.findFirst({
      columns: { slug: true, isPublished: true },
      where: (table, { eq: egal }) => egal(table.id, idExistant),
    });
    if (!actuel) {
      return { ok: false, error: "Ce tournoi n'existe plus : il a été supprimé entre-temps." };
    }
    changeDeSlug = actuel.slug !== valeurs.slug;

    if (actuel.isPublished && changeDeSlug) {
      return {
        ok: false,
        error: "L'adresse d'un tournoi publié ne peut plus changer.",
        fieldErrors: { slug: MESSAGE_ADRESSE_FIGEE },
      };
    }
  }

  // 🔴 CE CONTRÔLE EST LE **MESSAGE**, PAS LE GARDE-FOU — celui-ci est la contrainte
  // `tournament_slug_unique` en base, seule chose qu'un `UPDATE` direct ne contourne pas. Sans
  // cette lecture, un doublon remonterait sous la forme d'un `23505` traduit après que le
  // bénévole a rempli douze champs. ⚠️ Sujette à une course, et c'est sans gravité : la base
  // tranche derrière, et `messageErreurBase` traduit son refus.
  const collision = await slugDejaPris(valeurs.slug, idExistant);
  if (collision) {
    return {
      ok: false,
      error: "Cette adresse est déjà prise.",
      fieldErrors: {
        slug: `Cette adresse est déjà utilisée par le tournoi « ${collision.name} ». Choisissez-en une autre.`,
      },
    };
  }

  // 🔴 LES DEUX BORNES, ET LA COMPOSITION VIT DANS `lib/date-paris.ts` (Story 9.6, corrigé en
  // revue). Ce code écrivait un TERNAIRE sous un commentaire qui affirmait montrer les deux
  // messages — il n'en rendait jamais qu'un. Le défaut était COPIÉ À L'IDENTIQUE dans
  // `actions/agenda.ts`, commentaire compris : deux exemplaires d'une même affirmation fausse.
  const avertissement = avertissementHeuresMurales(
    saisieDate,
    String(formData.get("endsAt") ?? ""),
  );

  try {
    if (idExistant === null) {
      const [ligne] = await db
        .insert(tournament)
        // 🔴 `isPublished: false` EXPLICITE : un tournoi naît invisible. Le laisser au défaut
        // de colonne marcherait aussi — l'écrire ici rend l'intention lisible à l'endroit où
        // quelqu'un serait tenté d'ajouter le champ au formulaire.
        .values({ ...valeurs, isPublished: false })
        .returning({ id: tournament.id });
      return { ok: true, data: { id: ligne.id, avertissement } };
    }

    /**
     * ══════════════════════════════════════════════════════════════════════════════════════
     * 🔴 CONCURRENCE OPTIMISTE SUR LE GEL D'ADRESSE — TROUVÉ EN REVUE, ET C'ÉTAIT UN TOCTOU
     * ══════════════════════════════════════════════════════════════════════════════════════
     *
     * Le contrôle ci-dessus lit `isPublished` dans une requête, et cet `UPDATE` s'exécute dans
     * une **autre**. Entre les deux, rien ne tenait la valeur : un second administrateur qui
     * cliquait « Publier » depuis la liste pendant qu'un premier avait le formulaire ouvert
     * faisait passer le tournoi à `is_published = true` **après** la lecture et **avant**
     * l'écriture. Résultat : **l'adresse d'un tournoi publié changeait quand même** — c'est-à-dire
     * l'invariant exact que A3 déclare tenu, contourné par une course.
     *
     * ⚠️ **CE N'EST PLUS UN SCÉNARIO THÉORIQUE.** Le back-office a longtemps eu **un seul**
     * compte ; il en compte **trois** sur staging depuis le 2026-08-13, ce qui est précisément
     * le motif pour lequel la dette **R39** a été rouverte. Et ce projet a déjà payé la même
     * classe de défaut en revue de la **6.4** : deux clics rapides partaient tous deux de
     * l'état d'AVANT le premier, et le second annulait silencieusement le premier.
     *
     * 🔴 LA CONDITION N'EST POSÉE QUE SI L'ADRESSE CHANGE, ET C'EST DÉLIBÉRÉ. La poser
     * systématiquement ferait échouer un enregistrement **parfaitement anodin** (corriger une
     * faute de frappe dans les lots) simplement parce que quelqu'un a publié entre-temps —
     * une porte qui refuse du légitime finit par être contournée. Ici elle ne se ferme que sur
     * le geste qu'elle protège.
     * ⚠️ `is_published = false` et non « la valeur lue » : c'est **plus fort**, et ça dit ce
     * qu'on veut vraiment — *cette adresse ne change que sur un brouillon*.
     */
    const [ligne] = await db
      .update(tournament)
      .set(valeurs)
      .where(
        changeDeSlug
          ? and(eq(tournament.id, idExistant), eq(tournament.isPublished, false))
          : eq(tournament.id, idExistant),
      )
      .returning({ id: tournament.id });

    if (!ligne) {
      // 🔴 DEUX CAUSES POSSIBLES, ET ON NE DEVINE PAS : la ligne a disparu, ou elle a été
      // publiée entre la lecture et l'écriture. On relit pour le dire — un message faux sur un
      // écran de saisie coûte plus cher que la requête supplémentaire.
      if (changeDeSlug) {
        const survivant = await db.query.tournament.findFirst({
          columns: { isPublished: true },
          where: (table, { eq: egal }) => egal(table.id, idExistant),
        });
        if (survivant?.isPublished) {
          return {
            ok: false,
            error: "Ce tournoi vient d'être publié : son adresse ne peut plus changer.",
            fieldErrors: { slug: MESSAGE_ADRESSE_FIGEE },
          };
        }
      }
      return { ok: false, error: "Ce tournoi n'existe plus : il a été supprimé entre-temps." };
    }
    return { ok: true, data: { id: ligne.id, avertissement } };
  } catch (erreur) {
    // Sans cette trace, un échec d'écriture en production (pool épuisé, base injoignable,
    // divergence Zod/CHECK) est totalement invisible — leçon de la Story 5.1.
    console.error("[enregistrerTournoi] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Publie ou dépublie un tournoi — **le geste NOMINAL de cet écran**.
 *
 * Action distincte de l'enregistrement, et volontairement minuscule : publier depuis la LISTE
 * ne doit pas exiger de rouvrir le formulaire, ni risquer de réécrire des champs (dette R35).
 *
 * ⚠️ DÉPUBLIER NE SUPPRIME RIEN, et c'est aussi ce qui **rouvre** l'identifiant d'adresse à la
 * modification (voir `enregistrerTournoi`). Les deux règles se tiennent : on ne change pas
 * l'adresse d'un tournoi en ligne, on le retire d'abord.
 */
export async function definirPublicationTournoi(
  id: string,
  publier: boolean,
): Promise<ResultatAction<{ id: string }>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .update(tournament)
      .set({ isPublished: publier })
      .where(eq(tournament.id, id))
      .returning({ id: tournament.id });

    if (!ligne) return { ok: false, error: "Ce tournoi n'existe plus." };
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[definirPublicationTournoi] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Supprime un tournoi — définitivement.
 *
 * 🔴 **CE BLOC DISAIT « AUCUN EFFET DE BORD AUJOURD'HUI » — C'EST FAUX DEPUIS LA STORY 10.1,
 * CORRIGÉ LE 2026-08-15.** Il annonçait lui-même le jour où il cesserait d'être vrai, et ce
 * jour est arrivé : `tournament_phase` et `tournament_entry` référencent désormais cette
 * table, tout comme `tournament_match` et `tournament_match_slot` par transitivité.
 *
 * ⚠️ **CE `DELETE` DÉTRUIT DONC TOUTE LA STRUCTURE DU TOURNOI** — phases, engagés, membres,
 * rencontres et résultats. Le choix a été fait explicitement en 10.1 et non laissé au défaut
 * de Drizzle : `CASCADE`, parce qu'une phase ou un engagé n'a **aucune existence** hors de son
 * tournoi, là où un événement d'agenda en a une (d'où le `RESTRICT` sur `tournament.eventId`).
 * ⇒ **La confirmation de l'écran doit le DIRE** (`TournoiActions`) : une différence de
 * comportement entre deux écrans du même back-office s'écrit, elle ne se déduit pas.
 *
 * La confirmation en DEUX TEMPS vit côté écran (`BoutonConfirmation`) : c'est là qu'elle
 * protège quelqu'un. Une seconde garde côté serveur n'empêcherait rien qu'un POST direct ne
 * contourne de toute façon — et `requireAdmin()` est la garde qui, elle, compte.
 */
export async function supprimerTournoi(id: string): Promise<ResultatAction<undefined>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .delete(tournament)
      .where(eq(tournament.id, id))
      .returning({ id: tournament.id });

    if (!ligne) return { ok: false, error: "Ce tournoi a déjà été supprimé." };
    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[supprimerTournoi] Échec de la suppression :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}
