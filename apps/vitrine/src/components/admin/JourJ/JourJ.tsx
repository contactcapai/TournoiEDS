"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@repo/ui";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import { LIBELLE_NATURE } from "@/lib/schemas/phase";
import {
  TAILLE_LOBBY_DEFAUT,
  TAILLE_LOBBY_MAX,
  TAILLE_LOBBY_MIN,
} from "@/lib/tournoi/generation";
import { estParTables, partDuClassement, type PhaseKind } from "@/lib/tournoi/structure";
import { tirageAJour, type EcartsDeTirage } from "@/lib/tournoi/tirage";
import { effacerRencontres, genererPhase, saisirResultat } from "@/server/actions/rencontres";
import type { RencontreJouable } from "@/server/db/queries/rencontres";
import actions from "@/styles/admin-actions.module.css";
import formulaire from "@/styles/admin-form.module.css";
import styles from "./JourJ.module.css";

/**
 * Le jour J d'une phase : générer, jouer, saisir (Story 10.8).
 *
 * 🔴 DESSINÉ POUR 64 JOUEURS DÈS LA PREMIÈRE VERSION — leçon payée sur l'écran des engagés le
 * 2026-08-15 (*« c'est bien mais c'est gros, imagine 64 joueurs »*). Un TFT à 64 donne 8 tables
 * de 8, soit 64 lignes de saisie : ce qui coûte PAR LIGNE reste hors de la ligne, et les
 * explications se disent une fois.
 *
 * 🔴 LES RÉGLAGES DU FORMAT SE CHOISISSENT **ICI**, au moment de générer — et ils sont
 * ENREGISTRÉS. C'est ce qui les rend atteignables : la 10.5 a buté sur `team_size`, écrit nulle
 * part, donc une capacité entière hors d'atteinte. On annonce un tournoi des semaines avant, on
 * choisit son format quand on sait qui est là.
 */

const LIBELLE_TABLEAU: Record<string, string> = {
  principal: "",
  vainqueurs: "Tableau des vainqueurs",
  perdants: "Tableau des perdants",
  grande_finale: "Grande finale",
};

export interface JourJProps {
  phase: {
    id: string;
    name: string;
    kind: PhaseKind;
    settings: { tailleDeLobby?: number; doubleElimination?: boolean; allerRetour?: boolean };
  };
  rencontres: readonly RencontreJouable[];
  /** Combien d'engagés sont pointés « présent ». C'est l'effectif que la génération utilisera. */
  presents: number;
  /**
   * Ce qui a changé entre le tirage et maintenant (Story 10.13). Calculé par la page, sur des
   * données qu'elle avait déjà — ce composant ne décide de rien, il écrit ce qu'on lui dit.
   */
  ecarts: EcartsDeTirage;
  /** Vrai dès qu'un résultat existe dans le tournoi — alors « depuis le classement » a un sens. */
  aUnClassement: boolean;
  /** Vrai dès qu'un résultat est saisi dans CETTE phase : plus de régénération. */
  aDesResultats: boolean;
}

