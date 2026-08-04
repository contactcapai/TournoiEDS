"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import type { PartnerCategory } from "@/lib/schemas/partner";
import {
  definirPublicationPartenaire,
  reordonnerPartenaires,
  supprimerPartenaire,
} from "@/server/actions/partenaires";
import styles from "@/styles/admin-actions.module.css";

/**
 * Actions d'une ligne de partenaire : monter / descendre, publier / dépublier, supprimer
 * (Story 6.5). Patron d'`EventActions` (6.3) puis `PhotoActions` (6.4).
 *
 * 🔴 « DÉPUBLIER » ET « SUPPRIMER » SONT VISUELLEMENT DISTINCTS, ET C'EST UNE GARDE. L'un est
 * réversible en un clic, l'autre ne l'est pas. Les rendre semblables ferait hésiter sur le
 * premier et cliquer trop vite sur le second.
 *
 * 🔴 ET LA CONFIRMATION DIT CE QUE LA SUPPRESSION FAIT VRAIMENT — ici, elle détruit **aussi le
 * fichier**, comme dans la galerie et contrairement à l'agenda (où supprimer un événement
 * conserve les photos rattachées). Une différence de comportement entre deux écrans du même
 * back-office doit être ÉCRITE, pas déduite.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 L'ORDRE EST PROPRE À UNE CATÉGORIE — CE N'EST PAS UNE SIMPLIFICATION D'ÉCRAN
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Le tri des requêtes publiques est `category, sort_order, name, id` : **`category` tranche
 * AVANT `sort_order`**. Monter un sponsor « au-dessus » d'un partenaire est donc impossible et
 * sans effet observable. Les flèches ne déplacent jamais une entrée hors de sa catégorie, et
 * `ordre` ne contient que les identifiants de CETTE catégorie.
 */

export interface PartenaireActionsProps {
  id: string;
  nom: string;
  isPublished: boolean;
  /** La catégorie dont l'ordre est renuméroté — jamais toute la table. */
  categorie: PartnerCategory;
  /**
   * L'ordre COMPLET des partenaires de CETTE catégorie, et la position de celui-ci.
   *
   * 🔴 LA LISTE ENTIÈRE DE LA CATÉGORIE, PAS SEULEMENT LES DEUX VOISINS :
   * `reordonnerPartenaires` RENUMÉROTE au lieu de permuter. Une permutation laisserait
   * intactes les égalités existantes — or le cas nominal est « tout le monde à 0 », où le
   * départage se fait sur le nom puis l'UUID, donc où « monter d'un cran » n'a aucun effet.
   */
  ordre: readonly string[];
  position: number;
  /** `true` si le logo vit sur le volume : la confirmation dit alors qu'il sera détruit. */
  logoSurLeVolume: boolean;
}

export function PartenaireActions({
  id,
  nom,
  isPublished,
  categorie,
  ordre,
  position,
  logoSurLeVolume,
}: PartenaireActionsProps) {
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
        const resultat = await reordonnerPartenaires(categorie, [...ordre], nouveau);
        if (!resultat.ok) {
          setErreur(resultat.error);
          return;
        }
        router.refresh();
      } catch {
        // `requireAdmin()` LÈVE avant le `try` de la Server Action : la révocation immédiate
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
            catégorie d'un seul partenaire n'affiche donc aucune commande d'ordre. */}
        {!premier ? (
          <button
            type="button"
            className={styles.deplacer}
            onClick={() => deplacer(-1)}
            disabled={enTransition}
          >
            <span aria-hidden="true">↑</span>
            <span className="sr-only">Monter d&rsquo;un cran — {nom}</span>
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
            <span className="sr-only">Descendre d&rsquo;un cran — {nom}</span>
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
              const resultat = await definirPublicationPartenaire(id, !isPublished);
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
        <span className="sr-only"> — {nom}</span>
      </button>

      <BoutonConfirmation
        libelle="Supprimer"
        question={`Supprimer définitivement « ${nom} » ?`}
        precision={
          "La fiche disparaît du site et de cet écran, définitivement. " +
          (logoSurLeVolume
            ? "Son logo sera DÉTRUIT sur le serveur : contrairement à un événement, rien n'est conservé. "
            : "") +
          "Si vous voulez seulement le retirer du site, utilisez « Dépublier »."
        }
        onConfirmer={async () => {
          const resultat = await supprimerPartenaire(id);
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
