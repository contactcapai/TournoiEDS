"use server";

import { and, asc, eq, isNull } from "drizzle-orm";

import { cheminLogo, estLogoDuVolume, LOGO_HAUTEUR } from "../../lib/logos";
import { partnerInputSchema, type PartnerCategory } from "../../lib/schemas/partner";
import { requireAdmin } from "../auth/guard";
import { db } from "../db/client";
import { partner } from "../db/schema";
import { normaliserLogo, supprimerMedia, type EchecMedia } from "../medias";
import {
  erreursParChamp,
  identifiant,
  messageErreurBase as traduireErreurBase,
  type ResultatAction,
} from "./_commun";

/**
 * Server Actions des partenaires du back-office (Story 6.5, FR22, FR33, AR-API1, AR-DB4).
 *
 * Le patron de saisie est celui d'`actions/agenda.ts` (6.3) puis `actions/galerie.ts` (6.4),
 * repris littéralement : `await requireAdmin()` en PREMIÈRE LIGNE de chaque action, retour
 * discriminé, aucun `revalidateTag` (les pages publiques sont `force-dynamic`, il n'y a rien
 * à invalider — fait mesuré au cadrage de l'Epic 6, et `check:docs` a une règle qui le tient).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QUI DIFFÈRE DE LA GALERIE, ET CE N'EST PAS UN DÉTAIL D'IMPLÉMENTATION
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * ① **LE FICHIER SE REMPLACE ET SE RETIRE.** `actions/galerie.ts` refuse les deux (« supprimez
 *    et re-téléversez ») parce qu'une photo de soirée ne se met pas à jour. **Une marque, si** :
 *    un sponsor refait sa charte, et son entrée — nom, catégorie, description, lien, rang —
 *    doit lui survivre. Obliger à recréer ferait perdre tout le reste pour changer un fichier.
 *
 * ② **DEUX FORMES DE VALEUR COEXISTENT DANS `logo`** (`lib/logos.ts`) : les 4 logos semés
 *    vivent dans `public/`, versionnés ; les téléversés vivent sur le volume. 🔴 Toute
 *    destruction passe donc par `estLogoDuVolume()` — un `unlink()` sur `/partenaires/…` ne
 *    détruirait rien (`supprimerMedia` refuse par comparaison de préfixe), mais **on croirait
 *    l'avoir supprimé**, ce qui est pire qu'un échec bruyant.
 *
 * ③ **L'ORDRE EST PROPRE À UNE CATÉGORIE.** Le tri des requêtes publiques est
 *    `category, sort_order, name, id` : `category` tranche AVANT `sort_order`. Renuméroter à
 *    plat sur toute la table serait sans effet observable entre deux catégories, donc un
 *    mensonge à l'écran.
 */

/**
 * Nom lisible du champ derrière chaque contrainte de validité de la table `partner`.
 *
 * ⚠️ TABLE PROPRE À CE DOMAINE, et c'est le point de l'extraction de `_commun.ts` : le
 * traducteur est partagé, sa table ne l'est pas. Une table commune ferait qu'ajouter une
 * contrainte côté agenda toucherait les partenaires.
 *
 * 🔴 LES NOMS SONT CEUX DE LA MIGRATION `0009`, PAS LES ANCIENS `*_not_blank`. La `0009` les a
 * renommés en leur ajoutant leur plafond ; garder l'ancien nom ici ferait retomber le bénévole
 * sur un message générique qui ne nomme aucun champ — c'est le défaut trouvé en revue de la
 * 6.3, où huit contraintes sur dix y tombaient.
 */
const CHAMP_PAR_CONTRAINTE: Record<string, string> = {
  partner_name_valide: "le nom",
  partner_description_valide: "la description",
  partner_link_valide: "l'adresse du site",
  partner_logo_valide: "le chemin du logo",
};

