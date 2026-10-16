import { formatLongDate, formatTime, parisWallClockFromInput } from "./date-paris";

/**
 * Le règlement d'un tournoi : un modèle à trous `{{…}}`, rempli à la création du tournoi.
 *
 * 🔴 UN TROU NON REMPLI NE DOIT JAMAIS ATTEINDRE LA PAGE PUBLIQUE — « {{places}} » lu par un
 * joueur est l'erreur muette de ce domaine. Le schéma du tournoi refuse donc tout texte qui
 * en contient encore (`trousDu`).
 */

/** Un règlement fait 7 pages imprimées ≈ 15 000 caractères ; la borne laisse la marge. */
export const REGLEMENT_MAX = 40000;
/** Le nom d'un modèle (« Règlement TFT EDS »). Aligné sur `NOM_MAX` du tournoi. */
export const MODELE_NOM_MAX = 80;

const MOTIF_TROU = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** Les trous du texte, sans doublon, dans leur ordre d'apparition. */
export function trousDu(texte: string): string[] {
  return [...new Set([...texte.matchAll(MOTIF_TROU)].map((m) => m[1]))];
}

/** Remplit les trous connus et non vides ; les autres restent tels quels. */
export function remplir(texte: string, valeurs: Readonly<Record<string, string>>): string {
  return texte.replace(MOTIF_TROU, (brut, nom: string) => {
    const valeur = valeurs[nom]?.trim();
    return valeur ? valeur : brut;
  });
}

/** Ce que le formulaire du tournoi sait déjà — tel que saisi, champs vides compris. */
export type SaisieTournoi = {
  name: string;
  game: string;
  slug: string;
  startsAt: string;
  venueName: string;
  priceText: string;
  capacity: string;
  prizes: string;
};

/**
 * Les trous que le site remplit seul. ⚠️ Un champ vide ne remplit RIEN : le trou reste et
 * la fenêtre le demande — jamais « 0 place » ni « gratuit » par défaut.
 */
export function valeursDuTournoi(saisie: SaisieTournoi, baseDuSite: string): Record<string, string> {
  const debut = parisWallClockFromInput(saisie.startsAt);
  const fiche = saisie.slug.trim() ? `${baseDuSite}/tournois/${saisie.slug.trim()}` : "";
  return {
    "nom du tournoi": saisie.name,
    jeu: saisie.game,
    date: debut ? formatLongDate(debut) : "",
    heure: debut ? formatTime(debut) : "",
    lieu: saisie.venueName,
    tarif: saisie.priceText,
    places: saisie.capacity,
    lots: saisie.prizes,
    "adresse de la fiche": fiche,
    "adresse du règlement": fiche && `${fiche}/reglement`,
  };
}

export type BlocReglement =
  | { type: "titre" | "sousTitre" | "paragraphe"; texte: string }
  | { type: "liste"; items: string[] };

/**
 * Le texte saisi → des blocs à rendre. Syntaxe volontairement minimale : `# ` un article,
 * `## ` un sous-article, `- ` un élément de liste, une ligne vide sépare les paragraphes.
 */
export function blocsDuReglement(texte: string): BlocReglement[] {
  const blocs: BlocReglement[] = [];
  let paragraphe: string[] = [];
  const clore = () => {
    if (paragraphe.length > 0) blocs.push({ type: "paragraphe", texte: paragraphe.join(" ") });
    paragraphe = [];
  };

  for (const brute of texte.split(/\r?\n/)) {
    const ligne = brute.trim();
    if (ligne === "") {
      clore();
    } else if (ligne.startsWith("## ")) {
      clore();
      blocs.push({ type: "sousTitre", texte: ligne.slice(3).trim() });
    } else if (ligne.startsWith("# ")) {
      clore();
      blocs.push({ type: "titre", texte: ligne.slice(2).trim() });
    } else if (ligne.startsWith("- ")) {
      clore();
      const precedent = blocs.at(-1);
      if (precedent?.type === "liste") precedent.items.push(ligne.slice(2).trim());
      else blocs.push({ type: "liste", items: [ligne.slice(2).trim()] });
    } else {
      paragraphe.push(ligne);
    }
  }
  clore();
  return blocs;
}
