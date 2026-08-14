"use server";

import { eq } from "drizzle-orm";

import { diagnostiquerHeureMurale, parisWallClockFromInput } from "../../lib/date-paris";
import { barInputSchema, eventInputSchema } from "../../lib/schemas/event";
import { requireAdmin } from "../auth/guard";
import { countEventsBlockingBarDeletion } from "../db/queries/events";
import { db } from "../db/client";
import { bar, event } from "../db/schema";
import {
  erreursParChamp,
  identifiant,
  messageErreurBase as traduireErreurBase,
  type ResultatAction,
} from "./_commun";

/**
 * Server Actions de l'agenda du back-office (Story 6.3, FR20, AR-API1, AR-DB4).
 *
 * 🔴 PREMIÈRE SURFACE DE SAISIE DU PROJET — ce fichier est le PATRON que reprennent les
 * Stories 6.4, 6.5, 6.9, 6.10, 6.11 et 6.13. Trois règles y sont non négociables :
 *
 * ① `await requireAdmin()` EN PREMIÈRE LIGNE DE CHAQUE ACTION. Ce n'est pas une ceinture
 *    en plus du proxy : c'est la SEULE couche qui protège les mutations. La doc Next
 *    (`proxy.js`, § Execution order) est littérale — *« Server Functions are not separate
 *    routes in this chain … Always verify authentication and authorization inside each
 *    Server Function rather than relying on Proxy alone. »* Le jour où une action est
 *    déplacée, réutilisée, ou le jour où quelqu'un resserre le matcher, la garde du proxy
 *    disparaît SANS QU'AUCUNE PORTE NE LE DISE.
 *
 * ② RETOUR DISCRIMINÉ, avec `data` — contrairement à `submitSolicitation` (5.1), qui n'en
 *    avait pas besoin. Ici l'écran consomme le résultat : l'identifiant créé sert à
 *    rediriger vers la prévisualisation, et l'avertissement d'heure pathologique doit
 *    remonter jusqu'à la confirmation.
 *
 * ③ AUCUN `revalidateTag`, ET C'EST MESURÉ. Les trois pages publiques qui lisent la base
 *    (`/`, `/agenda`, `/partenaires`) sont `force-dynamic` et relisent à CHAQUE requête ;
 *    le projet ne porte aucun cache applicatif. Un `revalidateTag('events')` serait un
 *    no-op — au mieux inutile, au pire il ferait croire à un mécanisme de cache qui
 *    n'existe pas. Une saisie est visible **au rechargement suivant**.
 *
 * ⚠️ CE QUI NE SE RECOPIE PAS DE LA STORY 5.1 : le honeypot et le rate-limit. Ils
 * protègent une surface PUBLIQUE non authentifiée ; derrière `requireAdmin()` ils n'ont
 * aucun sens, et les poser « par symétrie » ferait croire à une garde là où il n'y aurait
 * qu'un décor.
 *
 * ⚠️ `ResultatAction`, `identifiant`, `erreursParChamp` ET LE TRADUCTEUR D'ERREURS ONT
 * QUITTÉ CE FICHIER (Story 6.4) : la galerie les repayait à l'identique, donc deux
 * consommateurs, donc extraction vers `_commun.ts` — et le retrofit se fait dans le MÊME
 * commit, sinon l'extraction ajoute une copie au lieu d'en retirer une (leçon 2.7).
 * La table `CHAMP_PAR_CONTRAINTE`, elle, RESTE ici : elle est propre à ce domaine.
 */

/** Ce que l'écran reçoit après un enregistrement réussi. */
export type EvenementEnregistre = {
  id: string;
  /** Message R23 quand l'heure saisie est inexistante ou ambiguë. `null` sinon. */
  avertissement: string | null;
};

