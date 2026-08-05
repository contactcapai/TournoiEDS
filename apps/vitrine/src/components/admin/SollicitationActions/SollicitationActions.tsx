"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import {
  definirTraitementSollicitation,
  supprimerSollicitation,
} from "@/server/actions/sollicitations";
import styles from "@/styles/admin-actions.module.css";

/**
 * Actions d'une demande : marquer traitée / remettre à traiter, supprimer (Story 6.11).
 * Patron d'`EventActions` (6.3), `PhotoActions` (6.4), `PartenaireActions` (6.5),
 * `AtelierActions` (6.9) et `MembreActions` (6.10).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE COMPOSANT N'A **AUCUNE COMMANDE D'ORDRE** — et c'est la 1ʳᵉ fois de l'epic
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Les cinq autres écrans portent des flèches monter/descendre : leur ordre est un choix
 * éditorial. Ici l'ordre est **chronologique** — il appartient aux faits, pas au bénévole. Ne
 * pas ajouter `reordonner…` par symétrie : il n'y a pas de colonne `sort_order` sur cette
 * table, et il ne doit pas y en avoir.
 * ⚠️ Corollaire : la dette **R39** (fenêtre de concurrence des réordonnancements) ne concerne
 * pas cet écran. Elle reste routée vers la rétro de l'Epic 6.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 « MARQUER TRAITÉE » ET « SUPPRIMER » SONT DEUX GESTES QUE TOUT OPPOSE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Le geste NOMINAL est de **marquer traitée** : la demande reste, avec son message et sa date.
 * C'est tout l'objet de FR36 — *« aucune sollicitation ne se perd quand une boîte mail change
 * de main »*. La suppression, elle, est **définitive et sans corbeille**.
 *
 * D'où deux libellés qui ne se ressemblent pas, et une confirmation qui dit ce que la
 * suppression fait VRAIMENT — y compris le fait que personne ne devine : **la copie reçue par
 * e-mail, s'il y en a eu une, reste dans la boîte de l'association**. Supprimer ici n'est un
 * effacement complet au sens du RGPD (NFR5) que si la boîte est nettoyée aussi.
 */

export interface SollicitationActionsProps {
  id: string;
  expediteur: string;
  /** Date de réception déjà formatée (jour + heure + minute) — voir `redirigerVers`. */
  recuLe: string;
  isProcessed: boolean;
  /**
   * Où aller après une **suppression**. Absent ⇒ on rafraîchit sur place (la liste).
   *
   * 🔴 SUR L'ÉCRAN DE DÉTAIL, RAFRAÎCHIR NE SUFFIT PAS : la demande qu'on vient de supprimer
   * est l'objet même de la page. Un `router.refresh()` y rejouerait une requête sur un
   * identifiant qui n'existe plus et rendrait un 404 — techniquement juste, et illisible pour
   * quelqu'un qui vient de cliquer « Supprimer ».
   * ⚠️ Une chaîne et non une fonction : un composant serveur ne peut pas passer de callback.
   */
  redirigerVers?: string;
}

export function SollicitationActions({
  id,
  expediteur,
  recuLe,
  isProcessed,
  redirigerVers,
}: SollicitationActionsProps) {
  const router = useRouter();
  const [enTransition, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  // ⚠️ Le nom accessible porte l'expéditeur ET la date à la minute. C'est la dette **R31** :
  // un double-clic sur le formulaire public écrit deux lignes du même expéditeur, à quelques
  // secondes d'écart. « Supprimer — Mairie de Reims » serait alors ambigu pour un lecteur
  // d'écran, sur l'écran même dont le travail est de distinguer ces deux lignes.
  const designation = `${expediteur} — ${recuLe}`;

  return (
    <div className={styles.bloc}>
      <button
        type="button"
        className={isProcessed ? styles.basculePubliee : styles.bascule}
        onClick={() =>
          demarrer(async () => {
            setErreur(null);
            try {
              const resultat = await definirTraitementSollicitation(id, !isProcessed);
              if (!resultat.ok) {
                setErreur(resultat.error);
                return;
              }
              router.refresh();
            } catch {
              // `requireAdmin()` LÈVE avant le `try` de la Server Action : la révocation
              // immédiate arrive ici, et nulle part ailleurs (leçon 6.3).
              setErreur("Votre session n'est plus valide. Rechargez la page et reconnectez-vous.");
            }
          })
        }
        disabled={enTransition}
      >
        {enTransition ? "…" : isProcessed ? "Remettre à traiter" : "Marquer traitée"}
        <span className="sr-only"> — {designation}</span>
      </button>

      <BoutonConfirmation
        libelle="Supprimer"
        question={`Supprimer définitivement la demande de « ${expediteur} » ?`}
        precision={
          "Le message, le nom et l'adresse e-mail disparaissent de cet écran et de la base, " +
          "définitivement. Il n'y a pas de corbeille. " +
          "Si vous voulez seulement signaler que vous y avez répondu, utilisez " +
          "« Marquer traitée » : la demande est conservée et reste consultable. " +
          "⚠️ Si une notification par e-mail a été envoyée à l'association, sa copie reste " +
          "dans la boîte mail : pour un effacement complet, il faut l'y supprimer aussi."
        }
        onConfirmer={async () => {
          const resultat = await supprimerSollicitation(id);
          if (resultat.ok) {
            if (redirigerVers) router.push(redirigerVers);
            else router.refresh();
          }
          return resultat.ok ? { ok: true } : { ok: false, error: resultat.error };
        }}
      />

      {erreur ? (
        <p className={styles.erreur} role="alert">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
