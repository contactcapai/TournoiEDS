"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import { definirPublicationEvenement, supprimerEvenement } from "@/server/actions/agenda";
import styles from "./EventActions.module.css";

/**
 * Actions d'une ligne de la liste d'agenda : publier / dépublier, et supprimer (Story 6.3).
 *
 * 🔴 « DÉPUBLIER » ET « SUPPRIMER » SONT VISUELLEMENT DISTINCTS, ET C'EST UNE GARDE.
 * L'un est réversible en un clic, l'autre ne l'est pas. Les rendre semblables ferait
 * hésiter sur le premier et cliquer trop vite sur le second.
 *
 * La bascule de publication est une action à part entière — elle ne rouvre pas le
 * formulaire. Publier depuis la liste ne doit jamais risquer de réécrire des champs que
 * personne n'a touchés.
 */
export interface EventActionsProps {
  id: string;
  isPublished: boolean;
  titre: string;
}

export function EventActions({ id, isPublished, titre }: EventActionsProps) {
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
              const resultat = await definirPublicationEvenement(id, !isPublished);
              if (!resultat.ok) {
                setErreur(resultat.error);
                return;
              }
              // Les pages publiques sont `force-dynamic` : il n'y a AUCUN cache de données à
              // invalider (voir `server/actions/agenda.ts`). Ce rafraîchissement ne concerne
              // que le cache routeur du navigateur, pour que la liste se remette à jour.
              router.refresh();
            } catch {
              // 🔴 CE `catch` N'EST PAS DÉFENSIF « AU CAS OÙ » — IL ATTRAPE LE MÉCANISME DE
              // SÉCURITÉ LE PLUS MIS EN AVANT DU PROJET. Trouvé en revue (Blind Hunter) :
              // `requireAdmin()` s'exécute AVANT le `try` de la Server Action et **lève** ;
              // elle ne rend donc pas `{ ok: false }` quand la session a expiré ou que le
              // compte vient d'être retiré de l'allowlist. Or `guard.ts` re-vérifie
              // l'allowlist à CHAQUE requête, précisément pour qu'un retrait « prenne effet
              // à la requête suivante ». Scénario réel : un onglet resté ouvert, un accès
              // révoqué, un clic sur « Publier » — et sans ce `catch`, le seul rejet non
              // géré de toute la surface, là où les trois autres mutations (EventForm,
              // BarForm, BoutonConfirmation) le traitent déjà.
              setErreur(
                "Votre session n'est plus valide. Rechargez la page et reconnectez-vous.",
              );
            }
          })
        }
      >
        {enTransition ? "…" : isPublished ? "Dépublier" : "Publier"}
        <span className="sr-only"> — {titre}</span>
      </button>

      <BoutonConfirmation
        libelle="Supprimer"
        question={`Supprimer définitivement « ${titre} » ?`}
        precision="Les photos rattachées à cet événement sont conservées : elles restent dans la galerie."
        onConfirmer={async () => {
          const resultat = await supprimerEvenement(id);
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