/**
 * Nom lisible du champ derrière chaque contrainte de validité.
 *
 * ⚠️ Ajouté après revue (Blind Hunter) : **huit** des dix contraintes tombaient dans un
 * message générique qui ne disait pas QUEL champ corriger. Ce chemin n'est atteint que par
 * une écriture qui contourne Zod (SQL direct, restauration, migration) — c'est-à-dire
 * exactement le scénario pour lequel ces `CHECK` existent. Un message qui ne nomme rien y
 * est aussi inutile que pas de message.
 */
const CHAMP_PAR_CONTRAINTE: Record<string, string> = {
  event_title_valide: "le titre",
  event_games_valide: "les jeux annoncés",
  event_description_valide: "la description",
  event_recap_valide: "le compte-rendu",
  event_venue_name_valide: "le nom du lieu",
  event_venue_address_valide: "l'adresse du lieu",
  bar_name_valide: "le nom du bar",
  bar_address_valide: "l'adresse du bar",
  bar_district_valide: "le quartier",
  bar_city_valide: "la ville",
};

/**
 * Cas dont le message ne se déduit PAS du nom d'un champ.
 *
 * `event_has_venue` porte une règle qui met deux colonnes en relation : dire « la base
 * refuse le nom du lieu » serait faux la moitié du temps (le bénévole peut aussi bien
 * choisir un bar).
 */
const CAS_PARTICULIERS: Record<string, string> = {
  event_has_venue:
    "Indiquez un bar du roulement ou le nom d'un lieu : un événement doit avoir un lieu.",
};

/**
 * Traducteur partagé (`_commun.ts`), appliqué à la table de CE domaine.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 `23503` NE DÉSIGNE PLUS UN SEUL CAS — CORRIGÉ PAR LA STORY 9.1, ET C'ÉTAIT DEVENU FAUX
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Ce bloc renvoyait **inconditionnellement** « Le bar choisi n'existe plus », et le commentaire
 * qui le justifiait disait : *« ici la seule clé étrangère est le bar »*. C'était vrai jusqu'au
 * 2026-08-13. La Story 9.1 crée `tournament.event_id` en **`ON DELETE RESTRICT`** : supprimer un
 * événement qui porte un tournoi lève désormais un `23503` **entrant**, sur une contrainte qui
 * n'a rien à voir avec un bar.
 * ⚠️ **CE BLOC DISAIT AUSSI « `NOT NULL` » — PLUS VRAI DEPUIS LA 9.5**, où `event_id` est devenu
 * nullable. `RESTRICT`, lui, est **conservé** (le raisonnement complet vit sur la colonne, dans
 * `schema.ts`), donc ce `23503` se lève exactement comme avant. Ce qui change est le **remède**
 * proposé au bénévole : **détacher** un tournoi est désormais un geste possible.
 *
 * ⚠️ Sans cette distinction, un bénévole qui tente de supprimer un événement de la Game'in
 * Reims lirait « Le bar choisi n'existe plus » — une phrase **fausse**, qui parle d'un objet
 * absent de son écran, et qu'il n'aurait **aucun moyen** de corriger. C'est exactement le
 * défaut trouvé en revue de la 6.3, où huit contraintes sur dix rendaient un message qui ne
 * nommait aucun champ.
 *
 * 🔴 ON DISCRIMINE SUR LE **NOM DE LA CONTRAINTE**, PAS SUR LE CODE : les deux cas partagent
 * `23503` et rien d'autre ne les sépare. `constraint_name` avant `constraint`, même ordre
 * qu'`_commun.ts` — **mesuré** le 2026-08-03 : postgres.js remplit `constraint_name`, et
 * `constraint` y est `undefined`.
 */
