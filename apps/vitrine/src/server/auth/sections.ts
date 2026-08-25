import type { RoleAdmin } from "../../lib/roles";
import { SECTIONS_ADMIN } from "../../app/admin/_sections";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CHEMIN → EXIGENCE D'ACCÈS (Story 8.1) — DÉRIVÉE DU REGISTRE, JAMAIS RECOPIÉE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CE FICHIER NE CONTIENT AUCUNE LISTE DE CHEMINS. Il lit `SECTIONS_ADMIN`, la même
 * source que la navigation du back-office. Une table de chemins écrite ici serait une COPIE
 * de son sujet : fidèle le jour où on l'écrit, fausse au premier renommage, et verte
 * pendant tout ce temps (`00 référence/pieges/garde-sur-une-copie.md`, forme n°3 —
 * « l'instrument qui recopie les constantes qu'il devrait lire »).
 *
 * 🔴 ET IL EST FAIL-CLOSED. Un chemin sous `/admin` qu'aucune section ne couvre rend
 * `inconnu`, que les appelants traitent comme un refus. C'est ce qui protège la story
 * SUIVANTE : une page ajoutée sous `/admin/quelquechose` sans entrée au registre est
 * fermée, au lieu d'être ouverte à tous par omission. Une garde de rôle oubliée cesse
 * d'être silencieuse — elle devient une porte close, ce qui se voit.
 */
export type ExigenceAcces =
  /** Aucune session requise. Une seule route : la page de connexion. */
  | { type: "ouvert" }
  /** Une session suffit, sans rôle : le tableau de bord et la page de refus. */
  | { type: "connecte" }
  | { type: "role"; role: RoleAdmin }
  /** Sous `/admin`, mais rattaché à aucune section : refusé. */
  | { type: "inconnu" };

/** La page de connexion — la seule route de `/admin` qui doit rester ouverte. */
export const CHEMIN_LOGIN = "/admin/login";

/**
 * Routes ouvertes à tout compte connecté, rôle ou non.
 *
 * ⚠️ `/admin/refus` EN FAIT PARTIE, ET C'EST INDISPENSABLE : c'est là qu'atterrit un compte
 * sans le bon rôle. L'exiger d'un rôle l'y renverrait en boucle.
 * ⚠️ `/admin` (le tableau de bord) aussi : il n'affiche que les sections que le compte peut
 * atteindre, donc rien pour un participant — mais il doit pouvoir DIRE qu'il n'y a rien,
 * plutôt que refuser sans expliquer.
 */
const CHEMINS_CONNECTE = ["/admin", "/admin/refus"] as const;

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LE COMPLÉMENT DU REGISTRE — CE QUI EST SOUS `/admin` SANS ÊTRE UNE SECTION
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `SECTIONS_ADMIN` décrit ce qui est NAVIGABLE : une entrée y vaut une ligne de menu. Les
 * routes ci-dessous n'ont rien à faire dans un menu — ce sont des Route Handlers qui
 * SERVENT DES FICHIERS. Elles ont pourtant besoin d'un rôle, et le fail-closed du proxy les
 * fermerait sans ça (c'est d'ailleurs comme ça qu'elles ont été trouvées, plutôt que par
 * une relecture).
 *
 * ⚠️ Ce n'est pas une copie du registre mais son COMPLÉMENT : aucune de ces routes n'y
 * figure, et aucune section n'a de fichier à servir. Les deux ensembles sont disjoints par
 * construction — le test `sections.test.ts` le vérifie.
 *
 * ⚠️ `admin_site` et non `admin_tournoi` : mesuré le 2026-08-25, les seuls consommateurs
 * sont la galerie, les partenaires et les membres. L'aperçu d'un tournoi, lui, passe par la
 * route PUBLIQUE `/medias/[filename]` — un admin tournoi n'a donc aucun besoin de celle-ci.
 */
const ROUTES_HORS_NAVIGATION: readonly { prefixe: string; role: RoleAdmin }[] = [
  { prefixe: "/admin/medias", role: "admin_site" },
];

function couvre(chemin: string, prefixe: string): boolean {
  return chemin === prefixe || chemin.startsWith(`${prefixe}/`);
}

export function exigencePour(chemin: string): ExigenceAcces {
  if (chemin === CHEMIN_LOGIN) return { type: "ouvert" };
  if (CHEMINS_CONNECTE.some((ouvert) => chemin === ouvert)) return { type: "connecte" };

  // La section la PLUS LONGUE l'emporte : `/admin/agenda/bars` doit se rattacher à
  // `/admin/agenda` et non à un éventuel préfixe plus court ajouté un jour.
  const horsNavigation = ROUTES_HORS_NAVIGATION.find((candidate) =>
    couvre(chemin, candidate.prefixe),
  );
  if (horsNavigation) return { type: "role", role: horsNavigation.role };

  const section = [...SECTIONS_ADMIN]
    .sort((a, b) => b.href.length - a.href.length)
    .find((candidate) => couvre(chemin, candidate.href));

  if (section) return { type: "role", role: section.role };

  return { type: "inconnu" };
}
