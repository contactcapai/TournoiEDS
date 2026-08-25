// `server-only` en TOUTE PREMIÈRE LIGNE : cette garde ne doit exister que côté serveur.
import "server-only";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { type RoleAdmin, detientRole } from "../../lib/roles";
import { db } from "../db/client";
import { account, userRole } from "../db/schema";
import { estAdminAutorise } from "./allowlist";
import { auth } from "./config";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 GARDE D'ACCÈS PAR RÔLE (Story 8.1, arbitrage A2)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Ce module remplace `requireAdmin()` / `lireAdmin()`, et leur SUPPRESSION est le geste
 * central de la story. Les conserver en leur faisant répondre « n'importe quel admin »
 * aurait laissé les 33 pages et les 48 Server Actions compiler sans broncher — en
 * continuant de tout donner à tout le monde. En les retirant, le typecheck refuse de passer
 * tant que chaque surface n'a pas NOMMÉ le rôle qu'elle exige. La porte, c'est le
 * compilateur, pas la mémoire de celui qui relit.
 *
 * DEUX FONCTIONS, PARCE QU'IL Y A DEUX SURFACES ET DEUX BONNES RÉPONSES :
 *   • `exigerRolePage`   — pages et layouts : REDIRIGE (un humain doit voir une page).
 *   • `exigerRoleAction` — Server Actions : LÈVE (un POST n'a pas d'écran à recevoir).
 *
 * ⚠️ La raison d'être de la garde d'action reste celle de la Story 6.1, citée de la doc
 * Next 16 : une Server Action est un POST sur la route où elle est utilisée, donc un
 * changement de matcher du proxy ou un simple déplacement de fichier peut lui retirer la
 * couverture du proxy SANS QU'AUCUNE PORTE NE LE DISE. La garde vit dans l'action.
 *
 * ⚠️ CE QUI N'EST TOUJOURS PAS CONCERNÉ : `submitSolicitation` (Story 5.1) est appelée
 * depuis une page PUBLIQUE. L'autorisation qui lui convient est *aucune*, et lui poser une
 * garde fermerait le formulaire de contact au public (FR28, FR32).
 */

/** Compte résolu et re-vérifié pour la requête en cours. */
export type CompteConnecte = {
  /** Identifiant local (table `user`). */
  utilisateurId: string;
  /** Rôles effectifs, noyau de secours compris. Vide = participant : n'ouvre rien. */
  roles: readonly RoleAdmin[];
  nom: string | null;
  image: string | null;
};

/** Levée quand une Server Action est atteinte sans le rôle qu'elle exige. */
export class ErreurAccesRole extends Error {
  // ⚠️ Champ déclaré puis affecté, et non une propriété de paramètre : le projet compile avec
  // `erasableSyntaxOnly`, qui interdit la forme courte (elle ÉMET du code, elle ne s'efface pas).
  readonly roleExige: RoleAdmin;

  constructor(roleExige: RoleAdmin, raison: string) {
    super(`Accès refusé (rôle « ${roleExige} » exigé) : ${raison}`);
    this.name = "ErreurAccesRole";
    this.roleExige = roleExige;
  }
}

/**
 * Les rôles d'un compte, lus EN BASE À CHAQUE REQUÊTE.
 *
 * 🔴 RELIRE À CHAQUE REQUÊTE N'EST PAS DE LA PARANOÏA — c'est la règle héritée de la 6.1, et
 * elle vaut davantage encore maintenant qu'un rôle se retire depuis un écran. Le porter dans
 * la session laisserait un droit révoqué survivre jusqu'à l'expiration : retirer un accès
 * doit prendre effet à la requête suivante, pas dans trente jours.
 */
export async function lireRolesDe(utilisateurId: string): Promise<RoleAdmin[]> {
  const lignes = await db
    .select({ role: userRole.role })
    .from(userRole)
    .where(eq(userRole.userId, utilisateurId));

  return lignes.map((ligne) => ligne.role);
}

