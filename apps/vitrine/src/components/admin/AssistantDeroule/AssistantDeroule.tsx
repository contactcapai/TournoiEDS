"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { jourLisible } from "@/lib/date-paris";
import {
  derouleType,
  JOURNEES_MAX,
  LIBELLE_NATURE,
  MANCHES_PAR_JOURNEE_MAX,
} from "@/lib/schemas/phase";
import { decouperEnJournees, numeroDeJournee } from "@/lib/tournoi/journees";
import { poserDerouleType } from "@/server/actions/phases";
import actions from "@/styles/admin-actions.module.css";
import formulaire from "@/styles/admin-form.module.css";
import styles from "./AssistantDeroule.module.css";

/**
 * L'assistant de déroulé — pose un TFT complet en une fois (2026-08-24, apparence en 13.1).
 *
 * 🔴 IL EXISTE PARCE QUE LE CAS RÉEL DE BRICE DEMANDAIT 8 À 12 SAISIES. Un TFT en rondes
 * suisses sur quatre week-ends, c'est quatre journées de deux ou trois manches ; une phase à
 * la fois, en nommant chacune et sans oublier de date, « ça semble compliqué » — et c'était
 * exact.
 *
 * ⚠️ L'ASSISTANCE PRÉ-REMPLIT, UN HUMAIN VALIDE (arbitrage du 2026-08-13). D'où l'aperçu
 * ci-dessous : on voit CE QUI SERA ÉCRIT avant de cliquer, et ce qui est posé se renomme, se
 * déplace et se supprime ensuite comme n'importe quelle phase saisie à la main.
 *
 * ⚠️ L'aperçu appelle `derouleType`, C'EST-À-DIRE LA FONCTION QUI ÉCRIT — pas une seconde
 * version « pour l'affichage ». Un aperçu calculé à part finit par mentir : on validerait ce
 * qu'on a lu, et autre chose serait écrit. Il partage aussi le DÉCOUPAGE EN JOURNÉES du
 * déroulé réel (`decouperEnJournees`), pour la même raison : ce qu'on lit avant et ce qu'on
 * relit après doivent avoir la même forme, sinon on croit à une erreur d'écriture.
 *
 * 🔴 CE QUE LA 13.1 A CHANGÉ. L'assistant vivait REPLIÉ derrière un bouton « Composer un
 * déroulé type », et son aperçu tenait dans une liste à puces au bas du formulaire. Une
 * assistance qu'il faut déplier est trouvée par qui la cherche, c'est-à-dire par qui n'en a
 * pas besoin ; et un aperçu qu'on découvre après avoir tout saisi ne sert plus à décider.
 * Il occupe désormais sa colonne d'emblée, et la prévisualisation a une vraie place.
 */