/**
 * Cas particuliers : contraintes dont le message ne se déduit PAS du nom d'un champ.
 *
 * ⚠️ `partner_logo_unique` est un `23505`, pas un `23514` — il est traité plus bas, dans
 * `messageErreurBase`. Cette table-ci ne sert qu'aux `CHECK`.
 */
const CAS_PARTICULIERS: Record<string, string> = {};

/** Traducteur partagé (`_commun.ts`), appliqué à la table de CE domaine. */
function messageErreurBase(erreur: unknown): string {
  const details = erreur as { code?: string; constraint_name?: string; constraint?: string };
  // 🔴 L'UNICITÉ DU LOGO MÉRITE SA PHRASE : le message générique de `_commun.ts` (« Cet
  // élément existe déjà ») ne dirait pas QUOI, et le bénévole chercherait un doublon de nom.
  if (
    details.code === "23505" &&
    (details.constraint_name ?? details.constraint) === "partner_logo_unique"
  ) {
    return (
      "Ce fichier de logo est déjà utilisé par un autre partenaire. Téléversez-en une copie " +
      "plutôt que de partager le même fichier : sinon, supprimer l'un ferait disparaître le " +
      "logo de l'autre."
    );
  }
  return traduireErreurBase(erreur, CHAMP_PAR_CONTRAINTE, CAS_PARTICULIERS);
}

/**
 * 🔴 CE QU'UN REFUS DE FICHIER DIT AU BÉNÉVOLE — TABLE PROPRE AUX LOGOS.
 *
 * ⚠️ **DEUXIÈME COPIE, COMPTÉE ET ASSUMÉE** (la première est dans `actions/galerie.ts`). Elle
 * n'est pas extraite, et pour une raison de fond : ces messages sont de la **présentation**,
 * pas une garde de correction, et **deux d'entre eux diffèrent réellement** —
 *   · `svg` : ici il doit **proposer une sortie**, parce que c'est le refus que les logos vont
 *     rencontrer le plus souvent (un kit de marque envoyé par un sponsor est presque toujours
 *     un SVG). Dans la galerie, le cas est marginal ;
 *   · `dimensions` : le plafond des logos est **40 Mpx**, pas 100 — le message doit dire le bon
 *     nombre, sinon il envoie chercher un défaut qui n'existe pas.
 * Fusionner obligerait à paramétrer deux phrases sur cinq pour économiser trois lignes.
 *
 * Aucun de ces messages n'expose de chemin système. ⚠️ Le cas `volume` NOMME la variable
 * d'environnement : c'est le seul qu'un bénévole ne peut pas corriger lui-même, donc le seul
 * où le message doit donner à la personne qui l'aidera de quoi chercher.
 */
const MESSAGE_ECHEC_LOGO: Record<EchecMedia["motif"], string> = {
  illisible:
    "Ce fichier n'est pas une image que le site sait lire. Vérifiez que vous avez bien choisi le logo (JPEG, PNG, WebP ou AVIF).",
  svg:
    "Les fichiers .svg ne sont pas acceptés, pour des raisons de sécurité — et c'est souvent " +
    "le format d'un logo envoyé par un partenaire. Ouvrez-le et exportez-le en PNG (ou WebP), " +
    `d'au moins ${LOGO_HAUTEUR} pixels de haut, puis réessayez.`,
  format: "Ce format d'image n'est pas accepté. Formats acceptés : JPEG, PNG, WebP, AVIF.",
  dimensions:
    "Cette image est démesurément grande (plus de 40 millions de pixels). Un logo n'a jamais " +
    "cette taille : le fichier est probablement anormal. Rien n'a été enregistré.",
  volume:
    "Le dossier des médias du site est introuvable (variable MEDIA_DIR). Rien n'a été enregistré — signalez-le, c'est un réglage du serveur.",
  ecriture:
    "L'enregistrement du fichier a échoué. Rien n'a été conservé, vous pouvez réessayer.",
};

