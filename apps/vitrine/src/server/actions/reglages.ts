"use server";

import { eq } from "drizzle-orm";

import { siteSettingInputSchema } from "../../lib/schemas/site-setting";
import { exigerRoleAction } from "../auth/guard";
import { db } from "../db/client";
import { siteSetting } from "../db/schema";
import {
  erreursParChamp,
  messageErreurBase as traduireErreurBase,
  type ResultatAction,
} from "./_commun";

/**
 * Server Actions des réglages du site (Story 6.13, FR38, AR-API1, AR-DB4).
 *
 * Le patron de saisie est celui d'`actions/agenda.ts` (6.3), repris **littéralement** par la
 * galerie, les partenaires, les ateliers et les membres : `await exigerRoleAction("admin_site")` en PREMIÈRE
 * LIGNE de chaque action, retour discriminé, aucun `revalidateTag` (les pages publiques sont
 * `force-dynamic`, il n'y a **rien à invalider** — fait mesuré au cadrage de l'Epic 6, et
 * `check:docs` porte une règle qui le tient).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QUI EST PROPRE À CE DOMAINE : **UNE SEULE LIGNE, ET LE PLUS GRAND RAYON DE DÉGÂTS**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Les six autres surfaces écrivent des lignes qu'on peut dépublier une par une. Celle-ci écrit
 * **la** ligne, et son effet est immédiat sur le **header et le footer des 5 pages publiques**.
 * Trois conséquences qui se lisent dans ce fichier :
 *
 *   ① **AUCUNE CRÉATION, AUCUNE SUPPRESSION.** Il n'y a qu'un `UPDATE`. La ligne naît avec la
 *      migration `0012` et `site_setting_ligne_unique` (`CHECK (id = 1)`) interdit d'en avoir
 *      une seconde. Ne pas ajouter de `creerReglages` / `supprimerReglages` « par symétrie » :
 *      les deux seraient du code mort, et le second détruirait le chrome du site.
 *   ② **UNE VALEUR VIDÉE EST UNE VALEUR RETIRÉE, PAS UNE ERREUR.** Zod ramène à `null` toute
 *      chaîne visuellement vide (`texteOptionnel` / `urlHttpOptionnelle`), et le rendu retombe
 *      alors sur la doctrine de la Story 5.5 : **aucun lien** — ni `href`, ni focus, ni annonce
 *      « nouvel onglet ». C'est le geste normal quand un compte est fermé.
 *   ③ **`contactEmail` NE PILOTE PAS L'EXPÉDITEUR DES E-MAILS.** Le compte SMTP est la constante
 *      `COMPTE_SMTP` (`server/mail/client.ts`) parce que `GMAIL_APP_PASSWORD` y est lié. Ce
 *      champ pilote l'adresse **publiée** et le **destinataire** des notifications. Ne jamais
 *      « harmoniser » les deux : l'échec serait silencieux (voir l'en-tête de `client.ts`).
 */

/**
 * Nom lisible du champ derrière chaque contrainte de la table `site_setting`.
 *
 * ⚠️ TABLE PROPRE À CE DOMAINE, et c'est le point de l'extraction de `_commun.ts` : le
 * traducteur est partagé, sa table ne l'est pas.
 *
 * 🔴 LES SEPT NOMS SONT CEUX DE LA MIGRATION `0012`, VÉRIFIÉS DANS LE `.sql` GÉNÉRÉ **PUIS** DANS
 * `pg_get_constraintdef` SUR LA BASE. Une contrainte absente de cette table retombe sur un
 * message générique qui **ne nomme aucun champ** — c'est le défaut trouvé en revue de la 6.3, où
 * huit contraintes sur dix y tombaient.
 */
const CHAMP_PAR_CONTRAINTE: Record<string, string> = {
  site_setting_discord_url_valide: "l'adresse du Discord",
  site_setting_instagram_url_valide: "l'adresse d'Instagram",
  site_setting_x_url_valide: "l'adresse de X",
  site_setting_linkedin_url_valide: "l'adresse de LinkedIn",
  site_setting_helloasso_url_valide: "l'adresse HelloAsso",
  site_setting_contact_email_valide: "l'adresse e-mail de contact",
};

