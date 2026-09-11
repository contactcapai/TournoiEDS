/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LE TEXTE PUBLIÉ SE COMPOSE ICI, PAS DANS n8n (Story 7.6, volet ④ de R42)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 Le workflow vit dans une instance partagée avec une douzaine de projets, qui peut être
 * ré-importée, dupliquée ou restaurée sans que personne ici ne le sache (`n8n/README.md`).
 * Un texte écrit dans un nœud Code y serait invérifiable et perdu au premier incident. Ici il
 * est testé, versionné, et une reformulation se relit en PR.
 *
 * ⚠️ CHAQUE RÉSEAU A SA CONTRAINTE, ET ELLES NE SE DEVINENT PAS :
 * · X plafonne à 280 caractères — le seul dont un dépassement est un REFUS d'API.
 * · Instagram ne rend AUCUN lien cliquable en légende ⇒ on renvoie à la bio, jamais à une URL.
 * · Discord accepte le markdown ; Facebook et Instagram le rendent en clair, donc aucun `**`.
 */
import { formatLongDate, formatTime } from "./date-paris";

/** 🔴 Limite dure de X. Au-delà, l'API refuse — c'est le seul plafond qui bloque. */
export const X_MAX = 280;

export interface EvenementAAnnoncer {
  titre: string;
  /** Instant du début. ⚠️ Formaté par `date-paris`, JAMAIS par `getHours()` : un `+02:00` lu
   *  en UTC publierait « 16h00 » pour une soirée à 18h00. Vu sur le premier brouillon. */
  debut: Date;
  lieu: string | null;
  adresse: string | null;
  jeux: string | null;
  /** Où l'annonce renvoie : la page publique de l'agenda. */
  lien: string;
}

export interface MessagesReseaux {
  discord: string;
  x: string;
  facebook: string;
  instagram: string;
  /**
   * 🔴 AJOUTÉ LE 2026-09-11, ET IL MANQUAIT DEPUIS LE DÉBUT. L'asso a un compte LinkedIn
   * (`/company/esport-des-sacres`, dans les réglages du site depuis la 6.13), mais l'outil de
   * publication ne lui composait **aucun texte** — pendant qu'il en composait un pour
   * Facebook, dont personne n'avait vérifié qu'une Page existait. Une place pour un compte
   * absent, et aucune place pour un compte présent : les deux moitiés du même oubli.
   */
  linkedin: string;
}

/** « Le Dropkick Bar — Reims Courlancy » · « Le Dropkick Bar » · « » si rien n'est su. */
function ou(ev: EvenementAAnnoncer): string {
  return [ev.lieu, ev.adresse].filter((part) => part && part.trim()).join(" — ");
}

/** Assemble en sautant ce qui est absent : un champ vide ne laisse pas de séparateur orphelin. */
function joindre(separateur: string, ...valeurs: (string | false | null | undefined)[]): string {
  return valeurs.filter((v): v is string => Boolean(v && v.trim())).join(separateur);
}

/**
 * Les lignes d'un message.
 *
 * 🔴 UNE CHAÎNE VIDE EST UNE LIGNE BLANCHE VOULUE, ET ELLE SURVIT. La première version la
 * filtrait avec les champs absents : les quatre textes partaient **sans aucun paragraphe**,
 * en un bloc compact. Aucun test ne le voyait — ils vérifiaient qu'il n'y a pas DE TROU, jamais
 * qu'il y a bien la RESPIRATION. Un `""` explicite et un champ nul ne veulent pas dire la
 * même chose ; les confondre était le défaut.
 */
function lignes(...valeurs: (string | false | null | undefined)[]): string {
  return valeurs.filter((v): v is string => v === "" || Boolean(v && v.trim())).join("\n");
}

