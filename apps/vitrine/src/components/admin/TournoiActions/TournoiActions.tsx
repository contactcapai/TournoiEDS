"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import { definirPublicationTournoi, supprimerTournoi } from "@/server/actions/tournois";
import styles from "@/styles/admin-actions.module.css";

/**
 * Actions d'une ligne de tournoi : publier / retirer du site, supprimer (Story 9.1).
 * Patron d'`EventActions` (6.3), `PhotoActions` (6.4), `PartenaireActions` (6.5),
 * `AtelierActions` (6.9).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 **AUCUNE COMMANDE D'ORDRE**, ET CE N'EST PAS UN OUBLI
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Les quatre écrans cités ci-dessus portent des flèches « monter / descendre » parce que leur
 * contenu a un **ordre manuel** (`sort_order`). Un tournoi, lui, est ordonné par sa **DATE** —
 * il n'a pas de colonne de rang, et il ne doit pas en avoir : un classement manuel de tournois
 * divergerait de la chronologie au premier décalage de date, et « à venir / passés » se
 * **dérive** précisément pour ne dépendre d'aucune saisie (note d'architecture §6 ①).
 * ⇒ Ni `reordonner…`, ni `useTransition` sur un ordre, ni **concurrence optimiste** : il n'y a
 * aucun ordre à écraser. Importer ce mécanisme « par symétrie » ajouterait un garde-fou qui ne
 * protège rien, et laisserait croire qu'un rang existe quelque part.
 *
 * 🔴 ET LA CONFIRMATION DIT CE QUE LA SUPPRESSION FAIT VRAIMENT. Ici : détruire la ligne, son
 * podium et son adresse publique — rien d'autre. Pas de fichier détruit (contrairement à la
 * galerie et aux partenaires), pas de contenu rattaché conservé (contrairement à l'agenda).
 * L'événement d'agenda, lui, **survit** : c'est lui qui porte le tournoi, pas l'inverse.
 * Une différence de comportement entre deux écrans du même back-office doit être ÉCRITE, pas
 * déduite.
 */

export interface TournoiActionsProps {
  id: string;
  nom: string;
  isPublished: boolean;
}

export function TournoiActions({ id, nom, isPublished }: TournoiActionsProps) {
  const router = useRouter();
  const [enTransition, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div className={styles.bloc}>
      <button
        type="button"
        className={isPublished ? styles.basculePubliee : styles.bascule}
        onClick={() =>
          demarrer(async () => {
            setErreur(null);
            try {
              const resultat = await definirPublicationTournoi(id, !isPublished);
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
      >
        {enTransition ? "…" : isPublished ? "Retirer du site" : "Publier"}
        <span className="sr-only"> — {nom}</span>
      </button>

      <BoutonConfirmation
        libelle="Supprimer"
        question={`Supprimer définitivement « ${nom} » ?`}
        precision={
          "Le tournoi disparaît de cet écran, définitivement — avec son déroulé annoncé, ses " +
          "lots, son podium et son adresse. L'événement d'agenda auquel il est rattaché, lui, " +
          "n'est pas touché. " +
          "Si vous voulez seulement qu'il cesse de paraître, utilisez « Retirer du site » : " +
          "la fiche est conservée et se republie en un clic — et c'est aussi ce qui vous " +
          "rend le droit de changer son adresse."
        }
        onConfirmer={async () => {
          const resultat = await supprimerTournoi(id);
          if (resultat.ok) router.refresh();
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