/**
 * Cas particuliers : contraintes dont le message ne se déduit PAS du nom d'un champ.
 *
 * `site_setting_ligne_unique` ne peut pas tirer depuis cet écran — il ne fait qu'un `UPDATE`
 * sans toucher `id`. Elle est nommée quand même : si elle tire un jour, c'est qu'un chemin
 * inattendu écrit dans cette table, et un message qui le DIT vaut mieux qu'un message générique
 * qui envoie chercher une faute de saisie inexistante.
 */
const CAS_PARTICULIERS: Record<string, string> = {
  site_setting_ligne_unique:
    "La table des réglages doit contenir exactement une ligne, et quelque chose a tenté d'en " +
    "changer l'identifiant. Ce n'est pas une erreur de saisie — prévenez la personne qui " +
    "s'occupe du site.",
};

/**
 * Enregistre les six réglages du site.
 *
 * ⚠️ **UN SEUL `UPDATE` POUR LES SIX CHAMPS**, et non six actions : ils sont saisis ensemble
 * dans un formulaire unique, et les écrire un par un ouvrirait une fenêtre où le site montrerait
 * un état que personne n'a validé.
 *
 * ⚠️ **PAS DE `where` SUR AUTRE CHOSE QUE `id = 1`.** Un `UPDATE` sans `where` marcherait
 * aujourd'hui (une seule ligne) et deviendrait faux le jour où quelqu'un contournerait le
 * `CHECK` — une clause explicite ne coûte rien et ne peut pas mentir.
 */
export async function enregistrerReglages(
  formData: FormData,
): Promise<ResultatAction<{ id: number }>> {
  // 🔴 PREMIÈRE LIGNE, TOUJOURS. Un matcher de proxy NE COUVRE PAS les Server Actions
  // (documentation Next 16, § Execution order, citée dans `server/auth/guard.ts`).
  await exigerRoleAction("admin_site");

  const analyse = siteSettingInputSchema.safeParse({
    discordUrl: formData.get("discordUrl"),
    instagramUrl: formData.get("instagramUrl"),
    xUrl: formData.get("xUrl"),
    linkedinUrl: formData.get("linkedinUrl"),
    helloassoUrl: formData.get("helloassoUrl"),
    contactEmail: formData.get("contactEmail"),
  });

  if (!analyse.success) {
    return {
      ok: false,
      error: analyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
      fieldErrors: erreursParChamp(analyse.error.issues),
    };
  }

  try {
    const lignes = await db
      .update(siteSetting)
      .set(analyse.data)
      .where(eq(siteSetting.id, 1))
      .returning({ id: siteSetting.id });

    // 🔴 CONTRE-ÉPREUVE : UN `UPDATE` QUI N'AFFECTE AUCUNE LIGNE RÉUSSIT.
    // Sans ce test, une table vide (migration non jouée, `DELETE` direct, restauration
    // partielle) rendrait « Enregistré » à un bénévole dont la saisie n'a été écrite nulle
    // part — et le site continuerait d'afficher l'état de repli du lecteur. Le succès se
    // déduit de l'EFFET, jamais de l'absence d'exception (`pieges/faux-succes.md`).
    if (lignes.length === 0) {
      console.error(
        "enregistrerReglages : UPDATE sur site_setting n'a affecté AUCUNE ligne. La table est " +
          "vide alors que la migration 0012 y insère une ligne.",
      );
      return {
        ok: false,
        error:
          "Les réglages n'ont pas pu être enregistrés : la ligne de réglages est introuvable " +
          "en base. Prévenez la personne qui s'occupe du site — rien de ce que vous avez tapé " +
          "n'est perdu, il est toujours à l'écran.",
      };
    }

    return { ok: true, data: { id: lignes[0]!.id } };
  } catch (erreur) {
    // Trace serveur : un `CHECK` qui tire signale soit un chemin qui contourne Zod, soit une
    // divergence entre les deux — les deux méritent d'être vues.
    console.error("enregistrerReglages", erreur);
    return { ok: false, error: traduireErreurBase(erreur, CHAMP_PAR_CONTRAINTE, CAS_PARTICULIERS) };
  }
}