export function AssistantDeroule({ tournoiId }: { tournoiId: string }) {
  const router = useRouter();
  const [enTransition, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const [journees, setJournees] = useState("4");
  const [manches, setManches] = useState("2");
  const [premierJour, setPremierJour] = useState("");
  const [finale, setFinale] = useState(true);

  /**
   * L'aperçu. `null` dès qu'une saisie n'est pas un nombre exploitable — on ne montre PAS un
   * aperçu approximatif : il servirait à valider autre chose que ce qui sera écrit.
   */
  const apercu = useMemo(() => {
    const n = Number(journees);
    const m = Number(manches);
    if (!Number.isInteger(n) || !Number.isInteger(m) || n < 1 || m < 1) return null;
    if (n > JOURNEES_MAX || m > MANCHES_PAR_JOURNEE_MAX) return null;
    return derouleType({
      journees: n,
      manchesParJournee: m,
      premierJour: premierJour === "" ? null : premierJour,
      finale,
    });
  }, [journees, manches, premierJour, finale]);

  const groupes = apercu === null ? [] : decouperEnJournees(apercu);

  const soumettre = (donnees: FormData) => {
    demarrer(async () => {
      const resultat = await poserDerouleType(tournoiId, donnees);
      if (resultat.ok) {
        setErreur(null);
        router.refresh();
        return;
      }
      setErreur(resultat.error);
    });
  };

  return (
    <form action={soumettre} className={`${formulaire.form} ${styles.assistant}`}>
      <h3 className={styles.titre}>L&rsquo;assistant</h3>
      <p className={styles.chapo}>
        Il pose les journées, leurs manches et leurs dates d&rsquo;un coup. Rien n&rsquo;est
        écrit tant que vous n&rsquo;avez pas validé ce que vous lisez plus bas.
      </p>

      {/* Les deux nombres côte à côte : ce sont eux qu'on ajuste en regardant l'aperçu, et
          les séparer sur deux rangées éloignerait la cause de son effet. */}
      <div className={styles.paire}>
        <div className={formulaire.champ}>
          <label className={formulaire.label} htmlFor="assistant-journees">
            Combien de journées ?
          </label>
          <input
            id="assistant-journees"
            name="journees"
            type="number"
            min={1}
            max={JOURNEES_MAX}
            className={formulaire.saisie}
            value={journees}
            onChange={(evenement) => setJournees(evenement.target.value)}
          />
          <p className={formulaire.sousChamp}>
            <span>Une journée = un week-end de jeu. {JOURNEES_MAX} au maximum.</span>
          </p>
        </div>

        <div className={formulaire.champ}>
          <label className={formulaire.label} htmlFor="assistant-manches">
            Combien de manches par journée ?
          </label>
          <input
            id="assistant-manches"
            name="manchesParJournee"
            type="number"
            min={1}
            max={MANCHES_PAR_JOURNEE_MAX}
            className={formulaire.saisie}
            value={manches}
            onChange={(evenement) => setManches(evenement.target.value)}
          />
          <p className={formulaire.sousChamp}>
            <span>
              Le nombre de fois qu&rsquo;on refait les tables dans la journée.{" "}
              {MANCHES_PAR_JOURNEE_MAX} au maximum.
            </span>
          </p>
        </div>
      </div>

      <div className={formulaire.champ}>
        <label className={formulaire.label} htmlFor="assistant-premierJour">
          Le jour de la première journée (facultatif)
        </label>
        <input
          id="assistant-premierJour"
          name="premierJour"
          type="date"
          className={formulaire.saisie}
          value={premierJour}
          onChange={(evenement) => setPremierJour(evenement.target.value)}
        />
        <p className={formulaire.sousChamp}>
          <span>
            Les journées suivantes tombent de <strong>semaine en semaine</strong>. Si votre
            rythme est différent, corrigez les dates ensuite, phase par phase.
          </span>
        </p>
      </div>

      <div className={formulaire.champ}>
        <label className={formulaire.choixLabel}>
          <input
            type="checkbox"
            name="finale"
            value="true"
            checked={finale}
            onChange={(evenement) => setFinale(evenement.target.checked)}
          />
          Terminer par une finale
        </label>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════════════
          CE QUI SERA ÉCRIT, AVANT DE CLIQUER — et ça occupe une vraie place
          ══════════════════════════════════════════════════════════════════════════════
          🔴 C'est ce qui fait de ce formulaire une assistance et non une génération
          automatique. Il est rendu ICI, entre les réglages et le bouton : c'est l'ordre dans
          lequel on décide — je règle, je regarde, je valide. */}
      {apercu ? (
        <section className={styles.apercu} aria-live="polite">
          <h4 className={styles.apercuTitre}>
            Ce qui sera créé — {apercu.length} phase{apercu.length > 1 ? "s" : ""}
          </h4>

          <ol className={styles.groupes}>
            {groupes.map((groupe, rang) => {
              const numero = numeroDeJournee(groupes, rang);
              return (
                <li key={`${groupe.jour ?? "sans-date"}-${rang}`} className={styles.groupe}>
                  <p className={styles.groupeTitre}>
                    {numero === null ? (
                      "Sans jour fixé"
                    ) : (
                      <>
                        <span className={styles.groupeNumero}>Journée {numero}</span>
                        {groupe.jour ? (
                          <time className={styles.groupeDate} dateTime={groupe.jour}>
                            {jourLisible(groupe.jour)}
                          </time>
                        ) : null}
                      </>
                    )}
                  </p>
                  <ul className={styles.manches}>
                    {groupe.phases.map(({ phase }) => (
                      <li key={phase.name} className={styles.manche}>
                        <span className={styles.mancheNom}>{phase.name}</span>
                        <span className={styles.mancheNature}>{LIBELLE_NATURE[phase.kind]}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>

          <p className={styles.apercuRegle}>
            La <strong>première</strong> manche part des présents ; les suivantes se composent
            d&rsquo;après le <strong>classement</strong>, c&rsquo;est ce qui les rend suisses.
            Tout se renomme et se déplace ensuite, tant qu&rsquo;aucun résultat n&rsquo;est
            saisi.
          </p>
        </section>
      ) : (
        /* ⚠️ L'aperçu disparaît dès qu'une saisie ne s'interprète pas. Sans cette phrase, le
           bloc s'évanouit sans raison visible et on croit à une panne. */
        <p className={styles.apercuVide} aria-live="polite">
          Indiquez un nombre de journées et de manches pour voir la structure proposée.
        </p>
      )}

      <div className={formulaire.actions}>
        <button type="submit" className={actions.bouton} disabled={enTransition || !apercu}>
          {enTransition ? "…" : "Créer ce déroulé"}
        </button>
      </div>

      {erreur && (
        <p role="alert" className={formulaire.erreur}>
          {erreur}
        </p>
      )}
    </form>
  );
}