/** Ce que l'écran reçoit après un téléversement de logo réussi. */
export type LogoEnregistre = {
  /** Valeur stockée en base (`/medias/logos/<uuid>.webp`). */
  logo: string;
  largeur: number;
  hauteur: number;
  /**
   * 🔴 La source était plus petite que la hauteur canonique : elle n'a **pas** été agrandie,
   * donc ce logo apparaîtra plus petit que les autres dans le bandeau. **L'écran le DIT** —
   * doctrine R23 : avertir, jamais corriger dans le dos.
   */
  plusPetitQueLaBoite: boolean;
  /**
   * 🔴 Le fichier produit est un **FILET** : une source très allongée (4000 × 96, ou son
   * miroir 96 × 4000) ressort de la boîte canonique en 380 × 9 ou 2 × 96 — illisible dans la
   * tuile. Le redimensionnement a fait exactement ce qu'on lui demandait ; c'est le format
   * d'origine qui ne convient pas.
   * ⚠️ **Deux faits DISTINCTS, donc deux booléens** — contrairement à `sourceAdmin` (6.4),
   * où les deux faits étaient indissociables. Ici « trop petit » et « trop étiré » ont deux
   * causes et deux réponses différentes à demander au partenaire : les fondre ferait un
   * message qui ne dit ni l'un ni l'autre.
   */
  filet: boolean;
};

/**
 * Lit les champs texte d'un formulaire de partenaire et les valide.
 *
 * ⚠️ `logo`, `sortOrder` et `isPublished` sont OMIS du schéma : les omettre est ce qui garantit
 * qu'un POST direct ne peut pas les réécrire au passage. Ils ont chacun leur propre action.
 */
function analyserChamps(formData: FormData) {
  const linkBrut = String(formData.get("link") ?? "");
  return partnerInputSchema
    .omit({ logo: true, sortOrder: true, isPublished: true })
    .safeParse({
      name: formData.get("name"),
      category: formData.get("category"),
      description: formData.get("description"),
      link: linkBrut,
    });
}

/**
 * Crée un partenaire, **en brouillon**.
 *
 * ⚠️ Le rang est CALCULÉ dans la catégorie choisie, jamais laissé au défaut `0` : sinon le
 * départage se fait sur le nom puis l'UUID, et « monter d'un cran » n'aurait aucune prise
 * (même défaut que celui corrigé dans la galerie, voir `getMaxSortOrder`).
 */
