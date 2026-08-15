"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import { LIBELLE_NATURE, NOM_PHASE_MAX } from "@/lib/schemas/phase";
import { PHASE_KINDS } from "@/lib/tournoi/structure";
import { ajouterPhase, deplacerPhase, supprimerPhase } from "@/server/actions/phases";
import type { PhaseListee } from "@/server/db/queries/phases";
import actions from "@/styles/admin-actions.module.css";
import styles from "./PhasesTournoi.module.css";

/**
 * Composition d'un tournoi : la liste ordonnée de ses phases (Story 10.4).
 *
 * Patron d'`AtelierActions` (6.9) pour les flèches et la confirmation.
 *
 * 🔴 UNE PHASE QUI A DES RÉSULTATS NE SE DÉPLACE NI NE SE SUPPRIME, et l'écran le DIT au lieu
 * de désactiver un bouton en silence. Le serveur refuse de toute façon — la garde d'ici sert à
 * ce que personne ne l'apprenne après avoir cliqué.
 */
export function PhasesTournoi({
  tournoiId,
  phases,
}: {
  tournoiId: string;
  phases: readonly PhaseListee[];
}) {
  const router = useRouter();
  const [enTransition, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [champs, setChamps] = useState<Record<string, string>>({});
  const formulaire = useRef<HTMLFormElement>(null);

  const soumettre = (donnees: FormData) => {
    demarrer(async () => {
      const resultat = await ajouterPhase(tournoiId, donnees);
      if (resultat.ok) {
        setErreur(null);
        setChamps({});
        formulaire.current?.reset();
        router.refresh();
        return;
      }
      setErreur(resultat.error);
      setChamps(resultat.fieldErrors ?? {});
    });
  };

  const deplacer = (id: string, sens: "monter" | "descendre") => {
    demarrer(async () => {
      const resultat = await deplacerPhase(id, sens);
      if (resultat.ok) router.refresh();
      else setErreur(resultat.error);
    });
  };

  return (
    <div className={styles.bloc}>
      {phases.length === 0 ? (
        <p className={styles.vide}>
          Ce tournoi n&rsquo;a pas encore de déroulé. Ajoutez une première phase — une poule,
          un tableau à élimination, des lobbies. Vous pourrez la réécrire tant qu&rsquo;aucune
          rencontre n&rsquo;a de résultat.
        </p>
      ) : (
        <ol className={styles.liste}>
          {phases.map((phase, index) => (
            <li key={phase.id} className={styles.phase}>
              <div className={styles.entete}>
                <span className={styles.rang}>{phase.position}</span>
                <div>
                  <p className={styles.nom}>{phase.name}</p>
                  <p className={styles.nature}>{LIBELLE_NATURE[phase.kind]}</p>
                </div>
              </div>

              <p className={styles.etat}>
                {phase.rencontres === 0
                  ? "Aucune rencontre générée pour l’instant."
                  : `${phase.rencontres} rencontre${phase.rencontres > 1 ? "s" : ""}`}
                {!phase.librementModifiable && (
                  <>
                    {" — "}
                    <strong>des résultats sont saisis</strong>, cette phase ne se déplace ni ne
                    se supprime.
                  </>
                )}
              </p>

              <div className={actions.groupe}>
                <button
                  type="button"
                  className={actions.bouton}
                  disabled={enTransition || index === 0 || !phase.librementModifiable}
                  onClick={() => deplacer(phase.id, "monter")}
                >
                  ↑<span className="sr-only"> Monter — {phase.name}</span>
                </button>
                <button
                  type="button"
                  className={actions.bouton}
                  disabled={
                    enTransition || index === phases.length - 1 || !phase.librementModifiable
                  }
                  onClick={() => deplacer(phase.id, "descendre")}
                >
                  ↓<span className="sr-only"> Descendre — {phase.name}</span>
                </button>

                {phase.librementModifiable && (
                  <BoutonConfirmation
                    libelle="Supprimer"
                    question={`Supprimer la phase « ${phase.name} » ?`}
                    precision={
                      phase.rencontres === 0
                        ? "Cette phase n’a aucune rencontre : rien d’autre ne disparaît."
                        : `Ses ${phase.rencontres} rencontres sont détruites avec elle. ` +
                          "Aucun résultat n’y est saisi, donc rien de joué n’est perdu."
                    }
                    onConfirmer={async () => {
                      const resultat = await supprimerPhase(phase.id);
                      if (resultat.ok) router.refresh();
                      return resultat.ok ? { ok: true } : { ok: false, error: resultat.error };
                    }}
                  />
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <form ref={formulaire} action={soumettre} className={styles.ajout}>
        <h2 className={styles.titreAjout}>Ajouter une phase</h2>

        <label className={styles.champ}>
          <span>Nom de la phase</span>
          <input
            type="text"
            name="name"
            maxLength={NOM_PHASE_MAX}
            required
            placeholder="Poule A, Tableau final…"
            aria-describedby={champs.name ? "erreur-nom-phase" : undefined}
          />
          {champs.name && (
            <span id="erreur-nom-phase" className={styles.erreurChamp}>
              {champs.name}
            </span>
          )}
        </label>

        <label className={styles.champ}>
          <span>Format</span>
          <select name="kind" defaultValue="" required>
            <option value="" disabled>
              Choisir…
            </option>
            {PHASE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {LIBELLE_NATURE[kind]}
              </option>
            ))}
          </select>
          {champs.kind && <span className={styles.erreurChamp}>{champs.kind}</span>}
        </label>

        <button type="submit" className={actions.bouton} disabled={enTransition}>
          {enTransition ? "…" : "Ajouter la phase"}
        </button>

        {/* Le format ne se modifie pas après coup : le dire ICI évite de le découvrir en
            cherchant un bouton « Modifier » qui n'existe pas. */}
        <p className={styles.aide}>
          Le format d&rsquo;une phase ne se change pas après coup — supprimez-la et
          recréez-la, ce qui reste possible tant qu&rsquo;aucun résultat n&rsquo;est saisi.
        </p>
      </form>

      {erreur && (
        <p role="alert" className={styles.erreur}>
          {erreur}
        </p>
      )}
    </div>
  );
}
