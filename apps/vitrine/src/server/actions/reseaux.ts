"use server";

import { eq } from "drizzle-orm";

import { formatLongDate, formatTime, toParisIso } from "../../lib/date-paris";
import { composerMessages, type MessagesReseaux } from "../../lib/message-reseaux";
import { situationDuBar } from "../../lib/lieu-bar";
import { baseDuSite } from "../../lib/site-url";
import { PAYLOAD_SOURCE, PAYLOAD_VERSION, messagesSchema } from "../../lib/schemas/publication";
import { CLES_CABLEES, RESEAUX_CABLES, ciblesRetenues, listerReseaux } from "../../lib/reseaux";
import { cleanText } from "../../lib/text";
import { exigerRoleAction } from "../auth/guard";
import { db } from "../db/client";
import { getEventById } from "../db/queries/events";
import { getImagePubliee } from "../db/queries/photos";
import { ouvrirMedia } from "../medias";
import { event } from "../db/schema";
import { proposerTextes } from "../integrations/gemini";
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
 * ① `await exigerRoleAction("admin_site")` EN PREMIÈRE LIGNE. Ce n'est pas une ceinture en plus du proxy :
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
      // ⚠️ Le séparateur est la VIRGULE ici, pas le tiret : c'est une adresse postale
      // qu'n8n peut poser sur une affiche. Une situation absente s'efface entièrement,
      // ponctuation comprise — sinon le texte annoncé porterait « 12 rue X, , ».
      adresse: cleanText(
        [cleanText(evenement.bar.address), situationDuBar(evenement.bar)]
          .filter(Boolean)
          .join(", "),
      ),
    };
  }
  return {
    lieu: cleanText(evenement.venueName),
    adresse: cleanText(evenement.venueAddress),
  };
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
  await exigerRoleAction("admin_site");

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
  /* 🔴 LE MÊME TITRE NETTOYÉ SERT AU PAYLOAD ET AU TEXTE PUBLIÉ. Les tirer de deux sources
     ferait paraître sur Discord un titre que le message dit autrement. */
  const titre = cleanText(evenement.title) ?? evenement.title;
  const jeux = cleanText(evenement.games);
  const lien = `${baseDuSite()}/agenda`;

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
      titre,
      type: evenement.type,
      // 🔴 `toParisIso` et JAMAIS `toISOString()` : voir `lib/schemas/publication.ts`.
      debut: toParisIso(evenement.startsAt),
      lieu,
      adresse,
      jeux,
      description: cleanText(evenement.description),
      lien,
    },
    /* Composés dans le site et non dans n8n : `lib/message-reseaux.ts` dit pourquoi. */
    messages: composerMessages({ titre, debut: evenement.startsAt, lieu, adresse, jeux, lien }),
    /* 🔴 CE CHEMIN VISE **TOUS LES RÉSEAUX RACCORDÉS**, ET C'EST SON SENS MÊME : le bouton
       s'appelle « Annoncer sur les réseaux » et n'offre aucun choix. Lui faire viser autre
       chose ferait mentir son libellé.
       ⚠️ **C'EST ICI QUE LE BOUTON SERAIT DEVENU MUET.** Dès que le workflow filtrera sur
       `reseaux`, un paquet sans ce champ ne passerait plus **aucune** condition : l'annonce
       partirait, répondrait 200, et ne paraîtrait nulle part. Un faux succès de plus, sur
       l'écran même que la PR #118 a corrigé. */
    reseaux: [...CLES_CABLEES],
    /* Le visuel de l'événement (médiathèque, Story 15.1). ⚠️ `getEventById` le remonte déjà :
       c'est la colonne `event.photo_id`, pas une des photos PRISES à la soirée. */
    imageUrl: urlPubliqueDeLImage(evenement.visuel),
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

/* ══════════════════════════════════════════════════════════════════════════════════════
 * L'ÉCRAN DE COMPOSITION (`/admin/reseaux`) — proposer, puis envoyer ce qui a été relu
 * ══════════════════════════════════════════════════════════════════════════════════════ */

