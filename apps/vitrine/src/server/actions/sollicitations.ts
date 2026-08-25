"use server";

import { eq } from "drizzle-orm";

import { exigerRoleAction } from "../auth/guard";
import { db } from "../db/client";
import { solicitation } from "../db/schema";
import { identifiant, messageErreurBase, type ResultatAction } from "./_commun";

/**
 * Server Actions de la boîte de réception des sollicitations (Story 6.11, FR36).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 NE PAS CONFONDRE AVEC `actions/solicitation.ts` — UN `l` ET UN `s` D'ÉCART
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 *   · `actions/solicitation.ts`  → **PUBLIQUE, NON AUTHENTIFIÉE** (Story 5.1). Un seul export,
 *     `submitSolicitation`, appelé par le formulaire de `/partenaires`. Sa garde n'est PAS une
 *     session : c'est un rate-limit, un honeypot et Zod.
 *   · `actions/sollicitations.ts` → **CE FICHIER. ADMIN.** `await exigerRoleAction("admin_site")` est la
 *     PREMIÈRE LIGNE DE CHAQUE EXPORT, sans exception.
 *
 * Un import qui se trompe de module **compile**, passe le lint et passe le typecheck. D'où ce
 * bandeau dans les deux fichiers, et d'où la garde ⑧ de `gate:sollicitations`, qui vérifie
 * mécaniquement que tout export d'ici commence par `exigerRoleAction("admin_site")`. **Ne jamais fusionner les
 * deux fichiers** : un module mixte rendrait cette garde impossible à écrire.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE MODULE N'ÉCRIT AUCUN TEXTE — DEUX ÉCRITURES, ET PAS UNE DE PLUS
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `UPDATE … SET is_processed` et `DELETE`. Le nom, l'e-mail, le type et le message sont saisis
 * par un **visiteur** : les rendre modifiables serait falsifier une demande reçue. C'est
 * pourquoi il n'y a ici **aucun schéma Zod de saisie** — `identifiant` (un `z.uuid()`) et un
 * booléen suffisent — et pourquoi `lib/schemas/solicitation.ts` n'est pas touché (il est
 * **bundlé côté client** par `SolicitationForm`, il porte `HONEYPOT_FIELD`).
 *
 * ⚠️ AUCUNE TABLE `CHAMP_PAR_CONTRAINTE`, ET C'EST UN FAIT, PAS UN OUBLI. Les quatre `CHECK`
 * de `solicitation` portent sur `name`, `email`, `message` et `consent_given` — **aucune de
 * ces colonnes n'est écrite ici**, et un `DELETE` ne viole pas un `CHECK`. Une table de
 * traduction vide serait du décor ; `messageErreurBase` est appelée sans elle, avec son
 * message générique, qui est le bon.
 *
 * Patron : `agenda.ts` (6.3), `galerie.ts` (6.4), `partenaires.ts` (6.5), `ateliers.ts` (6.9),
 * `membres.ts` (6.10) — retour discriminé `ResultatAction<T>`, `identifiant` validé sur tout
 * `id` reçu, aucun `revalidateTag` (mesuré : le projet n'a aucun cache applicatif, et cette
 * story ne touche **aucune** page publique — il n'y a rien à invalider).
 */

/**
 * Marque une demande « traitée », ou la remet « à traiter » — **le geste nominal de l'écran**.
 *
 * 🔴 RÉVERSIBLE DANS LES DEUX SENS, ET CE N'EST PAS UN CONFORT. Sans le retour arrière, le
 * seul geste de correction disponible après un clic trop rapide serait la **suppression
 * définitive** d'une donnée personnelle de tiers. Un geste réversible existe précisément pour
 * que l'irréversible reste rare.
 *
 * ⚠️ Marquer traitée **ne supprime rien** : c'est tout l'objet de FR36 — *« aucune
 * sollicitation ne se perd quand une boîte mail change de main »*. C'est l'archivage.
 *
 * ⚠️ `updated_at` bouge, par construction (`$onUpdate` du schéma) : c'est la date du
 * traitement. Les **cinq colonnes de contenu** (`name`, `email`, `request_type`, `message`,
 * `consent_given`), elles, sont intactes — garde ② de `gate:sollicitations`, qui les relit
 * avant et après.
 */
export async function definirTraitementSollicitation(
  id: string,
  traitee: boolean,
): Promise<ResultatAction<{ id: string }>> {
  await exigerRoleAction("admin_site");

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .update(solicitation)
      .set({ isProcessed: traitee })
      .where(eq(solicitation.id, id))
      .returning({ id: solicitation.id });

    if (!ligne) return { ok: false, error: "Cette demande n'existe plus." };
    return { ok: true, data: { id: ligne.id } };
  } catch (erreur) {
    console.error("[definirTraitementSollicitation] Échec de l'écriture :", erreur);
    return { ok: false, error: messageErreurBase(erreur, {}) };
  }
}

/**
 * Supprime définitivement une demande.
 *
 * 🔴 CE N'EST PAS DU MÉNAGE, C'EST LE **DROIT À L'EFFACEMENT** (RGPD, NFR5). Une demande porte
 * le nom, l'adresse e-mail et le message libre d'un **tiers** qui n'a consenti qu'à recevoir
 * une réponse (`lib/schemas/solicitation.ts`). Quand la réponse est faite, la conserver
 * indéfiniment n'a plus de base.
 *
 * ⚠️ IL N'Y A PAS DE CORBEILLE. C'est l'écran qui doit le dire — la confirmation de
 * `SollicitationActions` porte les trois faits, dont celui que personne ne devine : **la copie
 * reçue par e-mail, s'il y en a eu une, reste dans la boîte de l'association**. Supprimer ici
 * n'est un effacement complet que si la boîte est nettoyée aussi.
 *
 * ⚠️ Aucun fichier à détruire, contrairement à `supprimerMembre` (6.10) et `supprimerPhoto`
 * (6.4) : une sollicitation n'a aucun média. Rien à séquencer entre la ligne et le disque.
 *
 * ⚠️ Aucune clé étrangère ne référence `solicitation` : rien ne s'oppose à ce `DELETE`.
 */
export async function supprimerSollicitation(id: string): Promise<ResultatAction<undefined>> {
  await exigerRoleAction("admin_site");

  if (!identifiant.safeParse(id).success) {
    return { ok: false, error: "Cet identifiant n'est pas valide. Rechargez la page." };
  }

  try {
    const [ligne] = await db
      .delete(solicitation)
      .where(eq(solicitation.id, id))
      .returning({ id: solicitation.id });

    if (!ligne) return { ok: false, error: "Cette demande a déjà été supprimée." };
    return { ok: true, data: undefined };
  } catch (erreur) {
    console.error("[supprimerSollicitation] Échec de la suppression :", erreur);
    return { ok: false, error: messageErreurBase(erreur, {}) };
  }
}

// `"use server"` n'autorise que l'export de fonctions asynchrones : une constante exportée ici
// casserait le `build` (et pas le typecheck) — leçon `actions/membres.ts`.