export function JourJ({
  phase,
  rencontres,
  presents,
  ecarts,
  aUnClassement,
  aDesResultats,
}: JourJProps) {
  const router = useRouter();
  const [enTransition, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [messageParRencontre, setMessageParRencontre] = useState<Record<string, string>>({});

  const parTables = estParTables(phase.kind);
  const tailleActuelle = phase.settings.tailleDeLobby ?? TAILLE_LOBBY_DEFAUT;

  const generer = (donnees: FormData) => {
    demarrer(async () => {
      setErreur(null);
      try {
        const resultat = await genererPhase(phase.id, donnees);
        if (!resultat.ok) {
          setErreur(resultat.error);
          return;
        }
        router.refresh();
      } catch {
        setErreur("Votre session n'est plus valide. Rechargez la page et reconnectez-vous.");
      }
    });
  };

  const saisir = (matchId: string, donnees: FormData) => {
    demarrer(async () => {
      setErreur(null);
      try {
        const resultat = await saisirResultat(matchId, donnees);
        if (!resultat.ok) {
          setMessageParRencontre((precedent) => ({ ...precedent, [matchId]: resultat.error }));
          return;
        }
        setMessageParRencontre((precedent) => ({
          ...precedent,
          // 🔴 UNE SAISIE PARTIELLE EST ENREGISTRÉE ET LE DIT : sans ce message, remplir un lobby
          // de 8 en trois fois donnerait l'impression que rien n'a été pris en compte.
          [matchId]: resultat.data.complete
            ? "Enregistré."
            : `Enregistré, mais pas encore dépouillé : ${resultat.data.raison ?? ""}`,
        }));
        router.refresh();
      } catch {
        setErreur("Votre session n'est plus valide. Rechargez la page et reconnectez-vous.");
      }
    });
  };

  // ── Rien de généré : le formulaire de génération, et lui seul ────────────────────────
  if (rencontres.length === 0) {
    return (
      <div className={styles.bloc}>
        <p className={styles.vide}>
          Cette phase n&rsquo;a pas encore de rencontres.{" "}
          {presents === 0 ? (
            <>
              Et <strong>aucun engagé n&rsquo;est pointé « présent »</strong> : commencez par le
              pointage, sinon il n&rsquo;y a personne à faire jouer.
            </>
          ) : (
            <>
              <strong>
                {presents} engagé{presents > 1 ? "s" : ""} pointé{presents > 1 ? "s" : ""} présent
                {presents > 1 ? "s" : ""}
              </strong>{" "}
              — c&rsquo;est l&rsquo;effectif qui sera utilisé.
            </>
          )}
        </p>

        <form action={generer} className={formulaire.form}>
          <h3 className={styles.titreForm}>Générer — {LIBELLE_NATURE[phase.kind]}</h3>

          {parTables ? (
            <div className={formulaire.champ}>
              <label className={formulaire.label} htmlFor="jourj-taille">
                Joueurs par table
              </label>
              <input
                className={formulaire.saisie}
                id="jourj-taille"
                name="tailleDeLobby"
                type="number"
                min={TAILLE_LOBBY_MIN}
                max={TAILLE_LOBBY_MAX}
                defaultValue={tailleActuelle}
              />
              <p className={formulaire.sousChamp}>
                <span>
                  {phase.kind === "finale"
                    ? "La finale est UNE table : ce nombre dit combien de joueurs y montent."
                    : "Les tables sont équilibrées, jamais découpées en tranches : 17 joueurs pour une cible de 8 donnent 6, 6 et 5 — pas 8, 8 et 1."}
                </span>
              </p>
            </div>
          ) : null}

          {phase.kind === "bracket" ? (
            <div className={formulaire.champ}>
              <span className={formulaire.legend}>Format du tableau</span>
              <label className={formulaire.choixLabel}>
                <input type="checkbox" name="doubleElimination" value="true" />
                Double élimination (tableau des perdants)
              </label>
              <p className={formulaire.sousChamp}>
                <span>
                  En double élimination, une première défaite n&rsquo;élimine pas : le joueur
                  descend dans le tableau des perdants.
                </span>
              </p>
            </div>
          ) : null}

          {phase.kind === "poule" ? (
            <div className={formulaire.champ}>
              <span className={formulaire.legend}>Format de la poule</span>
              <label className={formulaire.choixLabel}>
                <input type="checkbox" name="allerRetour" value="true" />
                Aller-retour (chaque paire se joue deux fois)
              </label>
            </div>
          ) : null}

          {/* 🔴 L'ORDRE DES PARTICIPANTS EST LA DÉCISION QUI COMPTE, et elle est prise ici —
              SAUF pour une phase « Manche suisse », qui porte la réponse dans son format. On
              ne pose donc plus la question : un choix dont une seule réponse est correcte
              n'est pas un choix, c'est une occasion de se tromper au 3e week-end. */}
          {partDuClassement(phase.kind) ? (
            <p className={formulaire.regle}>
              Cette phase est une <strong>manche suisse</strong> : les tables se composent
              d&rsquo;après le <strong>classement actuel</strong>, pour que chacun rejoue contre
              son niveau. {aUnClassement ? null : (
                <>
                  Aucun résultat n&rsquo;est encore saisi — jouez d&rsquo;abord une première
                  manche.
                </>
              )}
            </p>
          ) : (
          <div className={formulaire.champ}>
            <span className={formulaire.legend}>Qui entre, et dans quel ordre</span>
            <label className={formulaire.choixLabel}>
              <input type="radio" name="depuis" value="presents" defaultChecked />
              Les présents, dans l&rsquo;ordre de saisie
            </label>
            <label className={formulaire.choixLabel}>
              <input type="radio" name="depuis" value="classement" disabled={!aUnClassement} />
              Le classement actuel {aUnClassement ? "" : "(aucun résultat pour l’instant)"}
            </label>
            <p className={formulaire.sousChamp}>
              <span>
                Pour une <strong>première</strong> manche, prenez les présents. Pour une manche
                suivante ou une <strong>finale</strong>, prenez le classement : c&rsquo;est ce qui
                met les meilleurs ensemble.
              </span>
            </p>
          </div>
          )}

          <div className={formulaire.actions}>
            <Button type="submit">{enTransition ? "Génération…" : "Générer les rencontres"}</Button>
          </div>
        </form>

        {erreur ? (
          <p className={formulaire.erreur} role="alert">
            {erreur}
          </p>
        ) : null}
      </div>
    );
  }

  // ── Généré : les rencontres, groupées par tableau puis par tour ──────────────────────
  const groupes = new Map<string, RencontreJouable[]>();
  for (const rencontre of rencontres) {
    const clef = `${rencontre.bracket}|${rencontre.round ?? 1}`;
    const liste = groupes.get(clef);
    if (liste) liste.push(rencontre);
    else groupes.set(clef, [rencontre]);
  }

  const dépouillées = rencontres.filter((r) => r.issue.complete).length;

  return (
    <div className={styles.bloc}>
      <div className={styles.enTete}>
        <p className={styles.compte} role="status">
          <strong>
            {dépouillées} rencontre{dépouillées > 1 ? "s" : ""} dépouillée
            {dépouillées > 1 ? "s" : ""}
          </strong>{" "}
          sur {rencontres.length}
        </p>
        {/* ══════════════════════════════════════════════════════════════════════════════
            LE TIRAGE N'EST PLUS À JOUR — ET C'EST LE POINT DE TOUTE LA STORY 10.13
            ══════════════════════════════════════════════════════════════════════════════
            Régénérer était DÉJÀ possible : l'action le fait, sa garde est la bonne, le bouton
            est juste en dessous. Ce qui manquait, c'est que personne ne savait qu'il fallait
            le presser. ⚠️ Il NOMME les gens : « des engagés ont changé » obligerait à ouvrir
            l'écran des engagés pour deviner lesquels, un jour de tournoi, debout.

            ⚠️ AFFICHÉ SEULEMENT QUAND LA RÉGÉNÉRATION EST POSSIBLE, et c'est délibéré : dès
            qu'un résultat est saisi, la manche est jouée et il n'y a plus de geste à faire.
            Un avertissement sans issue est du bruit — l'écran dit déjà, juste en dessous,
            pourquoi la phase ne se régénère plus. */}
        {!aDesResultats && !tirageAJour(ecarts) ? (
          <p className={styles.tirage} role="status">
            <strong>Le tirage n&rsquo;est plus à jour.</strong>{" "}
            {ecarts.partis.length > 0 ? (
              <>
                {ecarts.partis.map((e) => e.nom).join(", ")}{" "}
                {ecarts.partis.length > 1 ? "ne sont plus présents" : "n'est plus présent"}{" "}
                depuis le tirage
                {ecarts.arrives.length > 0 ? " ; " : ". "}
              </>
            ) : null}
            {ecarts.arrives.length > 0 ? (
              <>
                {ecarts.arrives.map((e) => e.nom).join(", ")}{" "}
                {ecarts.arrives.length > 1 ? "sont arrivés" : "est arrivé"} après et
                n&rsquo;{ecarts.arrives.length > 1 ? "ont" : "a"} pas de table.{" "}
              </>
            ) : null}
            {/* ⚠️ La conséquence est ÉCRITE, pas sous-entendue : les points d'une manche
                suivent la taille RÉELLE de la table (10.3). Une table qui joue à sept sans
                qu'on l'ait voulu fausse le classement de toute la manche. */}
            Refaites le tirage ci-dessous, sinon une table jouera à un effectif qui n&rsquo;est
            pas le bon — et les points suivent la taille réelle de la table.
          </p>
        ) : null}

        <div className={actions.bloc}>
          {aDesResultats ? (
            /* ⚠️ Dit, pas deviné : le bouton n'est pas grisé sans explication. */
            <p className={styles.verrou}>
              Des résultats sont saisis : cette phase ne se régénère plus.
            </p>
          ) : (
            <BoutonConfirmation
              libelle="Effacer et refaire"
              question={`Effacer les ${rencontres.length} rencontres de « ${phase.name} » ?`}
              precision={
                "Aucun résultat n’y est saisi, donc rien de joué n’est perdu. Vous pourrez " +
                "regénérer avec d’autres réglages, ou après avoir corrigé le pointage."
              }
              libelleConfirmation="Oui, effacer"
              libelleEnCours="Effacement…"
              onConfirmer={async () => {
                const resultat = await effacerRencontres(phase.id);
                if (resultat.ok) router.refresh();
                return resultat.ok ? { ok: true } : { ok: false, error: resultat.error };
              }}
            />
          )}
        </div>
      </div>

      {/* ⚠️ Les règles de saisie, dites UNE fois — pas sur chacune des 64 lignes. */}
      <p className={formulaire.regle} role="note">
        {parTables ? (
          <>
            <strong>Saisissez la place de chacun</strong>, de 1 au nombre de joueurs assis à la
            table. Une place ne peut pas être attribuée deux fois, et un joueur qui manque à
            l&rsquo;appel se retire depuis l&rsquo;écran des engagés — les points suivent la
            taille RÉELLE de la table.
          </>
        ) : (
          <>
            <strong>Saisissez le score de chaque côté.</strong> Le vainqueur monte au tour suivant
            tout seul. Une <strong>égalité</strong> ne désigne personne : départagez avant de
            continuer. Corriger un score plus tard reprend tout l&rsquo;aval — les rencontres qui
            en dépendaient repassent en attente.
          </>
        )}
      </p>

      {[...groupes.entries()].map(([clef, groupe]) => {
        const [bracket, round] = clef.split("|");
        const titre = [LIBELLE_TABLEAU[bracket], `Tour ${round}`].filter(Boolean).join(" — ");

        return (
          <section key={clef} className={styles.groupe} aria-label={titre}>
            <h3 className={styles.titreGroupe}>
              {parTables ? `Manche ${round}` : titre}
            </h3>

            <ul className={styles.liste}>
              {groupe.map((rencontre) => {
                const occupees = rencontre.places.filter((p) => p.entryId !== null);
                const parRang = rencontre.places.length > 2;

                return (
                  <li key={rencontre.matchId} className={styles.rencontre}>
                    <form
                      className={styles.ligne}
                      action={(donnees) => saisir(rencontre.matchId, donnees)}
                    >
                      <p className={styles.rang}>
                        {parTables ? `Table ${rencontre.position}` : `#${rencontre.position}`}
                      </p>

                      <div className={styles.places}>
                        {rencontre.places.map((place) => (
                          <div key={place.slotId} className={styles.place}>
                            <span className={styles.nom}>
                              {place.nom ?? (
                                <em className={styles.attente}>
                                  {place.source?.de === "tete_de_serie"
                                    ? "exemption"
                                    : "en attente"}
                                </em>
                              )}
                            </span>
                            {place.entryId !== null ? (
                              <input
                                className={styles.saisie}
                                name={`${parRang ? "rang" : "score"}-${place.slotId}`}
                                type="number"
                                min={parRang ? 1 : 0}
                                max={parRang ? occupees.length : undefined}
                                defaultValue={
                                  (parRang ? place.rank : place.score) ?? ""
                                }
                                aria-label={`${parRang ? "Place" : "Score"} de ${place.nom ?? ""}`}
                              />
                            ) : null}
                          </div>
                        ))}
                      </div>

                      <div className={styles.fin}>
                        <button
                          type="submit"
                          className={actions.bascule}
                          disabled={enTransition || occupees.length === 0}
                        >
                          Enregistrer
                          <span className="sr-only"> — rencontre {rencontre.position}</span>
                        </button>
                      </div>

                      <p className={styles.etat}>
                        {rencontre.issue.exemption
                          ? "Exemption — passe sans jouer."
                          : rencontre.issue.complete
                            ? `Vainqueur : ${rencontre.places.find((p) => p.entryId === rencontre.issue.vainqueur)?.nom ?? "—"}`
                            : (messageParRencontre[rencontre.matchId] ?? rencontre.issue.raison)}
                      </p>
                    </form>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {erreur ? (
        <p className={formulaire.erreur} role="alert">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
