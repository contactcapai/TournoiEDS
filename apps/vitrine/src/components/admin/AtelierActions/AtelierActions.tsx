"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import type { WorkshopFamily } from "@/lib/schemas/workshop";
import {
  definirPublicationAtelier,
  reordonnerAteliers,
  supprimerAtelier,
} from "@/server/actions/ateliers";
import styles from "@/styles/admin-actions.module.css";

/**
 * Actions d'une ligne d'atelier : monter / descendre, retirer de l'offre / publier, supprimer
 * (Story 6.9). Patron d'`EventActions` (6.3), `PhotoActions` (6.4), `PartenaireActions` (6.5).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 « RETIRER DE L'OFFRE » ET « SUPPRIMER » SONT DEUX GESTES DIFFÉRENTS, ET L'ÉCRAN LE DIT
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * C'est l'AC de la story, et ce n'est pas une préférence de vocabulaire : *« une offre
 * saisonnière se republie, elle ne se ressaisit pas »*. Le geste NOMINAL sur un atelier qui
 * n'est plus proposé est de le **dépublier** — la ligne reste, avec sa description, son public
 * et son rang, prête à revenir l'année suivante.
 *
 * ⚠️ D'OÙ UN LIBELLÉ QUI N'EST PAS « DÉPUBLIER », contrairement aux trois autres écrans du
 * back-office. « Dépublier » décrit ce que fait le système ; « Retirer de l'offre » décrit ce
 * que fait le bénévole — et surtout, il se distingue franchement de « Supprimer », qui est le
 * geste voisin et irréversible. Deux libellés proches sur deux gestes que tout oppose est
 * exactement ce qui fait cliquer trop vite.
 *
 * 🔴 ET LA CONFIRMATION DIT CE QUE LA SUPPRESSION FAIT VRAIMENT — ici : rien d'autre que
 * détruire la ligne. Pas de fichier détruit (contrairement à la galerie et aux partenaires),
 * pas de contenu rattaché conservé (contrairement à l'agenda). Une différence de comportement
 * entre deux écrans du même back-office doit être ÉCRITE, pas déduite.
 *
 * 🔴 L'ORDRE EST PROPRE À UNE FAMILLE. Le tri du catalogue est `family, sort_order, title, id` :
 * `family` tranche AVANT `sort_order`. Monter un atelier « au-dessus » d'une autre famille est
 * donc impossible et sans effet observable. Les flèches ne déplacent jamais une entrée hors de
 * sa famille, et `ordre` ne contient que les identifiants de CETTE famille.
 */

export interface AtelierActionsProps {
  id: string;
  intitule: string;
  isPublished: boolean;
  /** La famille dont l'ordre est renuméroté — jamais toute la table. */
  famille: WorkshopFamily;
  /**
   * L'ordre COMPLET des ateliers de CETTE famille, et la position de celui-ci.
   *
   * 🔴 LA LISTE ENTIÈRE DE LA FAMILLE, PAS SEULEMENT LES DEUX VOISINS : `reordonnerAteliers`
   * RENUMÉROTE au lieu de permuter. Une permutation laisserait intactes les égalités
   * existantes — or le cas nominal est « tout le monde à 0 », où le départage se fait sur le
   * titre puis l'UUID, donc où « monter d'un cran » n'aurait aucun effet.
   */
  ordre: readonly string[];
  position: number;
}

export function AtelierActions({
  id,
  intitule,
  isPublished,
  famille,
  ordre,
  position,
}: AtelierActionsProps) {
  const router = useRouter();
  const [enTransition, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const premier = position === 0;
  const dernier = position === ordre.length - 1;

  function deplacer(pas: -1 | 1) {
    const cible = position + pas;
    if (cible < 0 || cible >= ordre.length) return;

    const nouveau = [...ordre];
    const [deplace] = nouveau.splice(position, 1);
    nouveau.splice(cible, 0, deplace);

    demarrer(async () => {
      setErreur(null);
      try {
        // 🔴 ON ENVOIE L'ORDRE QU'ON CROYAIT **EN PLUS** DE CELUI QU'ON VEUT (concurrence
        // optimiste, née d'un défaut réel trouvé en revue de la 6.4). Chaque ligne a son
        // propre `useTransition` et part du même `ordre` figé au rendu serveur : sans cette
        // comparaison, deux clics rapides partiraient tous deux de l'état d'AVANT, et le
        // second annulerait silencieusement le premier — deux succès affichés, un seul geste.
        const resultat = await reordonnerAteliers(famille, [...ordre], nouveau);
        if (!resultat.ok) {
          setErreur(resultat.error);
          return;
        }
        router.refresh();
      } catch {
        // `exigerRoleAction()` LÈVE avant le `try` de la Server Action : la révocation immédiate
        // arrive ici, et nulle part ailleurs (leçon 6.3).
        setErreur("Votre session n'est plus valide. Rechargez la page et reconnectez-vous.");
      }
    });
  }

  return (
    <div className={styles.bloc}>
      <div className={styles.rang}>
        {/* ⚠️ MASQUÉS AUX EXTRÉMITÉS, PAS LAISSÉS INERTES. Deux flèches qui ne mènent nulle
            part sont exactement le défaut que `gate:carousel` a trouvé en Story 3.3. Une
            famille d'un seul atelier n'affiche donc aucune commande d'ordre. */}
        {!premier ? (
          <button
            type="button"
            className={styles.deplacer}
            onClick={() => deplacer(-1)}
            disabled={enTransition}
          >
            <span aria-hidden="true">↑</span>
            <span className="sr-only">Monter d&rsquo;un cran — {intitule}</span>
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
            <span className="sr-only">Descendre d&rsquo;un cran — {intitule}</span>
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
              const resultat = await definirPublicationAtelier(id, !isPublished);
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
        {enTransition ? "…" : isPublished ? "Retirer de l'offre" : "Publier"}
        <span className="sr-only"> — {intitule}</span>
      </button>

      <BoutonConfirmation
        libelle="Supprimer"
        question={`Supprimer définitivement « ${intitule} » ?`}
        precision={
          "L'atelier disparaît du site et de cet écran, définitivement — avec sa description, " +
          "son public visé et sa place dans l'ordre. " +
          "Si vous voulez seulement le retirer du site pour cette saison, utilisez " +
          "« Retirer de l'offre » : la fiche est conservée et se republie en un clic."
        }
        onConfirmer={async () => {
          const resultat = await supprimerAtelier(id);
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
