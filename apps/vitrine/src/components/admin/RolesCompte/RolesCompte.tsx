"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ROLES_ADMIN, type RoleAdmin, LIBELLE_ROLE, detientRole } from "@/lib/roles";
import { accorderRole, retirerRole } from "@/server/actions/acces";
import styles from "@/styles/admin-actions.module.css";

/**
 * Les rôles d'un compte, cochables (Story 8.1). Patron d'`EventActions` (6.3) et
 * `MembreActions` (6.10) : `useTransition`, retour discriminé, `router.refresh()`.
 *
 * 🔴 UNE BASCULE PAR RÔLE, JAMAIS UNE LISTE DÉROULANTE « participant / admin site / admin
 * tournoi ». Les rôles se CUMULENT (arbitrage A2, séparation stricte) : un choix unique
 * obligerait à inventer une valeur « les deux », donc trois entrées pour deux faits, qui
 * divergeraient au troisième rôle.
 *
 * ⚠️ LE REFUS VIENT DU SERVEUR, ET C'EST VOULU. Les deux gardes anti-verrouillage (dernier
 * administrateur du site, retrait de son propre accès) ne sont PAS rejouées ici : une règle
 * écrite des deux côtés diverge en silence, et seule celle du serveur protège quoi que ce
 * soit. L'écran se contente d'AFFICHER le message qu'elle renvoie.
 */
export function RolesCompte({
  utilisateurId,
  roles,
  designation,
}: {
  utilisateurId: string;
  roles: readonly RoleAdmin[];
  /** Nom du compte, pour que les libellés lus par un lecteur d'écran désignent QUI. */
  designation: string;
}) {
  const router = useRouter();
  const [enTransition, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function basculer(role: RoleAdmin, detenu: boolean) {
    demarrer(async () => {
      setErreur(null);
      try {
        const resultat = detenu
          ? await retirerRole(utilisateurId, role)
          : await accorderRole(utilisateurId, role);
        if (!resultat.ok) {
          setErreur(resultat.error);
          return;
        }
        router.refresh();
      } catch {
        // `exigerRoleAction()` LÈVE avant le `try` de la Server Action : la révocation
        // immédiate arrive ici, et nulle part ailleurs (leçon 6.3).
        setErreur("Votre session n'est plus valide. Rechargez la page et reconnectez-vous.");
      }
    });
  }

  return (
    <div className={styles.bloc}>
      {/* ⚠️ `.groupe` ne DÉCLARE pas `flex-wrap` — il hérite du défaut CSS, qui est
          `nowrap`, et c'est ce qu'il faut ici. Ne pas y « ajouter » `wrap` : le min-content
          d'une rangée de contrôles y vaut alors UN contrôle, et une colonne voisine
          gourmande empile le reste EN SILENCE (mesuré deux fois, 2026-08-15 puis 13.1). */}
      <div className={styles.groupe}>
        {ROLES_ADMIN.map((role) => {
          const detenu = detientRole(roles, role);
          return (
            <button
              key={role}
              type="button"
              className={detenu ? styles.basculePubliee : styles.bascule}
              onClick={() => basculer(role, detenu)}
              disabled={enTransition}
              aria-pressed={detenu}
            >
              {/* Le MOT dit l'état, la couleur ne fait que le redoubler (AA). */}
              {detenu ? "✓ " : ""}
              {LIBELLE_ROLE[role]}
              <span className="sr-only">
                {detenu ? " — retirer ce rôle à " : " — donner ce rôle à "}
                {designation}
              </span>
            </button>
          );
        })}
      </div>

      {erreur !== null && (
        <p className={styles.erreur} role="alert">
          {erreur}
        </p>
      )}
    </div>
  );
}