/**
 * L'adresse **publique** d'une image de la médiathèque — celle que Discord ira chercher.
 *
 * 🔴 UNE SEULE FABRIQUE POUR LES DEUX CHEMINS D'ENVOI (le bouton de l'agenda et l'écran de
 * composition). Deux constructions de la même URL divergeraient au premier changement de
 * route, et le symptôme serait une image **manquante chez un seul des deux** — donc un défaut
 * qu'on met longtemps à voir.
 *
 * ⚠️ `null` DÈS QUE L'IMAGE N'EST PAS PUBLIÉE : `/medias/[filename]` répond **404** pour un
 * brouillon (garde 6.4). Envoyer l'adresse quand même ferait échouer le post entier — Discord
 * refuse un embed dont l'image ne se charge pas. **Le code décide, il ne suppose pas.**
 */
function urlPubliqueDeLImage(image: { filename: string; isPublished: boolean } | null | undefined) {
  if (!image?.isPublished) return null;
  return `${baseDuSite()}/medias/${image.filename}`;
}

/** Borne du contexte saisi. Généreux pour un paragraphe, borné quand même. */
const CONTEXTE_MAX = 2000;

/** 8 Mo : très au-delà d'un visuel d'annonce, et sous la limite d'un envoi en base64. */
const IMAGE_MAX_OCTETS = 8 * 1024 * 1024;

/** Les formats que le stockage du site accepte déjà, et que le modèle sait lire. */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * 🔴 LES FAITS VIENNENT DE LA BASE, LE MODÈLE NE FAIT QUE LES METTRE EN PHRASES.
 *
 * ⚠️ Cette liste est PLUS RICHE que le payload envoyé à n8n : le tarif et l'heure de fin y
 * figurent alors que le contrat ne les porte pas. C'est voulu — ils font une meilleure
 * annonce, et ici ils ne traversent aucun système tiers, ils servent à écrire la phrase.
 */
function faitsDeLEvenement(evenement: NonNullable<Awaited<ReturnType<typeof getEventById>>>) {
  const { lieu, adresse } = lieuDuPayload(evenement);
  const debut = evenement.startsAt;
  return [
    `Titre : ${cleanText(evenement.title) ?? evenement.title}`,
    `Quand : ${formatLongDate(debut)} à ${formatTime(debut)}`,
    evenement.endsAt ? `Fin : ${formatTime(evenement.endsAt)}` : null,
    lieu ? `Lieu : ${lieu}` : null,
    adresse ? `Adresse : ${adresse}` : null,
    cleanText(evenement.games) ? `Jeux : ${cleanText(evenement.games)}` : null,
    cleanText(evenement.priceText) ? `Tarif : ${cleanText(evenement.priceText)}` : null,
    cleanText(evenement.description) ? `Détail : ${cleanText(evenement.description)}` : null,
    `Lien à mettre en fin de texte : ${baseDuSite()}/agenda`,
  ].filter((fait): fait is string => fait !== null);
}

/**
 * Demande quatre propositions de texte au modèle (Story 7.6).
 *
 * ⚠️ **Ne publie rien et n'écrit rien en base.** Le bénévole relit, corrige, puis envoie —
 * ce sont deux gestes, et les confondre publierait un texte que personne n'a lu.
 */
