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
 * La seconde parade est humaine : les quatre textes sont **relus et modifiables** avant envoi.
 *
 * ⚠️ **L'IMAGE EST LUE, PAS STOCKÉE.** `/medias/[filename]` ne sert que les fichiers portant
 * une ligne `photo` PUBLIÉE — une image déposée ici ne serait donc atteignable par personne.
 * Elle part en base64 vers le modèle et n'est écrite nulle part. Publier une image est un
 * autre sujet, qui viendra avec Instagram : c'est le seul réseau qui en EXIGE une, et il la
 * veut à une URL publique.
 *
 * ⚠️ **LES BORNES NE SONT PAS VÉRIFIÉES ICI.** Un texte X trop long est **rendu quand même**,
 * compteur en rouge : refuser la réponse entière ferait perdre les trois autres textes pour
 * un dépassement que le bénévole corrige en dix secondes.
 */
import { GoogleGenAI } from "@google/genai";

import type { MessagesReseaux } from "../../lib/message-reseaux";
import { X_MAX } from "../../lib/message-reseaux";

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
    "Rends quatre textes, un par réseau, chacun autonome :",
    `- x : ${X_MAX} caractères MAXIMUM, lien final admis, pas de markdown.`,
    "- discord : markdown accepté (## titre, **gras**), lien final admis.",
    "- facebook : texte clair, pas de markdown, lien final admis.",
    "- instagram : texte clair, AUCUNE URL (elles n'y sont pas cliquables), quelques hashtags à la fin.",
  ].join("\n");
}

const FORME = {
  type: "object",
  properties: {
    discord: { type: "string" },
    x: { type: "string" },
    facebook: { type: "string" },
    instagram: { type: "string" },
  },
  required: ["discord", "x", "facebook", "instagram"],
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
        "Vous pouvez écrire les quatre textes à la main.",
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
    brut = interaction.output_text ?? "";
  } catch (erreur) {
    // La cause nomme notre infrastructure ; elle va au journal, jamais à l'écran (leçon 5.1).
    console.error("[proposerTextes] Appel au modèle en échec :", erreur);
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
