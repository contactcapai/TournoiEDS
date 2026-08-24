"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import { ChampTexte } from "@/components/admin/ChampTexte/ChampTexte";
import { AIDE_NATURE, LIBELLE_NATURE, NOM_PHASE_MAX, NOM_SUGGERE } from "@/lib/schemas/phase";
import { PHASE_KINDS, type PhaseKind } from "@/lib/tournoi/structure";
import { ajouterPhase, deplacerPhase, supprimerPhase } from "@/server/actions/phases";
import type { PhaseListee } from "@/server/db/queries/phases";
import actions from "@/styles/admin-actions.module.css";
import formulaire from "@/styles/admin-form.module.css";
import styles from "./PhasesTournoi.module.css";

/**
 * Composition d'un tournoi : la liste ordonnée de ses phases (Story 10.4, refondue en 10.9).
 *
 * 🔴 UNE PHASE QUI A DES RÉSULTATS NE SE DÉPLACE NI NE SE SUPPRIME, et l'écran le DIT au lieu
 * de désactiver un bouton en silence. Le serveur refuse de toute façon — la garde d'ici sert à
 * ce que personne ne l'apprenne après avoir cliqué.
 *
 * 🔴 CE QUE LA 10.9 A CHANGÉ. Cet écran était le SEUL du back-office à ne consommer ni
 * `admin-form.module.css` ni `ChampTexte` — ses `<label>`/`<input>` bruts étaient l'écart
 * structurel derrière le « très moche » du gate visuel du 2026-08-15. Et il demandait un
 * « Format » dans un `<select>` fermé à quelqu'un qui pense en « poule, tableau, finale » :
 * les quatre formats sont désormais VISIBLES d'un coup, chacun avec ce qu'il fait, et en
 * choisir un PRÉ-REMPLIT le nom.
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

  const [nom, setNom] = useState("");
  const [kind, setKind] = useState<PhaseKind | "">("");

  /**
   * 🔴 LE NOM SUIT LE FORMAT TANT QUE PERSONNE NE L'A TOUCHÉ — patron d'`adresseLiee`
   * (`TournoiForm`), repris tel quel. Sans ce drapeau, changer d'avis sur le format
   * ÉCRASERAIT le nom que la personne vient d'écrire.
   */
  const [nomLie, setNomLie] = useState(true);

  const choisirFormat = (valeur: PhaseKind) => {
    setKind(valeur);
    if (nomLie) setNom(NOM_SUGGERE[valeur]);
  };

  const soumettre = (donnees: FormData) => {
    demarrer(async () => {
      const resultat = await ajouterPhase(tournoiId, donnees);
      if (resultat.ok) {
        setErreur(null);
        setChamps({});
        setNom("");
        setKind("");
        setNomLie(true);
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
          Ce tournoi n&rsquo;a pas encore de déroulé. Ajoutez une première phase ci-dessous.
          Vous pourrez la réécrire tant qu&rsquo;aucune rencontre n&rsquo;a de résultat.
        </p>
      ) : (
        <ol className={styles.liste}>
          {phases.map((phase, index) => (
            <li key={phase.id} className={styles.phase}>
              <span className={styles.rang} aria-hidden="true">
                {phase.position}
              </span>

              <div className={styles.corps}>
                <p className={styles.nom}>
                  <span className="sr-only">Phase {phase.position} — </span>
                  {phase.name}
                </p>
                {/* Une seule ligne d'état, séparateurs au milieu : la version d'avant en
                    empilait deux par phase, ce qui rendait une liste de six illisible. */}
                <p className={styles.etat}>
                  {LIBELLE_NATURE[phase.kind]}
                  {" · "}
                  {phase.rencontres === 0
                    ? "aucune rencontre générée"
                    : `${phase.rencontres} rencontre${phase.rencontres > 1 ? "s" : ""}`}
                  {!phase.librementModifiable && (
                    <>
                      {" · "}
                      <strong className={styles.figee}>
                        des résultats sont saisis, elle ne bouge plus
                      </strong>
                    </>
                  )}
                </p>
              </div>

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

      <form action={soumettre} className={`${formulaire.form} ${styles.ajout}`}>
        <h3 className={styles.titreAjout}>
          {phases.length === 0 ? "La première phase" : "Ajouter une phase"}
        </h3>

        {/* 🔴 LES QUATRE FORMATS SONT VISIBLES D'UN COUP, chacun avec ce qu'il fait. Un
            `<select>` fermé oblige à l'ouvrir pour découvrir ce qui existe, puis à deviner
            ce que chaque nom recouvre — c'est le « pas très intuitif pour un admin tournoi »
            du 2026-08-15. */}
        <fieldset className={formulaire.champ}>
          <legend className={formulaire.legend}>Quel format ?</legend>
          <div className={styles.formats}>
            {PHASE_KINDS.map((valeur) => (
              <label
                key={valeur}
                className={
                  kind === valeur ? `${styles.format} ${styles.formatChoisi}` : styles.format
                }
              >
                <input
                  type="radio"
                  name="kind"
                  value={valeur}
                  checked={kind === valeur}
                  onChange={() => choisirFormat(valeur)}
                  className={styles.formatRadio}
                />
                <span className={styles.formatNom}>{LIBELLE_NATURE[valeur]}</span>
                <span className={styles.formatAide}>{AIDE_NATURE[valeur]}</span>
              </label>
            ))}
          </div>
          {champs.kind && <p className={formulaire.erreur}>{champs.kind}</p>}
        </fieldset>

        <ChampTexte
          id="phase-nom"
          name="name"
          label="Nom de la phase"
          valeur={nom}
          onChange={(valeur) => {
            setNomLie(false);
            setNom(valeur);
          }}
          max={NOM_PHASE_MAX}
          aide="C’est ce que les joueurs liront. Choisissez un format ci-dessus et il se remplit tout seul — vous pouvez le réécrire."
          erreur={champs.name}
        />

        <div className={formulaire.actions}>
          <button type="submit" className={actions.bouton} disabled={enTransition}>
            {enTransition ? "…" : "Ajouter la phase"}
          </button>
        </div>

        {/* Le format ne se modifie pas après coup : le dire ICI évite de le découvrir en
            cherchant un bouton « Modifier » qui n'existe pas. */}
        <p className={formulaire.regle}>
          Le format d&rsquo;une phase ne se change pas après coup — supprimez-la et
          recréez-la, ce qui reste possible tant qu&rsquo;aucun résultat n&rsquo;est saisi.
        </p>
      </form>

      {erreur && (
        <p role="alert" className={formulaire.erreur}>
          {erreur}
        </p>
      )}
    </div>
  );
}