/**
 * Résout le compte de la requête courante, ou `null` si personne n'est connecté.
 *
 * 🔴 NOYAU DE SECOURS. `AUTH_ADMIN_DISCORD_IDS` continue d'accorder `admin_site`, et ce
 * n'est pas un reste de l'ancien montage : l'écran d'attribution des accès peut se refermer
 * sur son dernier administrateur (erreur de manipulation, révocation croisée, base restaurée
 * d'une sauvegarde antérieure). Sans un chemin qui ne dépend PAS de la base, le seul recours
 * serait un accès SQL au serveur.
 * ⚠️ Il accorde `admin_site` SEUL, jamais les deux : il sert à REVENIR et à réattribuer
 * (l'écran des accès est une section du site), pas à gérer un tournoi. Un secours qui ouvre
 * plus que nécessaire cesse d'être un secours.
 */
export async function lireCompte(): Promise<CompteConnecte | null> {
  const sessionCourante = await auth();
  const utilisateurId = sessionCourante?.user?.id;

  if (typeof utilisateurId !== "string" || utilisateurId.length === 0) return null;

  const [rolesEnBase, identifiantDiscord] = await Promise.all([
    lireRolesDe(utilisateurId),
    lireIdentifiantDiscord(utilisateurId),
  ]);

  const roles = new Set<RoleAdmin>(rolesEnBase);
  if (estAdminAutorise(identifiantDiscord)) roles.add("admin_site");

  return {
    utilisateurId,
    roles: [...roles],
    nom: sessionCourante?.user?.name ?? null,
    image: sessionCourante?.user?.image ?? null,
  };
}

async function lireIdentifiantDiscord(utilisateurId: string): Promise<string | null> {
  const lignes = await db
    .select({ identifiant: account.providerAccountId })
    .from(account)
    .where(and(eq(account.userId, utilisateurId), eq(account.provider, "discord")))
    .limit(1);

  return lignes[0]?.identifiant ?? null;
}

/**
 * Exige un rôle depuis une PAGE ou un LAYOUT — redirige plutôt que de lever.
 *
 * 🔴 DEUX REFUS DIFFÉRENTS, DEUX DESTINATIONS DIFFÉRENTES, ET LES CONFONDRE FERAIT UNE
 * BOUCLE. « Pas connecté » se répare en se connectant (`/admin/login`). « Connecté mais sans
 * le rôle » ne se répare PAS en se reconnectant : renvoyer ce cas vers la page de login la
 * ferait renvoyer vers l'admin, qui renverrait vers le login. Il lui faut une page qui le
 * DISE — `/admin/refus`.
 *
 * ⚠️ À APPELER EN PREMIÈRE INSTRUCTION, AVANT TOUTE LECTURE DE DONNÉES : une page qui
 * composerait son écran puis redirigerait aurait déjà exécuté ses requêtes et, selon le
 * streaming, pu émettre du HTML. `gate:admin` mesure le HTML SERVI, précisément pour ça.
 */
export async function exigerRolePage(role: RoleAdmin): Promise<CompteConnecte> {
  const compte = await lireCompte();
  if (compte === null) redirect("/admin/login");
  if (!detientRole(compte.roles, role)) redirect(`/admin/refus?role=${role}`);
  return compte;
}

/**
 * Exige un rôle depuis une SERVER ACTION — **lève**, ne rend pas `false`.
 *
 * 🔴 Une garde qui rend un booléen dépend de son appelant pour le tester : l'oublier la rend
 * silencieusement inerte. Une exception ne s'oublie pas.
 */
export async function exigerRoleAction(role: RoleAdmin): Promise<CompteConnecte> {
  const compte = await lireCompte();
  if (compte === null) {
    throw new ErreurAccesRole(role, "session absente ou expirée");
  }
  if (!detientRole(compte.roles, role)) {
    throw new ErreurAccesRole(role, "le compte connecté ne porte pas ce rôle");
  }
  return compte;
}
