"use server";

import { eq } from "drizzle-orm";

import { toParisIso } from "../../lib/date-paris";
import { PAYLOAD_SOURCE, PAYLOAD_VERSION } from "../../lib/schemas/publication";
import { cleanText } from "../../lib/text";
import { requireAdmin } from "../auth/guard";
import { db } from "../db/client";
import { getEventById } from "../db/queries/events";
import { event } from "../db/schema";
import { publierEvenement } from "../integrations/n8n";
import { identifiant, type ResultatAction } from "./_commun";

/**
 * Annonce d'un événement sur les réseaux (Story 6.7, FR23, AR-API1, AR-API2).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 FICHIER SÉPARÉ D'`agenda.ts`, ALORS QUE LE BOUTON VIT SUR L'ÉCRAN D'AGENDA
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * C'est le motif de découpage arbitré le 2026-08-02 et reconduit le 2026-08-04 : *« le bouton
 * vit sur l'écran agenda, mais la NATURE est autre — intégration SORTANTE, palier 🔴,
 * doc-first. La fondre dans un CRUD ferait une story à deux natures. »* Le rangement suit la
 * même règle que le découpage : `agenda.ts` écrit dans la base du site et n'a aucune dépendance
 * extérieure ; ce fichier-ci appelle un service tiers dont l'effet est **public et
 * irréversible**. Les mélanger ferait qu'une relecture du CRUD porterait la charge de revue
 * d'une intégration.
 *
 * ⚠️ **CE QUI SE RECOPIE QUAND MÊME**, et sans lequel ce fichier serait une régression :
 *
 * ① `await requireAdmin()` EN PREMIÈRE LIGNE. Ce n'est pas une ceinture en plus du proxy :
 *    c'est la SEULE couche qui protège les mutations. La doc Next (`proxy.js`, § Execution
 *    order) est littérale — *« Server Functions are not separate routes in this chain … Always
 *    verify authentication and authorization inside each Server Function rather than relying on
 *    Proxy alone. »* (leçon 6.1, payée 7 fois).
 * ② RETOUR DISCRIMINÉ `ResultatAction` (`_commun.ts`), avec `data` : l'écran consomme le
 *    résultat — il affiche la date d'annonce sans recharger.
 * ③ AUCUN `revalidateTag`, ET C'EST MESURÉ. Les cinq pages publiques sont `force-dynamic` et
 *    relisent à CHAQUE requête ; le projet ne porte aucun cache applicatif (0 occurrence de
 *    `unstable_cache`, `'use cache'` ou `revalidateTag`). Un `revalidateTag` ici serait un
 *    no-op qui ferait croire à un mécanisme de cache inexistant. ⚠️ De toute façon **rien du
 *    rendu public ne change** : cette colonne ne s'affiche qu'au back-office.
 */

/** Ce que l'écran reçoit après une annonce réussie. */
export type EvenementAnnonce = {
  id: string;
  /** L'horodatage écrit en base, pour que la ligne se mette à jour sans rechargement. */
  annonceLe: Date;
  /**
   * 🔴 L'AVERTISSEMENT PROMIS PAR LE COMMENTAIRE DE LA FONCTION — ajouté en revue 6.7.
   * Il disait « on rend `ok: true` **avec un avertissement** » et ce champ n'existait pas :
   * l'échec d'écriture partait au seul `console.error`, invisible du bénévole. Or
   * `social_posted_at` est le SEUL filet du maillon aval : sans trace, la ligne redevient
   * « jamais annoncée » au prochain rechargement, et un reclic republierait sans le rappel.
   * `false` = l'annonce EST partie, mais la trace n'a pas pu être enregistrée.
   */
  traceEcrite: boolean;
};

/**
 * Le lieu tel qu'une annonce doit le nommer.
 *
 * ⚠️ **PROCHE MAIS PAS IDENTIQUE au `lieuDe()` de l'écran d'agenda**, et ce n'est pas une
 * duplication à extraire — c'est la doctrine « toujours COMPTER » (R9) appliquée honnêtement.
 * L'écran compose **une seule chaîne** de repérage (« Le Bar — Centre, Reims ») destinée à être
 * lue d'un coup d'œil dans une liste. Le payload, lui, sépare **nom** et **adresse**, parce que
 * n8n en fera deux lignes d'affiche, ou une carte. Les fusionner obligerait l'un des deux à
 * découper la chaîne de l'autre : le pire des deux mondes.
 */
function lieuDuPayload(evenement: NonNullable<Awaited<ReturnType<typeof getEventById>>>): {
  lieu: string | null;
  adresse: string | null;
} {
  if (evenement.bar) {
    return {
      lieu: cleanText(evenement.bar.name),
      adresse: cleanText(
        `${evenement.bar.address}, ${evenement.bar.district}, ${evenement.bar.city}`,
      ),
    };
  }
  return {
    lieu: cleanText(evenement.venueName),
    adresse: cleanText(evenement.venueAddress),
  };
}