export async function proposerTextesPourReseaux(
  formData: FormData,
): Promise<ResultatAction<MessagesReseaux>> {
  await exigerRoleAction("admin_site");

  const contexte = String(formData.get("contexte") ?? "").slice(0, CONTEXTE_MAX);
  const eventIdBrut = String(formData.get("eventId") ?? "").trim();

  let faits: string[] = [];
  if (eventIdBrut) {
    if (!identifiant.safeParse(eventIdBrut).success) {
      return { ok: false, error: "Cet événement n'est pas valide. Rechargez la page." };
    }
    const evenement = await getEventById(eventIdBrut);
    if (!evenement) {
      return { ok: false, error: "Cet événement n'existe plus : il a été supprimé entre-temps." };
    }
    faits = faitsDeLEvenement(evenement);
  }

  if (faits.length === 0 && contexte.trim() === "") {
    return {
      ok: false,
      error: "Dites de quoi il s'agit : choisissez un événement, ou écrivez un contexte.",
    };
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 L'IMAGE VIENT DE LA MÉDIATHÈQUE, PLUS D'UN FICHIER DE PASSAGE (Story 15.1)
  // ══════════════════════════════════════════════════════════════════════════════════════
  //
  // Elle était téléversée ici puis lue en base64 et **jetée** — l'écran le disait, et c'était
  // juste. Depuis cette story on choisit (ou on importe) une image de la médiathèque : elle
  // existe donc sur le site, avec une URL publique. ⚠️ Ce n'est pas un rangement : c'est le
  // **blocage ① de la 7.6**, mesuré et écrit dans `n8n/README.md` — Instagram refuse un post
  // sans image et la veut à une URL publique. Il tombe ici, sans qu'on ait rien construit
  // pour lui : le contrat vers n8n ne change pas dans cette story.
  //
  // 🔴 ON RELIT LA LIGNE, ON NE FAIT PAS CONFIANCE À L'IDENTIFIANT POSTÉ. Deux raisons, et
  // aucune n'est théorique : ① `is_published` doit être vérifié **maintenant** — une image
  // dépubliée entre l'affichage de la page et le clic ne doit pas partir ; ② `filename` doit
  // venir de la BASE, jamais du client, parce qu'il finit en chemin de fichier (`ouvrirMedia`
  // le re-valide, mais lui donner une valeur d'origine cliente serait rouvrir la porte que
  // `photo_filename_safe` ferme).
  let image: { base64: string; typeMime: string } | undefined;
  const photoIdBrut = String(formData.get("photoId") ?? "").trim();
  if (photoIdBrut) {
    if (!identifiant.safeParse(photoIdBrut).success) {
      return { ok: false, error: "Cette image n'est pas valide. Rechargez la page." };
    }
    const ligne = await getImagePubliee(photoIdBrut);
    if (!ligne) {
      return {
        ok: false,
        error:
          "Cette image n'est plus disponible : elle a été supprimée ou dépubliée. " +
          "Rechargez la page et choisissez-en une autre.",
      };
    }

    const media = await ouvrirMedia(ligne.filename);
    if (!media) {
      // ⚠️ La ligne existe mais le fichier a disparu du volume. Cas rare, et le dire est la
      // seule réponse honnête : réessayer n'y changerait rien (famille du 4xx contre 5xx,
      // corrigée dans la PR #122 sur cette même story).
      return {
        ok: false,
        error: "Le fichier de cette image est introuvable. Choisissez-en une autre.",
      };
    }
    if (media.taille > IMAGE_MAX_OCTETS) {
      return { ok: false, error: "Cette image dépasse 8 Mo. Choisissez-en une plus légère." };
    }
    if (!IMAGE_TYPES.includes(media.typeMime as (typeof IMAGE_TYPES)[number])) {
      // ⚠️ Le stockage accepte AVIF, que le modèle ne lit pas : le refus est donc réel, et il
      // nomme les formats qui marchent plutôt que de laisser le modèle répondre à côté.
      return { ok: false, error: "Formats lus par le modèle : JPEG, PNG ou WebP." };
    }

    image = {
      base64: Buffer.from(await new Response(media.flux).arrayBuffer()).toString("base64"),
      typeMime: media.typeMime,
    };
  }

  const resultat = await proposerTextes({ contexte, faits, image });
  if (!resultat.ok) {
    return { ok: false, error: resultat.error };
  }
  return { ok: true, data: resultat.data };
}

/**
 * Envoie les quatre textes RELUS vers l'outil de publication.
 *
 * 🔴 Distincte d'`annoncerSurLesReseaux` : celle-là recompose le texte depuis la base, celle-ci
 * envoie **ce que le bénévole a sous les yeux**. Les fondre ferait qu'un écran promet un texte
 * et qu'un autre en publie un différent.
 */
export async function annoncerTextesRelus(
  entree: {
    eventId: string | null;
    messages: MessagesReseaux;
    reseaux: readonly string[];
    /**
     * 🔴 L'IMAGE CHOISIE — ET C'EST LE CŒUR DU CORRECTIF DU 2026-09-10. Elle n'arrivait
     * jusqu'ici QUE dans `proposerTextesPourReseaux`, où le modèle la regardait pour écrire.
     * L'action d'ENVOI ne la voyait pas : on choisissait une image, le post partait sans.
     * ⚠️ Deux gestes, deux actions — ce que l'un reçoit, l'autre ne l'a pas. C'est la forme
     * exacte du défaut, et elle est invisible depuis l'écran.
     */
    photoId: string | null;
  },
): Promise<ResultatAction<{ annonceLe: Date; traceEcrite: boolean }>> {
  await exigerRoleAction("admin_site");

  const messages = messagesSchema.safeParse(entree.messages);
  if (!messages.success) {
    return {
      ok: false,
      error:
        "Un des textes est vide ou trop long. Vérifiez le compteur, notamment celui de X.",
    };
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 LES CIBLES SE FILTRENT SUR LES RÉSEAUX RACCORDÉS, ET LE REFUS EST EXPLICITE
  // ══════════════════════════════════════════════════════════════════════════════════════
  //
  // L'écran ne propose que les réseaux raccordés — mais une action serveur ne peut pas s'en
  // remettre à son écran : elle est appelable directement. Sans ce filtre, un paquet pourrait
  // nommer « instagram » alors qu'aucun nœud ne l'écoute, et l'écran afficherait « Annoncé sur
  // Instagram » à propos de rien. C'est le motif de la PR #118, à l'envers.
  //
  // ⚠️ **LE FILTRE PEUT TOUT RETIRER, ET C'EST ALORS UN REFUS** — jamais un envoi silencieux :
  // un paquet sans cible partirait, répondrait 200, et ne publierait nulle part.
  const cibles = ciblesRetenues(entree.reseaux);
  if (cibles.length === 0) {
    return {
      ok: false,
      error:
        RESEAUX_CABLES.length === 0
          ? "Aucun réseau n'est raccordé à l'outil de publication : il n'y a nulle part où " +
            "publier pour l'instant."
          : `Choisissez au moins un réseau parmi ${listerReseaux()}.`,
    };
  }

  // ⚠️ ON RELIT LA LIGNE plutôt que de croire un identifiant posté : `is_published` doit être
  // vérifié MAINTENANT (une image dépubliée entre l'affichage et le clic ne doit pas partir),
  // et `filename` doit venir de la BASE — c'est lui qui devient une URL publique.
  let imageUrl: string | null = null;
  if (entree.photoId) {
    if (!identifiant.safeParse(entree.photoId).success) {
      return { ok: false, error: "Cette image n'est pas valide. Rechargez la page." };
    }
    const ligne = await getImagePubliee(entree.photoId);
    if (!ligne) {
      return {
        ok: false,
        error:
          "Cette image n'est plus disponible : elle a été supprimée ou dépubliée. " +
          "Rechargez la page et choisissez-en une autre.",
      };
    }
    // `getImagePubliee` filtre déjà `is_published` dans son `WHERE` : la trouver SUFFIT à
    // savoir qu'elle est servable. On le redit ici pour que la fabrique reste la même partout.
    imageUrl = urlPubliqueDeLImage({ filename: ligne.filename, isPublished: true });
  }

  let evenementDuPayload = null;
  if (entree.eventId) {
    if (!identifiant.safeParse(entree.eventId).success) {
      return { ok: false, error: "Cet événement n'est pas valide. Rechargez la page." };
    }
    const evenement = await getEventById(entree.eventId);
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
    evenementDuPayload = {
      id: evenement.id,
      titre: cleanText(evenement.title) ?? evenement.title,
      type: evenement.type,
      debut: toParisIso(evenement.startsAt),
      lieu,
      adresse,
      jeux: cleanText(evenement.games),
      description: cleanText(evenement.description),
      lien: `${baseDuSite()}/agenda`,
    };
  }

  const resultat = await publierEvenement({
    version: PAYLOAD_VERSION,
    source: PAYLOAD_SOURCE,
    evenement: evenementDuPayload,
    messages: messages.data,
    /* Ce que le bénévole a coché. ⚠️ Filtré sur les réseaux RACCORDÉS avant d'être posté :
       l'écran ne propose que ceux-là, mais un POST direct pourrait en nommer d'autres — et le
       paquet dirait alors qu'on publie quelque part où rien ne paraîtra. */
    reseaux: [...cibles],
    imageUrl,
  });
  if (!resultat.ok) {
    console.error(`[annoncerTextesRelus] Échec de l'appel n8n (cause: ${resultat.cause})`);
    return { ok: false, error: resultat.error };
  }

  const annonceLe = new Date();
  let traceEcrite = true;
  if (entree.eventId) {
    try {
      await db.update(event).set({ socialPostedAt: annonceLe }).where(eq(event.id, entree.eventId));
    } catch (erreur) {
      traceEcrite = false;
      console.error("[annoncerTextesRelus] ANNONCE PARTIE mais trace NON écrite :", erreur);
    }
  }
  return { ok: true, data: { annonceLe, traceEcrite } };
}