export async function creerPartenaire(
  formData: FormData,
): Promise<ResultatAction<{ id: string }>> {
  await requireAdmin();

  const analyse = analyserChamps(formData);
  if (!analyse.success) {
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  try {
    const rang = await rangSuivant(analyse.data.category);
    const [ligne] = await db
      .insert(partner)
      // 🔴 `isPublished: false` EXPLICITE, et `logo: null` : un partenaire naît invisible et
      // sans image. Le logo se téléverse depuis sa fiche, une fois qu'elle existe — sinon un
      // fichier serait écrit avant qu'aucune ligne ne puisse le porter (octet orphelin).
      .values({ ...analyse.data, logo: null, sortOrder: rang, isPublished: false })
      .returning({ id: partner.id });
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[creerPartenaire] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/** Le rang suivant DANS UNE CATÉGORIE (voir le point ③ de l'en-tête). */
async function rangSuivant(categorie: PartnerCategory): Promise<number> {
  const lignes = await db
    .select({ sortOrder: partner.sortOrder })
    .from(partner)
    .where(eq(partner.category, categorie));
  return lignes.reduce((max, l) => Math.max(max, l.sortOrder), -1) + 1;
}

/**
 * Met à jour le nom, la catégorie, la description et le lien.
 *
 * ⚠️ NE TOUCHE NI AU LOGO, NI AU RANG, NI À LA PUBLICATION — chacun a son action. C'est ce qui
 * évite la dette **R35** (l'écrasement silencieux d'un `isPublished` basculé ailleurs pendant
 * qu'un formulaire était ouvert) : ce formulaire-ci ne soumet tout simplement pas ce champ.
 *
 * 🔴 CHANGER DE CATÉGORIE DÉPLACE L'ENTRÉE DANS UN AUTRE ORDRE. Son `sort_order` n'a plus de
 * sens dans sa nouvelle catégorie (il peut entrer en collision, ou la propulser en tête). On
 * lui donne donc le **rang suivant de sa nouvelle catégorie** — c'est le comportement le moins
 * surprenant : elle arrive à la fin, et se remonte à la main. L'écran le dit.
 */
export async function enregistrerPartenaire(
  id: string,
  formData: FormData,
): Promise<ResultatAction<{ id: string }>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  const analyse = analyserChamps(formData);
  if (!analyse.success) {
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  try {
    const actuel = await db.query.partner.findFirst({
      columns: { category: true },
      where: (table, { eq: egal }) => egal(table.id, id),
    });
    if (!actuel) {
      return {
        ok: false,
        error: "Ce partenaire n'existe plus : il a été supprimé entre-temps.",
      };
    }

    const changeDeCategorie = actuel.category !== analyse.data.category;
    const valeurs = changeDeCategorie
      ? { ...analyse.data, sortOrder: await rangSuivant(analyse.data.category) }
      : analyse.data;

    const [ligne] = await db
      .update(partner)
      .set(valeurs)
      .where(eq(partner.id, id))
      .returning({ id: partner.id });

    if (!ligne) {
      return {
        ok: false,
        error: "Ce partenaire n'existe plus : il a été supprimé entre-temps.",
      };
    }
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[enregistrerPartenaire] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Téléverse **ou REMPLACE** le logo d'un partenaire existant.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LA LIGNE D'ABORD, L'ANCIEN FICHIER ENSUITE — ET L'ORDRE EST LA DÉCISION
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Les deux échecs possibles ne coûtent pas la même chose :
 *   · ligne puis ancien fichier → si le retrait échoue, il reste un **octet orphelin** sur le
 *     volume : invisible du public, sans conséquence sur le rendu ;
 *   · ancien fichier puis ligne → la ligne pointerait un instant sur un fichier détruit,
 *     c'est-à-dire un **cadre cassé sur la page d'accueil**.
 * On préfère perdre l'octet. C'est le même arbitrage que `supprimerPhoto` (6.4), et il vaut
 * ici pour un motif de plus : **sans le retrait, chaque changement de charte laisserait un
 * fichier que plus aucun écran ne peut atteindre** — invisible, et croissant.
 *
 * 🔴 ET SI L'ÉCRITURE EN BASE ÉCHOUE, C'EST LE **NOUVEAU** FICHIER QUI PART. Symétrique de
 * `televerserPhoto` : il n'existe alors aucune ligne pour le porter.
 */
export async function remplacerLogoPartenaire(
  id: string,
  formData: FormData,
): Promise<ResultatAction<LogoEnregistre>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, error: "Aucun fichier n'a été reçu. Réessayez de le sélectionner." };
  }

  // On relit l'ANCIEN logo AVANT d'écrire quoi que ce soit : c'est lui qu'il faudra retirer,
  // et le lire après la mise à jour serait trop tard (la colonne porterait déjà le nouveau).
  let ancien: string | null;
  try {
    const ligne = await db.query.partner.findFirst({
      columns: { logo: true },
      where: (table, { eq: egal }) => egal(table.id, id),
    });
    if (!ligne) {
      return { ok: false, error: "Ce partenaire n'existe plus : il a été supprimé entre-temps." };
    }
    ancien = ligne.logo;
  } catch (erreur) {
    console.error("[remplacerLogoPartenaire] Échec de la lecture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }

  // ── Le contenu décide, le nom vient du serveur, l'image est normalisée ─────────────
  const contenu = Buffer.from(await fichier.arrayBuffer());
  const normalisation = await normaliserLogo(contenu);
  if (!normalisation.ok) {
    return { ok: false, error: MESSAGE_ECHEC_LOGO[normalisation.echec.motif] };
  }

  const nouveau = cheminLogo(normalisation.filename);

  try {
    // ══════════════════════════════════════════════════════════════════════════════════
    // 🔴 CONCURRENCE OPTIMISTE SUR LE LOGO — DÉFAUT TROUVÉ EN REVUE (Edge Case Hunter)
    // ══════════════════════════════════════════════════════════════════════════════════
    //
    // La première version faisait `WHERE id = id` seul. Deux remplacements quasi simultanés
    // sur le MÊME partenaire (deux onglets) écrivaient alors deux fichiers distincts — noms
    // UUID, donc aucune collision, donc aucune erreur — puis les deux `UPDATE` réussissaient.
    // Le second écrasait `logo`, et le fichier du premier restait sur le volume **référencé
    // par aucune ligne** : l'octet orphelin que ce module passe son temps à empêcher.
    //
    // ⚠️ La garde de ré-entrée de `LogoUploader` ferme le double-clic dans UN onglet ; elle
    // ne peut rien contre deux onglets. Et le rôle admin est unique (FR27), donc le scénario
    // suppose une même personne en double — c'est le raisonnement qui a fait ACCEPTER la
    // dette R35 sur `enregistrerEvenement`. 🔴 **Mais la conséquence n'est pas la même** :
    // là-bas un champ était écrasé, ici c'est un octet qui s'accumule sur un volume qu'on
    // SAUVEGARDE, et que plus aucun écran ne peut atteindre. On ferme.
    //
    // ⚠️ `isNull` ET NON `eq(partner.logo, null)` : en SQL, `logo = NULL` n'est jamais VRAI —
    // la comparaison rendrait la clause toujours fausse, donc l'action échouerait
    // systématiquement sur un partenaire SANS logo, c'est-à-dire sur le cas nominal du
    // PREMIER téléversement. Le piège est silencieux : le typage TypeScript l'accepte.
    const [ligne] = await db
      .update(partner)
      .set({ logo: nouveau })
      .where(
        and(
          eq(partner.id, id),
          ancien === null ? isNull(partner.logo) : eq(partner.logo, ancien),
        ),
      )
      .returning({ id: partner.id });

    if (!ligne) {
      // Deux causes, indiscernables d'ici et qui appellent la même réponse : la ligne a
      // disparu, ou son logo a changé depuis notre lecture. Dans les deux cas le fichier
      // qu'on vient de poser n'a plus de porteur légitime — il part.
      await supprimerMedia(normalisation.filename);
      return {
        ok: false,
        error:
          "Ce partenaire a changé depuis l'affichage de cette page : il a été supprimé, ou " +
          "son logo a été remplacé ailleurs. Rien n'a été enregistré — rechargez la page pour " +
          "repartir de l'état réel.",
      };
    }
  } catch (erreur) {
    console.error("[remplacerLogoPartenaire] Échec de l'écriture en base :", erreur);
    // 🔴 LE NOUVEAU FICHIER PART AVEC L'ÉCHEC. Sans ça, chaque erreur d'écriture laisserait un
    // octet que plus aucune ligne ne référence, donc qu'aucun écran ne peut supprimer.
    await supprimerMedia(normalisation.filename);
    return { ok: false, error: messageErreurBase(erreur) };
  }

  await retirerFichierSiDuVolume(ancien, "remplacerLogoPartenaire");

  return {
    ok: true,
    data: {
      logo: nouveau,
      largeur: normalisation.largeur,
      hauteur: normalisation.hauteur,
      plusPetitQueLaBoite: normalisation.plusPetitQueLaBoite,
      filet: normalisation.filet,
    },
  };
}

/**
 * Retire le logo d'un partenaire **sans supprimer l'entrée**.
 *
 * ⚠️ CONSÉQUENCE À DIRE, PAS À DEVINER : l'entrée reste publiée et reste sur `/partenaires`
 * (son nom prend la place du logo dans la tuile), mais elle **sort du bandeau de l'accueil**,
 * dont la requête filtre `logo IS NOT NULL`. Et si c'était la dernière à en avoir un,
 * `ProofBand` se rend `null` — la bande de preuve **disparaît entièrement** de la home.
 */
export async function retirerLogoPartenaire(id: string): Promise<ResultatAction<undefined>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  // 🔴 ON RELIT L'ANCIEN LOGO **AVANT** L'`UPDATE`, ET C'EST OBLIGATOIRE.
  // `returning({ logo })` rendrait la valeur d'APRÈS la mise à jour, c'est-à-dire `null` :
  // on ne saurait alors plus quel fichier retirer, et chaque retrait laisserait un octet
  // orphelin sur le volume — silencieusement, puisque l'action aurait rendu `ok: true`.
  // ⚠️ Même piège exactement que dans `remplacerLogoPartenaire`, et c'est pour cela que les
  // deux le lisent en amont. `supprimerPartenaire`, lui, peut utiliser `returning` : un
  // `DELETE` rend la ligne telle qu'elle était.
  let ancien: string | null;
  try {
    const ligne = await db.query.partner.findFirst({
      columns: { logo: true },
      where: (table, { eq: egal }) => egal(table.id, id),
    });
    if (!ligne) return { ok: false, error: "Ce partenaire n'existe plus." };
    ancien = ligne.logo;
  } catch (erreur) {
    console.error("[retirerLogoPartenaire] Échec de la lecture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }

  if (ancien === null) {
    // Rien à faire, et ce n'est pas une erreur : l'état voulu est déjà atteint.
    return { ok: true, data: undefined };
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 CETTE GARDE MANQUAIT — DÉFAUT TROUVÉ EN REVUE (Edge Case Hunter). L'ÉCRAN INTERDISAIT
  // CE QUE L'ACTION AUTORISAIT.
  // ══════════════════════════════════════════════════════════════════════════════════════
  //
  // `LogoUploader` masque le bouton « Retirer » quand le logo est l'un des 4 livrés avec le
  // site (`/partenaires/<slug>.webp`, versionnés dans git), et l'écrit en toutes lettres :
  // « il ne peut pas être retiré depuis cet écran ». **L'action, elle, ne portait aucune
  // garde équivalente.** Un POST direct — c'est-à-dire hors du formulaire, ce contre quoi
  // `analyserChamps` et `reordonnerPartenaires` se défendent explicitement dans ce même
  // fichier — désassociait donc le logo d'un des quatre VRAIS sponsors de l'association.
  //
  // 🔴 ET LE GESTE SERAIT IRRÉVERSIBLE DEPUIS L'INTERFACE, c'est ce qui le rend grave malgré
  // son innocence apparente : le fichier survit (il est dans `public/`), mais **aucun écran
  // ne permet de re-pointer `logo` vers `/partenaires/<slug>.webp`** — le téléversement écrit
  // toujours sur le volume. Le sponsor disparaîtrait du bandeau de l'accueil sans retour
  // possible sans passer par la base.
  //
  // ⚠️ « Remplacer » reste ouvert pour ces quatre-là, et c'est cohérent : un remplacement
  // laisse le fichier d'origine intact dans le dépôt.
  if (!estLogoDuVolume(ancien)) {
    return {
      ok: false,
      error:
        "Ce logo fait partie des fichiers livrés avec le site : il ne peut pas être retiré " +
        "depuis cet écran, parce que rien ne permettrait ensuite de le remettre en place. " +
        "Vous pouvez en revanche le remplacer par un autre fichier.",
    };
  }

  try {
    // Concurrence optimiste, même raison que dans `remplacerLogoPartenaire` : si le logo a
    // changé depuis notre lecture, on ne veut ni détruire le fichier d'un autre, ni annoncer
    // un retrait qui n'a pas porté sur ce qu'on croyait.
    const [ligne] = await db
      .update(partner)
      .set({ logo: null })
      .where(and(eq(partner.id, id), eq(partner.logo, ancien)))
      .returning({ id: partner.id });

    if (!ligne) {
      return {
        ok: false,
        error:
          "Ce partenaire a changé depuis l'affichage de cette page : il a été supprimé, ou " +
          "son logo a été modifié ailleurs. Rien n'a été retiré — rechargez la page.",
      };
    }
  } catch (erreur) {
    console.error("[retirerLogoPartenaire] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }

  // La ligne ne référence plus le fichier : il peut partir. L'échec se journalise et ne
  // remonte pas — le logo a bien disparu du site, c'est ce qui était demandé.
  await retirerFichierSiDuVolume(ancien, "retirerLogoPartenaire");
  return { ok: true, data: undefined };
}

/**
 * Supprime un partenaire — la ligne, **et son fichier s'il est du volume**.
 *
 * 🔴 LIGNE D'ABORD, FICHIER ENSUITE (voir `remplacerLogoPartenaire`).
 * ⚠️ L'ÉCHEC DU RETRAIT SE JOURNALISE ET NE REMONTE PAS : le partenaire a bien disparu du
 * site, c'est ce que le bénévole demandait. Lui rendre une erreur le ferait recliquer sur une
 * ligne qui n'existe plus.
 */
export async function supprimerPartenaire(id: string): Promise<ResultatAction<undefined>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .delete(partner)
      .where(eq(partner.id, id))
      .returning({ logo: partner.logo });

    if (!ligne) return { ok: false, error: "Ce partenaire a déjà été supprimé." };

    await retirerFichierSiDuVolume(ligne.logo, "supprimerPartenaire");
    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[supprimerPartenaire] Échec de la suppression :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * 🔴 LE SEUL ENDROIT QUI DÉTRUIT UN FICHIER DE LOGO — ET IL VÉRIFIE D'ABORD SA FORME.
 *
 * Une valeur `/partenaires/<slug>.webp` désigne un fichier de `public/`, **versionné dans
 * git**. `supprimerMedia` le refuserait de toute façon (comparaison de préfixe sur le chemin
 * résolu), donc rien ne serait détruit — mais l'appelant **croirait l'avoir fait**, et c'est
 * le mode de défaillance qu'on refuse : un succès silencieux qui n'a rien produit.
 */
async function retirerFichierSiDuVolume(logo: string | null, appelant: string): Promise<void> {
  if (!estLogoDuVolume(logo)) return;
  const nom = logo.slice(cheminLogo("").length);
  const retire = await supprimerMedia(nom);
  if (!retire) {
    console.error(
      `[${appelant}] Fichier CONSERVÉ sur le volume : ${nom}. Octet orphelin — sans effet sur ` +
        "le rendu, à nettoyer à la main si besoin.",
    );
  }
}

/** Publie ou dépublie un partenaire. */
export async function definirPublicationPartenaire(
  id: string,
  publier: boolean,
): Promise<ResultatAction<{ id: string }>> {
  await requireAdmin();

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .update(partner)
      .set({ isPublished: publier })
      .where(eq(partner.id, id))
      .returning({ id: partner.id });

    if (!ligne) return { ok: false, error: "Ce partenaire n'existe plus." };
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[definirPublicationPartenaire] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}

/**
 * Renumérote **UNE CATÉGORIE** : la position dans `nouvelOrdre` devient le `sort_order`.
 *
 * 🔴 UNE CATÉGORIE, PAS TOUTE LA TABLE — voir le point ③ de l'en-tête. Le tri public est
 * `category, sort_order, …` : `category` tranche AVANT `sort_order`, donc « monter un sponsor
 * au-dessus d'un partenaire » n'a **aucun sens et aucun effet**. Un écran qui proposerait un
 * ordre global à plat mentirait sur ce qu'il fait.
 *
 * 🔴 ON RÉÉCRIT TOUT L'ORDRE DE LA CATÉGORIE, ON NE PERMUTE PAS DEUX LIGNES. Une permutation
 * laisse intactes les égalités existantes — or le cas nominal après un back-office qui laisse
 * le défaut `0` est « tout le monde à 0 », où le départage se fait sur le nom puis l'UUID.
 *
 * ⚠️ EN UNE TRANSACTION : un ordre à moitié réécrit serait pire que pas d'ordre du tout.
 *
 * 🔴 CONCURRENCE OPTIMISTE — REPRISE DE `reordonnerPhotos` (défaut réel trouvé en revue de la
 * 6.4). Chaque ligne de l'écran porte son propre `useTransition` et recalcule l'ordre à partir
 * du MÊME tableau figé au rendu serveur : sans cette comparaison, deux clics rapides partent
 * tous deux de l'état d'AVANT le premier, et le second annule silencieusement le premier —
 * deux `ok: true`, un seul geste appliqué.
 * ⚠️ **La comparaison porte sur la CATÉGORIE, pas sur un préfixe de la table** : c'est
 * l'adaptation qu'impose le point ③. Comparer un préfixe global ferait échouer un
 * réordonnancement de sponsors parce qu'un soutien a bougé ailleurs.
 */
export async function reordonnerPartenaires(
  categorie: PartnerCategory,
  ordreAttendu: string[],
  nouvelOrdre: string[],
): Promise<ResultatAction<{ nombre: number }>> {
  await requireAdmin();

  if (nouvelOrdre.length === 0) return { ok: true, data: { nombre: 0 } };

  if (!nouvelOrdre.every((id) => identifiant.safeParse(id).success)) {
    return { ok: false, error: "La liste des partenaires n'est pas valide. Rechargez la page." };
  }
  // Un doublon ferait qu'une ligne prendrait deux rangs et qu'une autre n'en prendrait aucun :
  // la liste ne serait plus une permutation.
  if (new Set(nouvelOrdre).size !== nouvelOrdre.length) {
    return { ok: false, error: "La liste des partenaires contient un doublon. Rechargez la page." };
  }
  // `nouvelOrdre` doit être une PERMUTATION d'`ordreAttendu`, pas une liste quelconque :
  // sinon un POST direct pourrait renuméroter des lignes qui n'étaient pas à l'écran.
  if (
    ordreAttendu.length !== nouvelOrdre.length ||
    [...ordreAttendu].sort().join() !== [...nouvelOrdre].sort().join()
  ) {
    return { ok: false, error: "La liste des partenaires n'est pas valide. Rechargez la page." };
  }

  try {
    const actuelles = await db
      .select({ id: partner.id })
      .from(partner)
      .where(eq(partner.category, categorie))
      .orderBy(asc(partner.sortOrder), asc(partner.name), asc(partner.id));

    const inchange =
      actuelles.length === ordreAttendu.length &&
      actuelles.every((ligne, rang) => ligne.id === ordreAttendu[rang]);

    if (!inchange) {
      return {
        ok: false,
        error:
          "Cette catégorie a changé depuis l'affichage de la page (un partenaire a été ajouté, " +
          "supprimé, ou déplacé dans une autre catégorie). Rechargez pour repartir de l'ordre " +
          "réel — sinon ce changement en écraserait un autre.",
      };
    }

    await db.transaction(async (tx) => {
      for (const [rang, id] of nouvelOrdre.entries()) {
        // ⚠️ Le `and(…, eq(category))` n'est pas décoratif : il empêche qu'un identifiant
        // d'une AUTRE catégorie, glissé dans la liste par un POST direct, se voie attribuer
        // un rang ici. La permutation ci-dessus le rendrait déjà très difficile ; celle-ci
        // le rend impossible.
        await tx
          .update(partner)
          .set({ sortOrder: rang })
          .where(and(eq(partner.id, id), eq(partner.category, categorie)));
      }
    });

    return { ok: true, data: { nombre: nouvelOrdre.length } };
  } catch (erreur) {
    console.error("[reordonnerPartenaires] Échec de la renumérotation :", erreur);
    return { ok: false, error: messageErreurBase(erreur) };
  }
}
