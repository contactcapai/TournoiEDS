"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import { formatLongDate, formatTime } from "@/lib/date-paris";
import { definirPublicationEvenement, supprimerEvenement } from "@/server/actions/agenda";
import { annoncerSurLesReseaux } from "@/server/actions/reseaux";
import styles from "@/styles/admin-actions.module.css";

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
  /** Quand l'événement a été annoncé sur les réseaux (Story 6.7). `null` = jamais. */
  socialPostedAt: Date | null;
}

export function EventActions({ id, isPublished, titre, socialPostedAt }: EventActionsProps) {
  const router = useRouter();
  const [enTransition, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  /**
   * L'annonce faite pendant CETTE session prime sur celle venue du serveur.
   *
   * ⚠️ Sans cet état local, la ligne continuerait d'afficher « jamais annoncé » jusqu'au
   * `router.refresh()`, c'est-à-dire à l'instant précis où le bénévole se demande si son
   * geste a porté — et où le seul recours visible serait de recliquer, donc de publier deux
   * fois. C'est la raison d'être de la colonne (`schema.ts`), et elle serait perdue par une
   * mise à jour qui n'arrive qu'après.
   */
  const [annonceLocale, setAnnonceLocale] = useState<Date | null>(null);
  const annonceLe = annonceLocale ?? socialPostedAt;

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

      {/* 🔴 RENDUE SEULEMENT SI L'ÉVÉNEMENT EST PUBLIÉ — ABSENTE, JAMAIS GRISÉE.
          Annoncer une soirée dont la page n'est pas en ligne enverrait le lecteur d'un réseau
          social vers un agenda où elle ne figure pas (`getUpcomingEvents` filtre sur
          `is_published`). Un bouton grisé sans explication est une porte sans pièce — le
          défaut que `app/admin/_sections.ts` existe pour empêcher, à l'échelle d'une ligne.
          ⚠️ L'absence ici n'est PAS la garde : la Server Action refuse elle aussi, parce
          qu'elle est atteignable par un POST direct, quoi qu'affiche cet écran. */}
      {isPublished ? (
        <BoutonConfirmation
          libelle="Annoncer sur les réseaux"
          question={`Annoncer « ${titre} » sur les réseaux ?`}
          /* 🔴 LA PRÉCISION CHANGE SELON QU'IL A DÉJÀ ÉTÉ ANNONCÉ, ET C'EST TOUT L'INTÉRÊT DE
             LA TRACE. On ne bloque pas une seconde annonce (republier après correction est un
             besoin réel) — on la rend VISIBLE au moment où la décision se prend. Même
             arbitrage que la fermeture de R31 : « acceptée AVEC FILET », pas corrigée. */
          precision={
            annonceLe
              ? `⚠️ Déjà annoncé le ${formatLongDate(annonceLe)} à ${formatTime(annonceLe)}. ` +
                "Confirmer publiera une SECONDE annonce, que ce back-office ne sait pas retirer."
              : "L'annonce part vers l'outil de publication. Elle ne peut pas être annulée depuis ici."
          }
          libelleConfirmation="Oui, annoncer"
          libelleEnCours="Envoi…"
          onConfirmer={async () => {
            const resultat = await annoncerSurLesReseaux(id);
            if (resultat.ok) {
              setAnnonceLocale(resultat.data.annonceLe);
              router.refresh();
              return { ok: true };
            }
            return { ok: false, error: resultat.error };
          }}
        />
      ) : null}

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

      {/* La trace, lisible sans ouvrir la confirmation. `formatLongDate` + `formatTime`
          (`lib/date-paris`) et jamais une date brute : l'heure murale de Paris est la seule
          que le bénévole reconnaîtra. */}
      {annonceLe ? (
        <p className={styles.trace}>
          Annoncé sur les réseaux le {formatLongDate(annonceLe)} à {formatTime(annonceLe)}
        </p>
      ) : null}

      {erreur ? (
        <p className={styles.erreur} role="alert">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
