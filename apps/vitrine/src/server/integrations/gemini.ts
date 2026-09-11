/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * PROPOSER LES TEXTES DE RÉSEAUX À PARTIR D'UNE IMAGE ET D'UN CONTEXTE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Première intégration d'un modèle de langage dans ce projet. Arbitrage de Brice
 * (2026-09-08) : **son API Gemini**, dont l'association dispose déjà.
 *
 * 🔴 **LE MODÈLE ÉCRIT LA PROSE, IL NE FOURNIT JAMAIS LES FAITS.** La date, le bar, les jeux
 * arrivent ici depuis la base (chemin « événement ») ou depuis ce que le bénévole a écrit ;
 * la consigne lui interdit d'en ajouter. Un modèle qui invente une heure produit une phrase
 * parfaitement crédible et fausse — et c'est le genre de défaut qu'aucune porte ne voit.
 * La seconde parade est humaine : les textes sont **relus et modifiables** avant envoi.
 *
 * 🔴 **CE PARAGRAPHE DISAIT « L'IMAGE EST LUE, PAS STOCKÉE » — C'EST FAUX DEPUIS LA 15.1**, et
 * le réécrire fait partie du changement. L'image ne se téléverse plus ici : elle se **choisit
 * dans la médiathèque** (ou s'y importe), donc elle porte une ligne `photo` publiée et une URL
 * publique. Ce qui arrive jusqu'ici reste du base64 lu depuis le volume, et n'est toujours
 * écrit nulle part par CE module — mais l'image, elle, existe désormais sur le site.
 * ⚠️ **Conséquence à ne pas perdre** : le blocage ① de la 7.6 (« Instagram exige une image, à
 * une URL publique, et le modèle n'en a aucune ») **n'a plus d'objet**. Rien n'a été construit
 * pour lui ; il est tombé parce que l'image a cessé d'être un fichier de passage.
 *
 * ⚠️ **LES BORNES NE SONT PAS VÉRIFIÉES ICI.** Un texte X trop long est **rendu quand même**,
 * compteur en rouge : refuser la réponse entière ferait perdre les trois autres textes pour
 * un dépassement que le bénévole corrige en dix secondes.
 */
import { GoogleGenAI } from "@google/genai";

import type { MessagesReseaux } from "../../lib/message-reseaux";
import { estRefus, texteRendu } from "../../lib/reponse-gemini";
import { X_MAX } from "../../lib/message-reseaux";
import { RESEAUX } from "../../lib/reseaux";

/** ⚠️ Lues PARESSEUSEMENT, comme pour n8n : leur absence ne casse pas le build. */
const VARIABLE_CLE = "GEMINI_API_KEY";
const VARIABLE_MODELE = "GEMINI_MODEL";

/**
 * Le modèle par défaut. Multimodal, rapide et le moins cher de la gamme courante — c'est
 * une poignée de phrases à écrire, pas un raisonnement.
 * ⚠️ Surchargeable par `GEMINI_MODEL` sans redéploiement de code.
 */
const MODELE_PAR_DEFAUT = "gemini-3.8-flash";

/** Ce qu'on sait de l'annonce à écrire. */
export interface DemandeDeTextes {
  /** Ce que le bénévole a écrit : l'angle, le ton, le début d'une phrase. */
  contexte: string;
  /** 🔴 Les faits établis, à reprendre TELS QUELS. Vide sur le chemin libre. */
  faits: string[];
  /** L'image, si le bénévole en a donné une. */
  image?: { base64: string; typeMime: string };
}

export type ResultatProposition =
  | { ok: true; data: MessagesReseaux }
  | { ok: false; error: string; cause: "config" | "refus" | "reseau" | "forme" };

/**
 * 🔴 LA CONSIGNE PORTE LES CONTRAINTES DE CHAQUE RÉSEAU, ET ELLES NE SE DEVINENT PAS.
 * Elle double `composerMessages` : là-bas c'est du code, ici c'est une instruction — et une
 * instruction peut être ignorée, d'où le compteur à l'écran.
 */
function consigne(demande: DemandeDeTextes): string {
  return [
    "Tu écris les annonces d'une association d'esport rémoise, Esport des Sacres.",
    "Ton chaleureux et direct, jamais commercial. Tutoiement proscrit, vouvoiement léger.",
    "",
    "🔴 RÈGLE ABSOLUE : n'invente AUCUN fait. Pas de date, d'heure, de lieu, de prix ni de",
    "nom de jeu qui ne figure pas ci-dessous. S'il en manque un, écris le texte sans lui.",
    "",
    demande.faits.length > 0
      ? `Faits établis, à reprendre exactement :\n${demande.faits.map((f) => `- ${f}`).join("\n")}`
      : "Aucun fait n'est fourni : appuie-toi uniquement sur le contexte et l'image.",
    "",
    `Contexte donné par le bénévole :\n${demande.contexte || "(aucun)"}`,
    demande.image ? "\nUne image accompagne la demande : sers-t'en pour le ton et le sujet." : "",
    "",
    // 🔴 LE STYLE MAISON SE DIT AU MODÈLE, SINON IL NE LE DEVINE PAS. Les textes composés
    // par le site (`lib/message-reseaux.ts`) portent 📍 pour le lieu et 🎮 pour les jeux
    // depuis la 6.7 ; ceux du modèle n'en portaient AUCUN, et les deux chemins produisaient
    // donc des annonces qui ne se ressemblaient pas. Défaut vu par Brice sur un post réel.
    // ⚠️ On donne la GRAMMAIRE, pas une liste fermée : imposer trois émojis exacts rendrait
    // plates les annonces qui ne parlent ni de lieu ni de jeux (un remerciement, une photo).
    "Style de la maison : des émojis sobres en tête de ligne pour les faits — 📍 pour le lieu, " +
      "🎮 pour les jeux, 🗓️ pour la date. Jamais d'émoji au milieu d'une phrase, jamais plus " +
      "d'un par ligne. Sur X, où la place manque, ils sont facultatifs.",
    // ⚠️ « quatre » ÉTAIT ÉCRIT EN DUR, et c'est devenu faux au 5ᵉ réseau. Le nombre se compte
    // désormais depuis la liste — un nombre recopié est exactement ce qui se désaligne
    // (le défaut que `schema.ts` documente depuis six occurrences).
    `Rends ${RESEAUX.length} textes, un par réseau, chacun autonome :`,
    `- x : ${X_MAX} caractères MAXIMUM, lien final admis, pas de markdown.`,
    "- discord : markdown accepté (## titre, **gras**), lien final admis.",
    "- facebook : texte clair, pas de markdown, lien final admis.",
    "- instagram : texte clair, AUCUNE URL (elles n'y sont pas cliquables), quelques hashtags à la fin.",
    "- linkedin : audience professionnelle (partenaires, collectivités, bénévoles). On nomme " +
      "l'association plutôt que de tutoyer un joueur. Lien final admis, pas de hashtags.",
  ].join("\n");
}

/**
 * 🔴 LA FORME ATTENDUE SE DÉRIVE DE LA LISTE DES RÉSEAUX, ELLE N'EST PLUS RECOPIÉE. C'est le
 * schéma que le modèle DOIT respecter : une clé oubliée ici lui ferait rendre un texte de
 * moins — sans erreur, sans refus, et l'écran afficherait une zone vide que personne ne
 * relierait à ce fichier.
 * ⚠️ Troisième endroit de CE fichier où le nombre de réseaux était écrit en dur. Les trois ont
 * été trouvés d'un coup au 5ᵉ réseau : aucun ne se serait signalé seul.
 */
const FORME = {
  type: "object",
  properties: Object.fromEntries(RESEAUX.map((r) => [r.cle, { type: "string" }])),
  required: RESEAUX.map((r) => r.cle),
} as const;

export async function proposerTextes(
  demande: DemandeDeTextes,
): Promise<ResultatProposition> {
  const cle = process.env[VARIABLE_CLE]?.trim();
  if (!cle) {
    return {
      ok: false,
      cause: "config",
      error:
        "La proposition automatique n'est pas configurée : la clé d'API manque sur le serveur. " +
        "Vous pouvez écrire les textes à la main.",
    };
  }

  /* ⚠️ Pas d'annotation maison sur ce tableau : le SDK a son union (`TextContent |
     ImageContent | …`) et la recopier l'a fait échouer au typecheck. On laisse inférer. */
  const texte = { type: "text", text: consigne(demande) } as const;
  const entree = demande.image
    ? [
        texte,
        {
          type: "image",
          data: demande.image.base64,
          mime_type: demande.image.typeMime,
        } as const,
      ]
    : [texte];

  let brut: string;
  try {
    const client = new GoogleGenAI({ apiKey: cle });
    const interaction = await client.interactions.create({
      model: process.env[VARIABLE_MODELE]?.trim() || MODELE_PAR_DEFAUT,
      input: entree,
      response_format: { type: "text", mime_type: "application/json", schema: FORME },
    });
    brut = texteRendu(interaction);
  } catch (erreur) {
    // La cause nomme notre infrastructure ; elle va au journal, jamais à l'écran (leçon 5.1).
    console.error("[proposerTextes] Appel au modèle en échec :", erreur);
    /* 🔴 UN REFUS N'EST PAS UNE ABSENCE DE RÉPONSE, ET LES CONFONDRE FAIT RÉESSAYER SANS FIN.
       Mesuré le 2026-09-08 : la clé portait une restriction d'IP, l'API a répondu 403 — et
       l'écran disait « le service n'a pas répondu ». Le bénévole aurait recliqué indéfiniment
       sur un problème que seul un administrateur peut régler. */
    if (estRefus(erreur)) {
      return {
        ok: false,
        cause: "refus",
        error:
          "Le service de rédaction a refusé la demande : clé, quota ou restriction d'accès. " +
          "Réessayer n'y changera rien — prévenez l'administrateur du site. Vous pouvez " +
          "écrire les textes à la main.",
      };
    }
    return {
      ok: false,
      cause: "reseau",
      error:
        "Le service de rédaction n'a pas répondu. Réessayez, ou écrivez les textes à la main.",
    };
  }

  try {
    const rendu: unknown = JSON.parse(brut);
    const messages = lireMessages(rendu);
    if (!messages) {
      return { ok: false, cause: "forme", error: MESSAGE_FORME };
    }
    return { ok: true, data: messages };
  } catch {
    console.error("[proposerTextes] Réponse illisible :", brut.slice(0, 400));
    return { ok: false, cause: "forme", error: MESSAGE_FORME };
  }
}

const MESSAGE_FORME =
  "La réponse du service de rédaction est inexploitable. Réessayez, ou écrivez les textes à la main.";

/** ⚠️ On vérifie la FORME, jamais les longueurs — voir l'en-tête du fichier. */
function lireMessages(valeur: unknown): MessagesReseaux | null {
  if (typeof valeur !== "object" || valeur === null) return null;
  const objet = valeur as Record<string, unknown>;
  const cles = ["discord", "x", "facebook", "instagram"] as const;
  const sortie: Partial<MessagesReseaux> = {};
  for (const cle of cles) {
    const texte = objet[cle];
    if (typeof texte !== "string" || texte.trim() === "") return null;
    sortie[cle] = texte.trim();
  }
  return sortie as MessagesReseaux;
}
