"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import {
  definirPublicationMembre,
  reordonnerMembres,
  supprimerMembre,
} from "@/server/actions/membres";
import styles from "@/styles/admin-actions.module.css";

/**
 * Actions d'une ligne de membre : monter / descendre, retirer du site / publier, supprimer
 * (Story 6.10). Patron d'`EventActions` (6.3), `PhotoActions` (6.4), `PartenaireActions` (6.5)
 * et `AtelierActions` (6.9).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 « RETIRER DU SITE » ET « SUPPRIMER » SONT DEUX GESTES DIFFÉRENTS, ET L'ÉCRAN LE DIT
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * C'est l'AC de la story : *« un retour au bureau se republie, il ne se ressaisit pas »*. Le
 * geste NOMINAL quand quelqu'un quitte ses fonctions est de le **dépublier** — la ligne reste,
 * avec son rôle, son portrait et son rang.
 *
 * ⚠️ D'OÙ UN LIBELLÉ QUI N'EST PAS « DÉPUBLIER ». Il décrit ce que fait le bénévole, et
 * surtout il se distingue franchement de « Supprimer », le geste voisin et irréversible. Deux
 * libellés proches sur deux gestes que tout oppose est exactement ce qui fait cliquer trop vite.
 *
 * 🔴 ET LA CONFIRMATION DIT CE QUE LA SUPPRESSION FAIT VRAIMENT — ici : **elle détruit aussi
 * le portrait**. C'est le droit à l'effacement (RGPD, NFR5), pas un effet de bord. Une
 * différence de comportement entre deux écrans du même back-office doit être ÉCRITE, pas
 * déduite : la galerie détruit un fichier, l'agenda conserve les photos rattachées, les
 * ateliers ne touchent à rien.
 *
 * ⚠️ L'ORDRE EST GLOBAL, contrairement aux ateliers (par famille) et aux partenaires (par
 * catégorie) : l'équipe est une liste unique. Il n'y a donc pas de portée à passer ici.
 */

export interface MembreActionsProps {
  id: string;
  prenom: string;
  role: string;
  isPublished: boolean;
  /** `true` si un portrait est rattaché : la confirmation de suppression le dit. */
  aUnPortrait: boolean;
  /**
   * L'ordre COMPLET de l'équipe, et la position de ce membre.
   *
   * 🔴 LA LISTE ENTIÈRE, PAS SEULEMENT LES DEUX VOISINS : `reordonnerMembres` RENUMÉROTE au
   * lieu de permuter. Une permutation laisserait intactes les égalités existantes — or le cas
   * nominal est « tout le monde à 0 », où le départage se fait sur le prénom puis l'UUID, donc
   * où « monter d'un cran » n'aurait aucun effet.
   */
  ordre: readonly string[];
  position: number;
}

export function MembreActions({
  id,
  prenom,
  role,
  isPublished,
  aUnPortrait,
  ordre,
  position,
}: MembreActionsProps) {
  const router = useRouter();
  const [enTransition, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const premier = position === 0;
  const dernier = position === ordre.length - 1;

  // ⚠️ Le nom accessible porte le prénom ET le rôle : deux « Marie » dans un bureau est banal,
  // et « Monter d'un cran — Marie » serait alors ambigu pour un lecteur d'écran.
  const designation = `${prenom} (${role})`;

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
        // optimiste, née d'un défaut réel trouvé en revue de la 6.4). Chaque ligne a son propre
        // `useTransition` et part du même `ordre` figé au rendu serveur : sans cette
        // comparaison, deux clics rapides partiraient tous deux de l'état d'AVANT, et le second
        // annulerait silencieusement le premier — deux succès affichés, un seul geste.
        const resultat = await reordonnerMembres([...ordre], nouveau);
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
        {/* ⚠️ MASQUÉS AUX EXTRÉMITÉS, PAS LAISSÉS INERTES. Deux flèches qui ne mènent nulle part
            sont exactement le défaut que `gate:carousel` a trouvé en Story 3.3. Une équipe d'un
            seul membre n'affiche donc aucune commande d'ordre. */}
        {!premier ? (
          <button
            type="button"
            className={styles.deplacer}
            onClick={() => deplacer(-1)}
            disabled={enTransition}
          >
            <span aria-hidden="true">↑</span>
            <span className="sr-only">Monter d&rsquo;un cran — {designation}</span>
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
            <span className="sr-only">Descendre d&rsquo;un cran — {designation}</span>
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
              const resultat = await definirPublicationMembre(id, !isPublished);
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
        {enTransition ? "…" : isPublished ? "Retirer du site" : "Publier"}
        <span className="sr-only"> — {designation}</span>
      </button>

      <BoutonConfirmation
        libelle="Supprimer"
        question={`Supprimer définitivement « ${prenom} » de l'équipe ?`}
        precision={
          "La fiche disparaît du site et de cet écran, définitivement — avec son rôle et sa " +
          "place dans l'ordre." +
          (aUnPortrait
            ? " Son portrait sera DÉTRUIT sur le serveur : c'est une photo de personne, elle " +
              "ne doit pas rester quelque part une fois la fiche supprimée."
            : "") +
          " Si vous voulez seulement le retirer du site — un départ du bureau, une pause —, " +
          "utilisez « Retirer du site » : la fiche et le portrait sont conservés, et se " +
          "republient en un clic."
        }
        onConfirmer={async () => {
          const resultat = await supprimerMembre(id);
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