/**
 * L'adresse publique du site, pour construire le lien de l'annonce.
 *
 * Même repli que `app/layout.tsx` (`metadataBase`, Story 1.6) — une seule idée de « où vit ce
 * site », et pas une seconde constante qui divergerait. ⚠️ En développement la valeur est
 * `http://localhost:3000` : le lien envoyé pointera donc vers le poste. C'est **visible et
 * assumé** (le verify d'entrée le montre), et c'est le prix d'un maillon vérifiable en local.
 */
function baseDuSite(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://esportdessacres.fr").replace(/\/+$/, "");
}

/**
 * Annonce un événement **publié** sur les réseaux.
 *
 * 🔴 **UN ÉVÉNEMENT NON PUBLIÉ EST REFUSÉ, ET LE REFUS EST LE LIVRABLE.** Annoncer une soirée
 * dont la page n'est pas en ligne enverrait le lecteur d'un réseau social vers un agenda où
 * l'événement **n'apparaît pas** — `getUpcomingEvents` filtre sur `is_published`. L'écran ne
 * rend d'ailleurs pas le bouton dans ce cas ; cette garde-ci existe parce qu'une Server Action
 * est atteignable par un POST direct, indépendamment de ce que l'écran a bien voulu afficher.
 *
 * 🔴 **L'HORODATAGE N'EST ÉCRIT QU'APRÈS UN SUCCÈS.** L'ordre compte : appeler d'abord, écrire
 * ensuite. L'inverse (« optimiste ») laisserait une trace d'annonce sur un envoi qui n'est pas
 * parti — donc empêcherait le seul geste qu'il faudrait refaire.
 *
 * ⚠️ **Un échec d'écriture APRÈS un envoi réussi n'est PAS un échec d'annonce.** L'annonce est
 * bel et bien partie ; c'est la trace qui manque. Le rendre en `{ ok: false }` ferait recliquer
 * le bénévole et publierait **deux fois**. On rend donc `ok: true` **avec l'avertissement
 * `traceEcrite: false`**, que l'écran rend explicitement (revue 6.7 — ce commentaire promettait
 * un avertissement que le type ne portait pas, donc l'échec n'existait qu'au journal serveur),
 * et le défaut part AUSSI au journal — c'est le seul arbitrage de ce fichier où le confort de
 * l'écran cède devant l'effet public.
 */
export async function annoncerSurLesReseaux(
  id: string,
): Promise<ResultatAction<EvenementAnnonce>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  const evenement = await getEventById(id);
  if (!evenement) {
    return { ok: false, error: "Cet événement n'existe plus : il a été supprimé entre-temps." };
  }

  if (!evenement.isPublished) {
    return {
      ok: false,
      error:
        "Cet événement n'est pas publié : il n'apparaît pas sur le site. Publiez-le d'abord, " +
        "sinon l'annonce renverrait vers une page où il ne figure pas.",
    };
  }

  const { lieu, adresse } = lieuDuPayload(evenement);

  const resultat = await publierEvenement({
    version: PAYLOAD_VERSION,
    source: PAYLOAD_SOURCE,
    evenement: {
      id: evenement.id,
      /* ⚠️ `cleanText` ICI AUSSI — corrigé en revue 6.7. `titre` était le SEUL des cinq champs
         texte à partir brut, alors que `event.title` n'est jamais nettoyé à l'écriture non plus
         (`texteVisible` juge, il ne nettoie pas — pour préserver les ZWJ des emojis). Un
         caractère sans largeur collé dans un titre (copié-collé de Discord) traversait donc
         intact jusqu'au payload, là où le même caractère est neutralisé dans `jeux` ou
         `description`. Le repli sur la valeur brute garde le contrat `min(1)` : un titre est
         non vide par construction (`texteVisible` à la saisie). */
      titre: cleanText(evenement.title) ?? evenement.title,
      type: evenement.type,
      // 🔴 `toParisIso` et JAMAIS `toISOString()` : voir `lib/schemas/publication.ts`.
      debut: toParisIso(evenement.startsAt),
      lieu,
      adresse,
      jeux: cleanText(evenement.games),
      description: cleanText(evenement.description),
      lien: `${baseDuSite()}/agenda`,
    },
  });

  if (!resultat.ok) {
    // Sans cette trace, un échec en production est totalement invisible (leçon 5.1). La `cause`
    // y va, jamais à l'écran : elle nomme notre infrastructure, pas le problème du bénévole.
    console.error(
      `[annoncerSurLesReseaux] Échec de l'appel n8n (cause: ${resultat.cause}) pour ${id}`,
    );
    return { ok: false, error: resultat.error };
  }

  const annonceLe = new Date();
  let traceEcrite = true;

  try {
    await db.update(event).set({ socialPostedAt: annonceLe }).where(eq(event.id, id));
  } catch (erreur) {
    traceEcrite = false;
    console.error(
      "[annoncerSurLesReseaux] ANNONCE PARTIE mais trace NON écrite — " +
        "l'événement peut sembler jamais annoncé :",
      erreur,
    );
  }

  return { ok: true, data: { id, annonceLe, traceEcrite } };
}