function messageErreurBase(erreur: unknown): string {
  const message = traduireErreurBase(erreur, CHAMP_PAR_CONTRAINTE, CAS_PARTICULIERS);
  const details = erreur as { code?: string; constraint_name?: string; constraint?: string };
  if (details.code !== "23503") return message;

  const contrainte = details.constraint_name ?? details.constraint ?? "";
  if (contrainte.startsWith("tournament_")) {
    return (
      "Cet événement porte au moins un tournoi : il ne peut pas être supprimé tant qu'un " +
      "tournoi y est rattaché. Ouvrez la section Tournois, puis supprimez ces tournois, " +
      "rattachez-les ailleurs, ou détachez-les en choisissant « Aucun » (ils deviennent alors " +
      "des rendez-vous à part entière, et il faudra leur indiquer un lieu). " +
      "(Rien n'a été supprimé.)"
    );
  }
  return "Le bar choisi n'existe plus. Rechargez la page et choisissez-en un autre.";
}

/**
 * Crée ou met à jour un événement.
 *
 * 🔴 LA DATE EST CONVERTIE **AVANT** ZOD, ET C'EST L'ORDRE QUI COMPTE. Le champ
 * `<input type="datetime-local">` rend `"2026-08-06T19:00"` — sans fuseau, par
 * spécification —, c'est-à-dire exactement la forme que `startsAtSchema` REFUSE. La
 * conversion passe par `parisWallClockFromInput`, seul pont autorisé, et Zod reçoit un
 * `Date` déjà juste. Inverser les deux ferait échouer toute saisie avec le message
 * « Date sans fuseau horaire », que le bénévole ne pourrait pas corriger.
 *
 * ⚠️ `idExistant` est passé en ARGUMENT par l'appelant — jamais lu depuis `formData`, où il
 * serait modifiable par le client. (Ce commentaire décrivait un `.bind(null, id)` que le
 * formulaire n'utilise pas : `EventForm` appelle l'action directement depuis son
 * `useActionState` avec l'identifiant dérivé de l'état précédent. La conclusion est la
 * même, le mécanisme n'était pas celui-là. Corrigé après revue — un commentaire affirmatif
 * et faux est un défaut à part entière : quelqu'un s'y fiera.)
 */
