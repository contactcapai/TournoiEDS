"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import {
  definirPublicationPhoto,
  reordonnerPhotos,
  supprimerPhoto,
} from "@/server/actions/galerie";
import styles from "@/styles/admin-actions.module.css";

/**
 * Actions d'une ligne de la galerie : monter / descendre, publier / dépublier, supprimer
 * (Story 6.4).
 *
 * 🔴 « DÉPUBLIER » ET « SUPPRIMER » SONT VISUELLEMENT DISTINCTS, ET C'EST UNE GARDE — patron
 * d'`EventActions` (6.3). L'un est réversible en un clic, l'autre ne l'est pas. Les rendre
 * semblables ferait hésiter sur le premier et cliquer trop vite sur le second.
 *
 * 🔴 ET LA CONFIRMATION DIT CE QUE LA SUPPRESSION FAIT VRAIMENT — ICI, ELLE DÉTRUIT LE
 * FICHIER. C'est la DIFFÉRENCE avec l'écran d'agenda, où supprimer un événement conserve les
 * photos rattachées (`ON DELETE SET NULL`). Un bénévole qui a appris là-bas que « supprimer
 * ne détruit pas les photos » supposera la même chose ici, et se trompera. Une différence de
 * comportement entre deux écrans du même back-office doit être ÉCRITE, pas déduite.
 */

export interface PhotoActionsProps {
  id: string;
  isPublished: boolean;
  /** Sert le nom accessible des boutons ET la question de confirmation. */
  description: string;
  filename: string;
  /**
   * L'ordre COMPLET des photos affichées, et la position de celle-ci.
   *
   * 🔴 LA LISTE ENTIÈRE, PAS SEULEMENT LES DEUX VOISINES : `reordonnerPhotos` RENUMÉROTE
   * (la position devient le `sort_order`) au lieu de permuter. Une permutation laisserait
   * intactes les égalités existantes — or le cas nominal d'aujourd'hui est « tout le monde
   * à 0 », où le départage se fait sur un UUID aléatoire, donc où « monter d'un cran » n'a
   * aucun effet observable.
   */
  ordre: readonly string[];
  position: number;
}

export function PhotoActions({
  id,
  isPublished,
  description,
  filename,
  ordre,
  position,
}: PhotoActionsProps) {
  const router = useRouter();
  const [enTransition, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const premier = position === 0;
  const dernier = position === ordre.length - 1;

  function deplacer(pas: -1 | 1) {
    const cible = position + pas;
    if (cible < 0 || cible >= ordre.length) return;

    const nouveau = [...ordre];
    const [deplacee] = nouveau.splice(position, 1);
    nouveau.splice(cible, 0, deplacee);

    demarrer(async () => {
      setErreur(null);
      try {
        // 🔴 ON ENVOIE L'ORDRE QU'ON CROYAIT **EN PLUS** DE CELUI QU'ON VEUT (garde de
        // concurrence optimiste, née d'un défaut réel trouvé en revue). Chaque ligne a son
        // propre `useTransition` et part du même `ordre` figé au rendu serveur : sans cette
        // comparaison, deux clics rapides sur deux lignes différentes partaient tous deux de
        // l'état d'AVANT, et le second annulait silencieusement le premier — deux succès
        // affichés, un seul geste appliqué.
        const resultat = await reordonnerPhotos([...ordre], nouveau);
        if (!resultat.ok) {
          setErreur(resultat.error);
          return;
        }
        router.refresh();
      } catch {
        // `requireAdmin()` LÈVE avant le `try` de la Server Action : la révocation immédiate
        // arrive ici, et nulle part ailleurs (leçon 6.3, `EventActions`).
        setErreur("Votre session n'est plus valide. Rechargez la page et reconnectez-vous.");
      }
    });
  }

  return (
    <div className={styles.bloc}>
      <div className={styles.rang}>
        {/* ⚠️ MASQUÉS AUX EXTRÉMITÉS, PAS LAISSÉS INERTES. Deux flèches qui ne mènent nulle
            part sont exactement le défaut que `gate:carousel` a trouvé en Story 3.3 (« deux
            flèches MORTES à une seule vignette »). Une galerie d'une seule photo n'affiche
            donc aucune commande d'ordre. */}
        {!premier ? (
          <button
            type="button"
            className={styles.deplacer}
            onClick={() => deplacer(-1)}
            disabled={enTransition}
          >
            <span aria-hidden="true">↑</span>
            <span className="sr-only">Monter d&rsquo;un cran — {description}</span>
          </button>
        ) : null}
        {!dernier ? (
          <button
            type="button"
            className={styles.deplacer}
            onClick={() => deplacer(1)}
            disabled={enTransition}
          >
            <span aria-hidden="true">↓</span>
            <span className="sr-only">Descendre d&rsquo;un cran — {description}</span>
          </button>
        ) : null}
      </div>

      <button
        type="button"
        className={isPublished ? styles.basculePubliee : styles.bascule}
        onClick={() =>
          demarrer(async () => {
            setErreur(null);
            try {
              const resultat = await definirPublicationPhoto(id, !isPublished);
              if (!resultat.ok) {
                setErreur(resultat.error);
                return;
              }
              router.refresh();
            } catch {
              setErreur("Votre session n'est plus valide. Rechargez la page et reconnectez-vous.");
            }
          })
        }
      >
        {enTransition ? "…" : isPublished ? "Dépublier" : "Publier"}
        <span className="sr-only"> — {description}</span>
      </button>

      <BoutonConfirmation
        libelle="Supprimer"
        question={`Supprimer définitivement cette photo (${filename}) ?`}
        // 🔴 LA PRÉCISION EST LE LIVRABLE, ET ELLE EST L'INVERSE DE CELLE DE L'AGENDA.
        precision={
          "Le fichier image sera DÉTRUIT sur le serveur, en plus de la fiche : " +
          "contrairement à la suppression d'un événement, rien n'est conservé. " +
          "Si vous voulez seulement la retirer du site, utilisez « Dépublier »."
        }
        onConfirmer={async () => {
          const resultat = await supprimerPhoto(id);
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
