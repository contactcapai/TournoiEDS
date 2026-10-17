"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import { prerremplirPodium } from "@/server/actions/rencontres";
import actions from "@/styles/admin-actions.module.css";

/**
 * Pré-remplir le podium depuis les résultats — **et un humain valide** (correctif du 2026-08-15).
 *
 * 🔴 NÉ DU TOURNOI RÉEL DE BRICE : sa grande finale avait un vainqueur et le podium du tournoi
 * était **vide**, à retaper à la main sur un autre écran. Rien ne reliait ce que le moteur savait
 * à ce que le site publie.
 *
 * 🔴 `BoutonConfirmation` PARCE QUE ÇA **ÉCRASE** un podium déjà saisi. L'irréversibilité, pas la
 * destruction, est le critère de ce composant (doctrine 6.7) : un podium corrigé à la main que ce
 * bouton remplacerait en silence serait perdu sans un mot.
 *
 * ⚠️ Sur un tournoi publié et commencé, le podium écrit ici paraît AUSSITÔT sur la fiche publique
 * — d'où la phrase de confirmation, qui le dit.
 */
export function PodiumDeduit({
  tournoiId,
  podiumActuel,
}: {
  tournoiId: string;
  podiumActuel: { premier: string | null; deuxieme: string | null; troisieme: string | null };
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  const dejaSaisi =
    podiumActuel.premier !== null ||
    podiumActuel.deuxieme !== null ||
    podiumActuel.troisieme !== null;

  return (
    <div className={actions.bloc}>
      <BoutonConfirmation
        libelle="Pré-remplir le podium"
        question="Déduire le podium des résultats ?"
        precision={
          (dejaSaisi
            ? "⚠️ Un podium est DÉJÀ saisi sur ce tournoi : il sera remplacé. "
            : "Le podium de ce tournoi est vide. ") +
          "Il sera déduit de la dernière phase qui départage. Deux demi-finalistes sans petite " +
          "finale sont inscrits ensemble, 3ᵉ ex æquo ; toute autre place disputée reste VIDE. " +
          "Si le tournoi est publié et a commencé, ce podium paraît aussitôt sur sa fiche " +
          "publique. Vous pourrez tout corriger depuis la fiche du tournoi."
        }
        libelleConfirmation="Oui, pré-remplir"
        libelleEnCours="Calcul…"
        onConfirmer={async () => {
          const resultat = await prerremplirPodium(tournoiId);
          if (!resultat.ok) return { ok: false, error: resultat.error };

          const { premier, deuxieme, troisieme, phase } = resultat.data;
          setMessage(
            `Depuis « ${phase} » : 1ᵉʳ ${premier ?? "—"}, 2ᵉ ${deuxieme ?? "— (place disputée)"}, ` +
              `3ᵉ ${troisieme ?? "— (place disputée)"}. Corrigez depuis la fiche si besoin.`,
          );
          router.refresh();
          return { ok: true };
        }}
      />

      {message ? (
        <p className={actions.trace} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
