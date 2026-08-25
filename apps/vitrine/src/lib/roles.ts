/**
 * Vocabulaire des rôles (Story 8.1, arbitrage A2 : « quelqu'un qui peut gérer le tournoi ne
 * doit pas avoir accès à la modification du site »).
 *
 * 🔴 `participant` N'EST PAS ICI, ET CE N'EST PAS UN OUBLI. Tout compte connecté l'est par
 * construction : une valeur stockée « participant » ne porterait aucune décision, et
 * créerait une seconde vérité à tenir d'accord avec l'absence de rôle. Un participant est
 * donc un compte SANS aucun rôle de cette liste — voir `estParticipant` plus bas.
 *
 * ⚠️ Module PUR (aucun import serveur) : il est lu par le proxy, par les pages, par le
 * registre des sections ET par le formulaire client d'attribution des accès.
 */

/** Les rôles qui ouvrent une porte. Ordre d'affichage dans l'écran des accès. */
export const ROLES_ADMIN = ["admin_site", "admin_tournoi"] as const;

export type RoleAdmin = (typeof ROLES_ADMIN)[number];

/** Ce que le rôle donne, dit à celui qui l'attribue — pas du jargon technique. */
export const LIBELLE_ROLE: Record<RoleAdmin, string> = {
  admin_site: "Administration du site",
  admin_tournoi: "Administration des tournois",
};

export const DESCRIPTION_ROLE: Record<RoleAdmin, string> = {
  admin_site:
    "Agenda, galerie, partenaires, ateliers, membres, sollicitations, réglages et accès. " +
    "N'ouvre PAS les tournois.",
  admin_tournoi:
    "Les tournois : composition, engagés, phases, jour J. " +
    "N'ouvre AUCUNE autre section du back-office.",
};

/**
 * 🔴 SÉPARATION STRICTE (arbitrage de Brice, 2026-08-25) : `admin_site` n'est PAS un
 * sur-ensemble d'`admin_tournoi`. Qui doit tout atteindre porte LES DEUX rôles, et c'est
 * visible à l'écran des accès plutôt que caché dans une hiérarchie implicite.
 */
export function detientRole(roles: readonly RoleAdmin[], exige: RoleAdmin): boolean {
  return roles.includes(exige);
}

/** Un compte connecté sans aucun rôle : il existe, il n'ouvre rien du back-office. */
export function estParticipant(roles: readonly RoleAdmin[]): boolean {
  return roles.length === 0;
}

export function estRoleAdmin(valeur: unknown): valeur is RoleAdmin {
  return typeof valeur === "string" && (ROLES_ADMIN as readonly string[]).includes(valeur);
}
