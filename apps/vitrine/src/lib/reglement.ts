import { formatLongDate, formatTime, jourLisible, jourParis } from "./date-paris";
import { libellePlaces } from "./libelles-tournoi";
import { SEUIL_VICTOIRE_DEFAUT } from "./tournoi/finale";
import { estParTables, type PhaseKind } from "./tournoi/structure";

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

/** Les trous remplis par le site — affichés au bénévole ; un test les tient d'accord avec `valeursDuTournoi`. */
export const TROUS_AUTOMATIQUES = [
  "nom du tournoi", "jeu", "date", "heure", "heure de fin", "lieu", "tarif", "places", "lots",
  "format d'équipe", "durée d'un match", "déroulé", "jour des qualifications",
  "jour de la finale", "nombre de manches de qualification", "seuil du matchpoint",
  "adresse de la fiche", "adresse du règlement",
] as const;

/** Ce que le site sait du tournoi : sa fiche ENREGISTRÉE et son déroulé. */
export type DonneesTournoi = {
  name: string;
  game: string;
  slug: string;
  startsAt: Date;
  endsAt: Date | null;
  venueName: string | null;
  priceText: string | null;
  capacity: number | null;
  prizes: string | null;
  teamSize: number;
  matchDurationMinutes: number | null;
  formatText: string | null;
  phases: readonly { name: string; kind: PhaseKind; playedOn: string | null; settings: unknown }[];
};

const NATURE: Record<PhaseKind, string> = {
  poule: "poule",
  bracket: "tableau",
  lobbies: "lobbies",
  suisse: "manche suisse",
  finale: "finale",
};

function seuilDe(settings: unknown): number {
  const brut =
    typeof settings === "object" && settings !== null
      ? (settings as Record<string, unknown>).seuilDeVictoire
      : undefined;
  return typeof brut === "number" && Number.isInteger(brut) && brut >= 1
    ? brut
    : SEUIL_VICTOIRE_DEFAUT;
}

/**
 * Les trous que le site remplit seul. ⚠️ Une donnée absente ne remplit RIEN : le trou reste et
 * la fenêtre le demande — jamais « 0 place » ni « gratuit » par défaut.
 */
export function valeursDuTournoi(t: DonneesTournoi, baseDuSite: string): Record<string, string> {
  const fiche = `${baseDuSite}/tournois/${t.slug}`;
  const jour = (p: { playedOn: string | null }) => jourLisible(p.playedOn ?? jourParis(t.startsAt));
  const finale = t.phases.find((p) => p.kind === "finale");
  const qualifs = t.phases.filter((p) => p.kind !== "finale");
  const avecJours = new Set(t.phases.map((p) => p.playedOn)).size > 1;

  const deroule =
    t.phases.length > 0
      ? t.phases
          .map((p) => `- ${avecJours ? `${jour(p)} — ` : ""}${p.name} (${NATURE[p.kind]})`)
          .join("\n")
      : (t.formatText ?? "");

  return {
    "nom du tournoi": t.name,
    jeu: t.game,
    date: formatLongDate(t.startsAt),
    heure: formatTime(t.startsAt),
    "heure de fin": t.endsAt ? formatTime(t.endsAt) : "",
    lieu: t.venueName ?? "",
    tarif: t.priceText ?? "",
    // « 8 équipes de 2 joueurs », comme la fiche : « 8 » seul se lisait « 8 joueurs » sur un 2v2.
    places: t.capacity === null ? "" : libellePlaces(t.capacity, t.teamSize),
    lots: t.prizes ?? "",
    "format d'équipe":
      t.teamSize > 1 ? `équipes de ${t.teamSize} joueurs (${t.teamSize}v${t.teamSize})` : "individuel",
    "durée d'un match": t.matchDurationMinutes ? `environ ${t.matchDurationMinutes} minutes` : "",
    "déroulé": deroule,
    "jour des qualifications": qualifs[0] ? jour(qualifs[0]) : "",
    "jour de la finale": finale ? jour(finale) : "",
    "nombre de manches de qualification": qualifs.every((p) => estParTables(p.kind)) && qualifs.length > 0
      ? String(qualifs.length)
      : "",
    "seuil du matchpoint": finale ? String(seuilDe(finale.settings)) : "",
    "adresse de la fiche": fiche,
    "adresse du règlement": `${fiche}/reglement`,
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

/**
 * Ce que la fiche dit « à savoir », et la phrase du règlement qui en fait foi : la ligne ne
 * paraît que si le règlement COPIÉ dans le tournoi la contient encore (modèle « sur place »).
 */
export const A_SAVOIR = [
  {
    preuve: "15 minutes avant le début du Tournoi",
    texte: "Présentez-vous au stand EDS 15 minutes avant le début, pour le pointage.",
  },
  {
    preuve: "exclusivement sur le matériel fourni par EDS",
    texte: "Le matériel est fourni sur place : aucun périphérique personnel n'est accepté.",
  },
  {
    preuve: "moins de 16 ans doivent avoir l'accord d'un parent",
    texte: "Moins de 16 ans : accord d'un parent, présent sur place ou par autorisation écrite.",
  },
] as const;