export function composerMessages(ev: EvenementAAnnoncer): MessagesReseaux {
  const quand = `${formatLongDate(ev.debut)} à ${formatTime(ev.debut)}`;
  const lieu = ou(ev);
  const jeux = ev.jeux?.trim() ? `🎮 ${ev.jeux.trim()}` : null;
  const invitation = "Venez comme vous êtes, matériel ou pas.";

  return {
    discord: lignes(
      `## ${ev.titre}`,
      joindre(" · ", `**${quand}**`, lieu),
      jeux,
      "",
      invitation,
      ev.lien,
    ),
    x: composerX(ev, quand, lieu, jeux),
    facebook: lignes(
      `${ev.titre} — ${quand}`,
      // ⚠️ Ternaire et NON `lieu && …` : sans lieu, `&&` rend la CHAÎNE VIDE, que `lignes`
      // traite désormais comme une ligne blanche voulue. Un trou de plus, en silence.
      lieu ? `📍 ${lieu}` : null,
      jeux,
      "",
      invitation,
      "",
      `Tout l'agenda : ${ev.lien}`,
    ),
    /**
     * 🔴 LINKEDIN N'EST PAS FACEBOOK AVEC UN AUTRE NOM. Son audience est professionnelle :
     * partenaires, collectivités, bénévoles potentiels. Le texte y nomme donc **l'association**
     * plutôt que de tutoyer un joueur, et il garde l'URL — LinkedIn la rend cliquable.
     * ⚠️ Pas d'emoji en tête de titre ici : sur ce réseau ils passent pour du bruit. Les deux
     * marqueurs de faits (📍 🎮) restent, eux : ils structurent, ils ne décorent pas.
     */
    linkedin: lignes(
      `${ev.titre} — ${quand}`,
      lieu ? `📍 ${lieu}` : null,
      jeux,
      "",
      "Esport des Sacres organise des rendez-vous de jeu ouverts à tous, à Reims.",
      "",
      `Le programme complet : ${ev.lien}`,
    ),
    instagram: lignes(
      `${ev.titre} — ${quand}`,
      // ⚠️ Ternaire et NON `lieu && …` : sans lieu, `&&` rend la CHAÎNE VIDE, que `lignes`
      // traite désormais comme une ligne blanche voulue. Un trou de plus, en silence.
      lieu ? `📍 ${lieu}` : null,
      jeux,
      "",
      invitation,
      // 🔴 Pas d'URL : Instagram ne la rendrait pas cliquable, et une adresse qu'on ne peut
      // pas suivre se lit comme une maladresse.
      "L'agenda complet est en bio.",
      "",
      "#esport #reims #esportdessacres #jeuxvideo",
    ),
  };
}

/**
 * 🔴 X EST LE SEUL À AVOIR UN PLAFOND QUI REFUSE. On retire donc dans un ORDRE choisi —
 * d'abord l'adresse, puis les jeux — au lieu de tronquer : une annonce coupée au milieu d'un
 * mot est pire qu'une annonce sans l'adresse, que le lien donne de toute façon.
 * ⚠️ En dernier recours le TITRE est tronqué : il est libre, donc rien ne borne sa longueur.
 */
function composerX(
  ev: EvenementAAnnoncer,
  quand: string,
  lieu: string,
  jeux: string | null,
): string {
  const essais = [
    lignes(ev.titre, joindre(" · ", quand, lieu), jeux, "", ev.lien),
    lignes(ev.titre, joindre(" · ", quand, ev.lieu), jeux, "", ev.lien),
    lignes(ev.titre, joindre(" · ", quand, ev.lieu), "", ev.lien),
    lignes(ev.titre, quand, "", ev.lien),
  ];
  const tenu = essais.find((essai) => essai.length <= X_MAX);
  if (tenu) return tenu;

  // ⚠️ On RÉTRÉCIT ET ON REMESURE, au lieu de calculer la place restante : le calcul, lui,
  // se désaligne au premier séparateur ajouté — il s'était déjà trompé d'un caractère ici.
  let titre = ev.titre.trim();
  let message = lignes(`${titre}…`, quand, "", ev.lien);
  while (message.length > X_MAX && titre.length > 1) {
    titre = titre.slice(0, -Math.max(1, Math.ceil((message.length - X_MAX) / 2))).trimEnd();
    message = lignes(`${titre}…`, quand, "", ev.lien);
  }
  return message;
}
