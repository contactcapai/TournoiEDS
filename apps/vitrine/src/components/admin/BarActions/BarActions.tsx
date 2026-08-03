"use client";

import { useRouter } from "next/navigation";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import { supprimerBar } from "@/server/actions/agenda";

/**
 * Suppression d'un bar du roulement (Story 6.3).
 *
 * 🔴 CETTE SUPPRESSION PEUT LÉGITIMEMENT ÉCHOUER, ET LE MESSAGE EST LE LIVRABLE.
 * `event.barId` est `ON DELETE SET NULL` — jamais `CASCADE` —, mais le passage à `NULL`
 * ré-évalue `event_has_venue` : un événement rattaché à ce bar **sans lieu libre** viole
 * alors la contrainte et Postgres refuse. C'est le bon comportement ; c'est son message
 * brut qui ne l'est pas. `supprimerBar` compte les bloquants et rend une phrase qui dit
 * combien et quoi faire — `BoutonConfirmation` l'affiche et la CONSERVE après refermeture
 * du panneau, pour que le refus ne passe pas inaperçu.
 */
export interface BarActionsProps {
  id: string;
  nom: string;
}

export function BarActions({ id, nom }: BarActionsProps) {
  const router = useRouter();

  return (
    <BoutonConfirmation
      libelle="Supprimer"
      question={`Supprimer le bar « ${nom} » ?`}
      precision="Les événements qui s'y sont tenus sont conservés — ils perdent seulement le rattachement au bar."
      onConfirmer={async () => {
        const resultat = await supprimerBar(id);
        if (resultat.ok) router.refresh();
        return resultat.ok ? { ok: true } : { ok: false, error: resultat.error };
      }}
    />
  );
}
