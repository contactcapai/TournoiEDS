"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AssistantDeroule } from "@/components/admin/AssistantDeroule/AssistantDeroule";
import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import { ChampTexte } from "@/components/admin/ChampTexte/ChampTexte";
import { jourLisible } from "@/lib/date-paris";
import { AIDE_NATURE, LIBELLE_NATURE, NOM_PHASE_MAX, NOM_SUGGERE } from "@/lib/schemas/phase";
import { decouperEnJournees, numeroDeJournee } from "@/lib/tournoi/journees";
import { ORDRE_FORMATS, type PhaseKind } from "@/lib/tournoi/structure";
import { ajouterPhase, deplacerPhase, supprimerPhase } from "@/server/actions/phases";
import type { PhaseListee } from "@/server/db/queries/phases";
import actions from "@/styles/admin-actions.module.css";
import formulaire from "@/styles/admin-form.module.css";
import styles from "./PhasesTournoi.module.css";

/**
 * Composition d'un tournoi : la liste ordonnée de ses phases (Story 10.4, refondue en 10.9,
 * apparence en 13.1).
 *
 * 🔴 UNE PHASE QUI A DES RÉSULTATS NE SE DÉPLACE NI NE SE SUPPRIME, et l'écran le DIT au lieu
 * de désactiver un bouton en silence. Le serveur refuse de toute façon — la garde d'ici sert à
 * ce que personne ne l'apprenne après avoir cliqué.
 *
 * 🔴 CE QUE LA 13.1 A CHANGÉ — deux choses, et aucune ne touche au fond.
 *   ① Le déroulé se lit **groupé par journée**. Neuf phases à plat ne disent pas qu'un TFT
 *      s'étale sur quatre week-ends ; « Journée 2 — samedi 13 septembre » le dit d'un coup.
 *   ② Sur un déroulé **vide**, l'assistant n'est plus replié derrière un bouton : il occupe la
 *      colonne principale, prévisualisation comprise, et la saisie manuelle reste visible À
 *      CÔTÉ sous « ou composez à la main ». Une assistance qu'il faut déplier est trouvée par
 *      qui la cherche, c'est-à-dire par qui n'en a pas besoin.
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
  const [jour, setJour] = useState("");

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
        // ⚠️ LE JOUR N'EST PAS RÉINITIALISÉ, à la différence du nom et du format : on saisit
        // plusieurs manches d'une MÊME journée à la suite, et le remettre à vide obligerait à
        // le retaper à chaque fois. C'est le seul champ dont la valeur précédente sert encore.
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

  const journees = decouperEnJournees(phases);

  /**
   * ⚠️ UN SEUL GROUPE ⇒ AUCUN GROUPEMENT. Un tournoi qui tient sur une journée — donc tous
   * ceux d'avant le 2026-08-24, `playedOn` étant nullable — n'a pas de journée à nommer, et
   * lui dessiner un « Journée 1 » serait un intitulé creux qui laisse croire qu'il en manque.
   */
  const groupe = journees.length > 1;

  const ligne = ({ phase, index }: { phase: PhaseListee; index: number }) => (
    <li key={phase.id} className={styles.phase}>
      <span className={styles.rang} aria-hidden="true">
        {phase.position}
      </span>

      <div className={styles.corps}>
        <p className={styles.nom}>
          <span className="sr-only">Phase {phase.position} — </span>
          {phase.name}
        </p>
        {/* Une seule ligne d'état, séparateurs au milieu : la version d'avant en empilait deux
            par phase, ce qui rendait une liste de six illisible.
            ⚠️ LA DATE N'Y FIGURE PLUS QUAND LE DÉROULÉ EST GROUPÉ — l'en-tête de journée la
            porte déjà, et la répéter à chaque manche fait lire quatre fois « samedi 6 ». */}
        <p className={styles.etat}>
          {phase.playedOn && !groupe ? (
            <>
              <time dateTime={phase.playedOn}>{jourLisible(phase.playedOn)}</time>
              {" · "}
            </>
          ) : null}
          {LIBELLE_NATURE[phase.kind]}
          {" · "}
          {phase.rencontres === 0
            ? "aucune rencontre générée"
            : `${phase.rencontres} rencontre${phase.rencontres > 1 ? "s" : ""}`}
        </p>
      </div>

      {/* 🔴 PREMIER CONSOMMATEUR DU CORAIL `--alert` (PR #73) : une règle qui BLOQUE. Elle
          était en or jusqu'ici, c'est-à-dire de la couleur de ce qu'on met en avant — or ce
          n'est pas une mise en avant, c'est un refus. Elle reste un MOT et pas une couleur
          seule (AA), et garde sa place AVANT les commandes qu'elle explique. */}
      {!phase.librementModifiable ? (
        <p className={styles.figee}>des résultats sont saisis, elle ne bouge plus</p>
      ) : null}

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
          disabled={enTransition || index === phases.length - 1 || !phase.librementModifiable}
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
  );

  const formulaireAjout = (
    <form action={soumettre} className={`${formulaire.form} ${styles.ajout}`}>
      <h3 className={styles.titreAjout}>
        {phases.length === 0 ? "Ou composez à la main" : "Ajouter une phase"}
      </h3>

      {/* 🔴 LES CINQ FORMATS SONT VISIBLES D'UN COUP, chacun avec ce qu'il fait. Un `<select>`
          fermé oblige à l'ouvrir pour découvrir ce qui existe, puis à deviner ce que chaque
          nom recouvre — c'est le « pas très intuitif pour un admin tournoi » du 2026-08-15. */}
      <fieldset className={formulaire.champ}>
        <legend className={formulaire.legend}>Quel format ?</legend>
        <div className={styles.formats}>
          {ORDRE_FORMATS.map((valeur) => (
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

      {/* 🔴 LE JOUR, ET C'EST CE QUI REND UN TOURNOI SUR PLUSIEURS WEEK-ENDS EXPRIMABLE.
          Un `<input type="date">` natif : il poste « 2026-09-06 », exactement la chaîne que
          la colonne attend, sans qu'aucun `Date` soit construit nulle part. */}
      <div className={formulaire.champ}>
        <label className={formulaire.label} htmlFor="phase-playedOn">
          Le jour de cette phase (facultatif)
        </label>
        <input
          id="phase-playedOn"
          name="playedOn"
          type="date"
          className={formulaire.saisie}
          value={jour}
          onChange={(evenement) => setJour(evenement.target.value)}
          aria-describedby="phase-playedOn-aide"
        />
        <p className={formulaire.sousChamp}>
          <span id="phase-playedOn-aide">
            À renseigner quand le tournoi s&rsquo;étale sur plusieurs journées ou week-ends —
            les phases qui partagent un jour se regroupent alors sous lui. Laissez vide
            s&rsquo;il tient sur une seule.
          </span>
        </p>
        {champs.playedOn && <p className={formulaire.erreur}>{champs.playedOn}</p>}
      </div>

      <div className={formulaire.actions}>
        <button type="submit" className={actions.bouton} disabled={enTransition}>
          {enTransition ? "…" : "Ajouter la phase"}
        </button>
      </div>

      {/* Le format ne se modifie pas après coup : le dire ICI évite de le découvrir en
          cherchant un bouton « Modifier » qui n'existe pas. */}
      <p className={formulaire.regle}>
        Le format d&rsquo;une phase ne se change pas après coup — supprimez-la et recréez-la,
        ce qui reste possible tant qu&rsquo;aucun résultat n&rsquo;est saisi.
      </p>
    </form>
  );

  return (
    <div className={styles.bloc}>
      {phases.length === 0 ? (
        /* ══════════════════════════════════════════════════════════════════════════════════
           JAMAIS DE PAGE BLANCHE — l'assistance MONTRE avant d'écrire, et l'autre porte reste
           ouverte À CÔTÉ, pas derrière un bouton.
           ══════════════════════════════════════════════════════════════════════════════════ */
        <>
          <div className={styles.accroche}>
            <h3 className={styles.accrocheTitre}>Votre tournoi prend forme ici</h3>
            <p className={styles.accrocheTexte}>
              Un déroulé, ce sont des <strong>phases jouées dans l&rsquo;ordre</strong> : une
              poule, un tableau, des manches, une finale. L&rsquo;assistant en pose une
              structure entière d&rsquo;un coup — vous la corrigez ensuite, phase par phase,
              tant qu&rsquo;aucune rencontre n&rsquo;a de résultat.
            </p>
          </div>

          <div className={styles.depart}>
            <AssistantDeroule tournoiId={tournoiId} />
            {formulaireAjout}
          </div>
        </>
      ) : (
        <>
          {groupe ? (
            <div className={styles.journees}>
              {journees.map((journee, rang) => {
                const numero = numeroDeJournee(journees, rang);
                return (
                  <section
                    key={journee.phases[0]?.phase.id ?? rang}
                    className={styles.journee}
                    aria-label={
                      journee.jour === null
                        ? "Phases sans jour fixé"
                        : `Journée ${numero} — ${jourLisible(journee.jour)}`
                    }
                  >
                    <h3 className={styles.journeeTitre}>
                      {journee.jour === null ? (
                        /* ⚠️ Ces phases ne sont pas une anomalie : une finale dont la date
                           n'est pas encore arrêtée est le cas courant. Le dire vaut mieux que
                           les ranger d'office sous la dernière journée — ce serait un faux. */
                        <span className={styles.journeeNumero}>Sans jour fixé</span>
                      ) : (
                        <>
                          <span className={styles.journeeNumero}>Journée {numero}</span>
                          <time className={styles.journeeDate} dateTime={journee.jour}>
                            {jourLisible(journee.jour)}
                          </time>
                        </>
                      )}
                    </h3>
                    <ol className={styles.liste}>{journee.phases.map(ligne)}</ol>
                  </section>
                );
              })}
            </div>
          ) : (
            <ol className={styles.liste}>
              {phases.map((phase, index) => ligne({ phase, index }))}
            </ol>
          )}

          {formulaireAjout}
        </>
      )}

      {erreur && (
        <p role="alert" className={formulaire.erreur}>
          {erreur}
        </p>
      )}
    </div>
  );
}
