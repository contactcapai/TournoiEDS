import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "../client";
import { account, user, userProfile } from "../schema";

/**
 * Le profil d'un compte, et les moyens par lesquels il se connecte (Story 12.1).
 *
 * ⚠️ **DEUX LECTURES, PARCE QUE CE SONT DEUX NATURES.** Le profil est **déclaré** par la personne ;
 * les moyens de connexion sont **constatés** — ils viennent d'`account`, la table d'Auth.js, et
 * rien dans l'écran ne les invente. Les fondre laisserait croire qu'on peut saisir un compte lié.
 *
 * ⚠️ **LE LIEN MAGIQUE N'A PAS DE LIGNE DANS `account`**, et c'est le contrat d'Auth.js : seuls
 * les fournisseurs OAuth y figurent. Quelqu'un qui n'utilise QUE le lien magique n'a donc aucun
 * moyen listé — l'écran doit le dire au lieu d'afficher une liste vide qui ressemble à une panne.
 * C'est `emailVerified` qui atteste qu'un lien magique a servi.
 */
export async function lireProfilComplet(utilisateurId: string) {
  const [compte] = await db
    .select({
      email: user.email,
      emailVerifie: user.emailVerified,
      nomFournisseur: user.name,
      image: user.image,
    })
    .from(user)
    .where(eq(user.id, utilisateurId))
    .limit(1);

  if (!compte) return null;

  const [profil] = await db
    .select({
      pseudo: userProfile.pseudo,
      discordPseudo: userProfile.discordPseudo,
      riotId: userProfile.riotId,
      steamId: userProfile.steamId,
      epicId: userProfile.epicId,
    })
    .from(userProfile)
    .where(eq(userProfile.userId, utilisateurId))
    .limit(1);

  const moyens = await db
    .select({ provider: account.provider })
    .from(account)
    .where(eq(account.userId, utilisateurId))
    .orderBy(asc(account.provider));

  return {
    compte,
    // ⚠️ Un compte sans ligne de profil n'est pas une anomalie : c'est l'état de départ. On rend
    // un profil VIDE plutôt que `null`, pour que l'écran n'ait pas deux cas à distinguer.
    profil: profil ?? {
      pseudo: null,
      discordPseudo: null,
      riotId: null,
      steamId: null,
      epicId: null,
    },
    moyens: moyens.map((ligne) => ligne.provider),
  };
}

export type ProfilComplet = NonNullable<Awaited<ReturnType<typeof lireProfilComplet>>>;