export async function enregistrerEvenement(
  idExistant: string | null,
  formData: FormData,
): Promise<ResultatAction<EvenementEnregistre>> {
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

  const analyse = eventInputSchema.safeParse({
    type: formData.get("type") ?? undefined,
    title: formData.get("title"),
    barId: formData.get("barId"),
    venueName: formData.get("venueName"),
    venueAddress: formData.get("venueAddress"),
    startsAt: instant,
    games: formData.get("games"),
    description: formData.get("description"),
    recap: formData.get("recap"),
    isPublished: formData.get("isPublished") === "on",
  });

  if (!analyse.success) {
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  const valeurs = analyse.data;
  const diagnostic = diagnostiquerHeureMurale(saisieDate);
  const avertissement = diagnostic.cas === "ok" ? null : diagnostic.message;

  try {
    if (idExistant === null) {
      const [ligne] = await db.insert(event).values(valeurs).returning({ id: event.id });
      return { ok: true, data: { id: ligne.id, avertissement } };
    }

    const [ligne] = await db
      .update(event)
      .set(valeurs)
      .where(eq(event.id, idExistant))
      .returning({ id: event.id });

    if (!ligne) {
      return { ok: false, error: "Cet événement n'existe plus : il a été supprimé entre-temps." };
    }
    return { ok: true, data: { id: ligne.id, avertissement } };
  } catch (erreur) {
    // Sans cette trace, un échec d'écriture en production (pool épuisé, base injoignable,
    // divergence Zod/CHECK) est totalement invisible — leçon de la Story 5.1.
    console.error("[enregistrerEvenement] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Publie ou dépublie un événement.
 *
 * Action distincte de l'enregistrement, et volontairement minuscule : publier depuis la
 * LISTE ne doit pas exiger de rouvrir le formulaire, ni risquer de réécrire des champs
 * que personne n'a touchés.
 */
export async function definirPublicationEvenement(
  id: string,
  publier: boolean,
): Promise<ResultatAction<{ id: string }>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .update(event)
      .set({ isPublished: publier })
      .where(eq(event.id, id))
      .returning({ id: event.id });

    if (!ligne) return { ok: false, error: "Cet événement n'existe plus." };
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[definirPublicationEvenement] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Supprime un événement — définitivement.
 *
 * ⚠️ LES PHOTOS RATTACHÉES SURVIVENT : `photo.eventId` est `ON DELETE SET NULL` et jamais
 * `CASCADE`, parce qu'*« une photo orpheline reste une photo de la vie de l'asso »*
 * (`schema.ts`). L'écran doit le DIRE dans sa confirmation : un bénévole qui croit
 * détruire des photos n'osera pas supprimer un doublon.
 */
export async function supprimerEvenement(id: string): Promise<ResultatAction<undefined>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db.delete(event).where(eq(event.id, id)).returning({ id: event.id });
    if (!ligne) return { ok: false, error: "Cet événement a déjà été supprimé." };
    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[supprimerEvenement] Échec de la suppression :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/** Crée ou met à jour un bar du roulement. */
export async function enregistrerBar(
  idExistant: string | null,
  formData: FormData,
): Promise<ResultatAction<{ id: string }>> {
  await requireAdmin();

  if (idExistant !== null && !identifiant.safeParse(idExistant).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  const analyse = barInputSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    district: formData.get("district"),
    city: formData.get("city") || undefined,
  });

  if (!analyse.success) {
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  try {
    if (idExistant === null) {
      const [ligne] = await db.insert(bar).values(analyse.data).returning({ id: bar.id });
      return { ok: true, data: { id: ligne.id } };
    }

    const [ligne] = await db
      .update(bar)
      .set(analyse.data)
      .where(eq(bar.id, idExistant))
      .returning({ id: bar.id });

    if (!ligne) return { ok: false, error: "Ce bar n'existe plus." };
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[enregistrerBar] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Supprime un bar du roulement.
 *
 * 🔴 CETTE SUPPRESSION PEUT LÉGITIMEMENT ÉCHOUER, ET LE MESSAGE EST LE LIVRABLE.
 * `event.barId` est `ON DELETE SET NULL` : supprimer un bar ne détruit pas l'historique
 * des jeudis qui s'y sont tenus. Mais le passage à `NULL` ré-évalue `event_has_venue`, et
 * un événement rattaché à ce bar **sans lieu libre** viole alors la contrainte : Postgres
 * refuse. C'est le bon comportement — c'est son message qui ne l'est pas.
 *
 * On compte donc AVANT, pour dire combien et quoi faire. ⚠️ Le compte ne remplace pas la
 * contrainte : entre le compte et la suppression, la base peut changer. L'échec reste donc
 * attrapé, et traduit.
 */
export async function supprimerBar(id: string): Promise<ResultatAction<undefined>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const bloquants = await countEventsBlockingBarDeletion(id);
    if (bloquants > 0) {
      const pluriel = bloquants > 1 ? "s" : "";
      return {
        ok: false,
        error:
          `Impossible de supprimer ce bar : ${bloquants} événement${pluriel} s'y ${bloquants > 1 ? "tiennent" : "tient"} ` +
          `et n'${bloquants > 1 ? "ont" : "a"} pas d'autre lieu. Rattachez-${bloquants > 1 ? "les" : "le"} à un autre bar, ` +
          `ou donnez-${bloquants > 1 ? "leur" : "lui"} un nom de lieu, puis réessayez.`,
      };
    }

    const [ligne] = await db.delete(bar).where(eq(bar.id, id)).returning({ id: bar.id });
    if (!ligne) return { ok: false, error: "Ce bar a déjà été supprimé." };
    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[supprimerBar] Échec de la suppression :", erreur);
    if ((erreur as { constraint_name?: string }).constraint_name === "event_has_venue") {
      return {
        ok: false,
        error:
          "Impossible de supprimer ce bar : des événements s'y tiennent et n'ont pas d'autre lieu. " +
          "Rattachez-les à un autre bar, ou donnez-leur un nom de lieu, puis réessayez.",
      };
    }
    return { ok: false, error: messageErreurBase(erreur) };
  }
}
