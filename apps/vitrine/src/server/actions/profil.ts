"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { profilSaisi } from "../../lib/schemas/profil";
import { exigerConnexionAction } from "../auth/guard";
import { db } from "../db/client";
import { user, userProfile } from "../db/schema";
import type { ResultatAction } from "./_commun";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LES ACTIONS DU PROFIL (Story 12.1)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **`exigerConnexionAction()` ET NON `exigerRoleAction()`** — c'est tout l'objet de cette
 * story : un **participant n'a aucun rôle**, et lui en demander un lui fermerait sa propre page.
 * ⚠️ La garde reste **dans l'action**, comme partout ailleurs (doctrine 6.1) : une Server Action
 * est un POST sur la route où elle est utilisée, donc un déplacement de fichier peut lui retirer
 * la couverture du proxy **sans qu'aucune porte ne le dise**.
 *
 * 🔴 **AUCUNE DE CES DEUX ACTIONS NE PREND D'IDENTIFIANT DE COMPTE**, et c'est une garde, pas une
 * commodité : elles agissent sur le compte **de la session**. Accepter un `userId` en paramètre
 * ouvrirait la modification — et la suppression — du profil de n'importe qui à un POST fabriqué.
 */

/** Enregistre le profil déclaré. Crée la ligne au premier enregistrement. */
export async function enregistrerProfil(donnees: FormData): Promise<ResultatAction<null>> {
  const compte = await exigerConnexionAction();

  const analyse = profilSaisi.safeParse({
    pseudo: donnees.get("pseudo") ?? "",
    discordPseudo: donnees.get("discordPseudo") ?? "",
    riotId: donnees.get("riotId") ?? "",
    steamId: donnees.get("steamId") ?? "",
    epicId: donnees.get("epicId") ?? "",
  });
  if (!analyse.success) {
    return { ok: false, error: analyse.error.issues[0]?.message ?? "Vérifiez votre saisie." };
  }

  /**
   * ⚠️ `?? null` SUR CHAQUE CHAMP, ET C'EST LE POINT. Le schéma rend `undefined` pour un champ
   * vidé ; passer `undefined` à Drizzle **omet la colonne**, donc l'ancienne valeur RESTERAIT.
   * Vider un champ n'aurait alors aucun effet — un défaut parfaitement muet, l'écran affichant
   * toujours l'ancienne valeur après un enregistrement « réussi ».
   */
  const valeurs = {
    pseudo: analyse.data.pseudo ?? null,
    discordPseudo: analyse.data.discordPseudo ?? null,
    riotId: analyse.data.riotId ?? null,
    steamId: analyse.data.steamId ?? null,
    epicId: analyse.data.epicId ?? null,
    updatedAt: new Date(),
  };

  await db
    .insert(userProfile)
    .values({ userId: compte.utilisateurId, ...valeurs })
    .onConflictDoUpdate({ target: userProfile.userId, set: valeurs });

  revalidatePath("/profil");
  return { ok: true, data: null };
}

/**
 * Supprime le compte — **RGPD**.
 *
 * 🔴 **ELLE DÉLIE, ELLE N'EFFACE PAS LES RÉSULTATS** (arbitrage de Brice, 2026-08-25). Les
 * inscriptions redeviennent **non réclamées** et le classement publié ne bouge pas : le réécrire
 * effacerait les parties où ses adversaires l'ont battu — la raison même pour laquelle un
 * abandon garde ses points (dette R60).
 * ⚠️ Aujourd'hui `tournament_entry` n'a **encore aucun lien vers `user`** : la déliaison est donc
 * portée par le `ON DELETE SET NULL` que la seconde PR de cette story posera. Rien à faire ici —
 * et surtout **pas** un `DELETE` sur les inscriptions « en attendant ».
 *
 * ⚠️ **LE RESTE PART PAR CASCADE, ET C'EST LA BASE QUI LE TIENT** : `account`, `session`,
 * `user_role` et `user_profile` référencent tous `user` en `cascade`. Les supprimer un par un ici
 * dupliquerait une règle que le schéma porte déjà, et le jour où une table s'ajoute, c'est la
 * cascade qui serait juste et ce code qui serait faux.
 */
export async function supprimerMonCompte(): Promise<ResultatAction<null>> {
  const compte = await exigerConnexionAction();

  await db.delete(user).where(eq(user.id, compte.utilisateurId));

  // ⚠️ La session vit dans un cookie signé : la ligne `session` est partie, mais le cookie reste
  // jusqu'à la déconnexion. C'est l'écran qui appelle `signOut()` juste après — une Server Action
  // ne peut pas écrire les en-têtes d'une réponse qu'elle ne rend pas.
  return { ok: true, data: null };
}
