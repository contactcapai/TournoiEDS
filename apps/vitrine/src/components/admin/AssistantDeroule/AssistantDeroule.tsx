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
import { poserDerouleType } from "@/server/actions/phases";
import actions from "@/styles/admin-actions.module.css";
import formulaire from "@/styles/admin-form.module.css";

/**
 * L'assistant de déroulé — pose un TFT complet en une fois (2026-08-24).
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
 * qu'on a lu, et autre chose serait écrit.
 *
 * ⚠️ Apparence volontairement minimale : les écrans de l'espace tournoi sont en cours de
 * refonte (Stitch, 2026-08-24). Ce composant consomme le vocabulaire de formulaire existant et
 * n'invente aucun style — c'est le FOND qui est livré ici.
 */
export function AssistantDeroule({ tournoiId }: { tournoiId: string }) {
  const router = useRouter();
  const [enTransition, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);

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

  const soumettre = (donnees: FormData) => {
    demarrer(async () => {
      const resultat = await poserDerouleType(tournoiId, donnees);
      if (resultat.ok) {
        setErreur(null);
        setOuvert(false);
        router.refresh();
        return;
      }
      setErreur(resultat.error);
    });
  };

  if (!ouvert) {
    return (
      <div className={formulaire.regle}>
        <p>
          <strong>Un tournoi sur plusieurs week-ends ?</strong> L&rsquo;assistant pose les
          journées, leurs manches et leurs dates d&rsquo;un coup — vous corrigez ensuite ce que
          vous voulez.
        </p>
        <div className={formulaire.actions}>
          <button type="button" className={actions.bouton} onClick={() => setOuvert(true)}>
            Composer un déroulé type
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={soumettre} className={formulaire.form}>
      <h3 className={formulaire.legend}>Composer un déroulé type</h3>

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

      {/* 🔴 CE QUI SERA ÉCRIT, AVANT DE CLIQUER. C'est ce qui fait de ce formulaire une
          assistance et non une génération automatique. */}
      {apercu ? (
        <div className={formulaire.regle}>
          <p>
            <strong>
              {apercu.length} phase{apercu.length > 1 ? "s" : ""} seront créées :
            </strong>
          </p>
          <ol>
            {apercu.map((phase) => (
              <li key={phase.name}>
                {phase.name} — {LIBELLE_NATURE[phase.kind]}
                {phase.playedOn ? ` — ${jourLisible(phase.playedOn)}` : ""}
              </li>
            ))}
          </ol>
          <p>
            La <strong>première</strong> manche part des présents ; les suivantes se composent
            d&rsquo;après le <strong>classement</strong>, c&rsquo;est ce qui les rend suisses.
          </p>
        </div>
      ) : null}

      <div className={formulaire.actions}>
        <button type="submit" className={actions.bouton} disabled={enTransition || !apercu}>
          {enTransition ? "…" : "Créer ces phases"}
        </button>
        <button type="button" className={actions.bouton} onClick={() => setOuvert(false)}>
          Annuler
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
