"use client";

import { useState } from "react";

import styles from "./BoutonConfirmation.module.css";

/**
 * Bouton d'action destructrice, à confirmation EN DEUX TEMPS (Story 6.3).
 *
 * 🔴 PAS DE `window.confirm`, ET CE N'EST PAS UN CAPRICE ESTHÉTIQUE. La boîte native n'est
 * ni stylable, ni traduisible, ni cohérente avec le reste du site — et surtout elle ne peut
 * pas porter la PRÉCISION qui compte ici (« les photos rattachées sont conservées »). Un
 * bénévole qui croit détruire des photos n'osera pas supprimer un doublon, et la marche
 * arrière que cette story existe pour offrir ne servira à personne.
 *
 * ⚠️ Le second bouton est un bouton DIFFÉRENT, à un endroit DIFFÉRENT : un double-clic
 * malheureux sur le premier ne peut donc pas déclencher la suppression.
 *
 * Payé deux fois dès cette story (supprimer un événement, supprimer un bar) — d'où
 * l'extraction. On extrait au 2ᵉ consommateur, pas « au cas où » (METHODE.md §5).
 */
export interface BoutonConfirmationProps {
  libelle: string;
  question: string;
  /** Ce que la suppression fait VRAIMENT — y compris ce qu'elle ne détruit pas. */
  precision?: string;
  /** Rend le résultat discriminé de la Server Action, dont l'erreur est affichée ici. */
  onConfirmer: () => Promise<{ ok: boolean; error?: string }>;
}

export function BoutonConfirmation({
  libelle,
  question,
  precision,
  onConfirmer,
}: BoutonConfirmationProps) {
  const [demandeConfirmation, setDemandeConfirmation] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!demandeConfirmation) {
    return (
      <div className={styles.bloc}>
        <button
          type="button"
          className={styles.declencheur}
          onClick={() => {
            setErreur(null);
            setDemandeConfirmation(true);
          }}
        >
          {libelle}
        </button>
        {/* L'erreur SURVIT au retour à l'état initial : une suppression refusée (un bar
            encore référencé, par exemple) doit rester lisible après que le panneau de
            confirmation s'est refermé, sinon le refus passe inaperçu. */}
        {erreur ? (
          <p className={styles.erreur} role="alert">
            {erreur}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.bloc}>
      <p className={styles.question}>{question}</p>
      {precision ? <p className={styles.precision}>{precision}</p> : null}
      <div className={styles.reponses}>
        <button
          type="button"
          className={styles.confirmer}
          onClick={async () => {
            setEnCours(true);
            setErreur(null);
            try {
              const resultat = await onConfirmer();
              if (!resultat.ok) {
                setErreur(resultat.error ?? "L'opération a échoué.");
                setDemandeConfirmation(false);
              }
              // En cas de succès, la page se recharge (`router.refresh()` côté appelant) :
              // ce composant disparaît avec la ligne qu'il servait.
            } catch {
              setErreur("Une erreur réseau est survenue, merci de réessayer.");
              setDemandeConfirmation(false);
            } finally {
              setEnCours(false);
            }
          }}
        >
          {enCours ? "Suppression…" : "Oui, supprimer"}
        </button>
        <button
          type="button"
          className={styles.annuler}
          onClick={() => setDemandeConfirmation(false)}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
