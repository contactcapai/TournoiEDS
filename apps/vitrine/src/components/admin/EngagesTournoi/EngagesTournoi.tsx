"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@repo/ui";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import { ChampTexte } from "@/components/admin/ChampTexte/ChampTexte";
import { jourLisible } from "@/lib/date-paris";
import { AIDES_ETAT_ENGAGE, LIBELLES_ETAT_ENGAGE } from "@/lib/libelles-tournoi";
import { engageSaisie, NOM_ENGAGE_MAX, NOM_MEMBRE_MAX } from "@/lib/schemas/engage";
import { ENTRY_STATES, type EntryState } from "@/lib/tournoi/structure";
import { ajouterEngage, pointerEngage, supprimerEngage } from "@/server/actions/engages";
import type { EngagesDuTournoi } from "@/server/db/queries/engages";
import actions from "@/styles/admin-actions.module.css";
import formulaire from "@/styles/admin-form.module.css";
import styles from "./EngagesTournoi.module.css";

/**
 * Les engagés d'un tournoi : saisie à la main et pointage du jour J (Story 10.5).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CETTE LISTE EST DESSINÉE POUR **64 LIGNES**, PAS POUR DIX — correctif du gate visuel
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * La 1ʳᵉ version rendait chaque engagé en **carte** (bordure, fond, 18 px de marge) et
 * répétait sur CHAQUE ligne la phrase qui explique son état. Retour de Brice, 2026-08-15 :
 * *« c'est gros, imagine 64 joueurs »*.
 *
 * ⚠️ **LES CHIFFRES CI-DESSOUS SONT CALCULÉS SUR LA FEUILLE, PAS MESURÉS AU NAVIGATEUR** — la
 * distinction compte dans ce projet, où des « mesures » supposées se sont révélées fausses plus
 * souvent que le code. Ancienne ligne : 2 × 18 px de marge + nom (~30) + phrase d'état sur deux
 * lignes (~46) + boutons (44) + verrou sur deux lignes (~46) + interlignes ≈ **200 px**, soit
 * ~12 800 px pour 64 joueurs. Nouvelle ligne : boutons (44) + 2 × 6 px + filet = **57 px**,
 * soit ~3 650 px. Le rendu réel se regarde sur staging, comme toujours.
 *
 * Ce qui coûtait par ligne a été sorti de la ligne ; ce qui coûte UNE fois est resté :
 *   · la carte devient une **ligne à filet**, ~56 px — le plancher est la cible tactile de
 *     44 px des boutons d'état, pas la mise en page ;
 *   · l'explication de chaque état ne se répète plus : elle est dite **une** fois, au-dessus ;
 *   · le verrou de suppression devient un **fait court** (« Dans 3 rencontres ») au lieu d'un
 *     paragraphe — et en cours de tournoi, c'est PRESQUE TOUTES les lignes qui le portent.
 *
 * ⚠️ **LES LIBELLÉS N'ONT PAS ÉTÉ ABRÉGÉS**, et c'est délibéré. « Absent » et « Abandon »
 * partagent trois lettres : les raccourcir pour gagner de la largeur ferait exactement ce que
 * l'AC 5 interdit — deux libellés proches sur deux gestes que tout oppose. La densité se gagne
 * sur le CHROME, jamais sur les mots (leçon `AtelierActions`, 6.9).
 *
 * ⚠️ **L'EXPLICATION RESTE AU-DESSUS DE LA LISTE, PAS EN DESSOUS.** Elle ne coûte qu'une fois,
 * donc elle n'est pas ce qui rendait l'écran gros — et la placer après 64 lignes la mettrait
 * hors de portée au moment précis où on clique.
 */

/** Ordre VISUEL des champs — c'est lui qui décide où va le focus. */
const ORDRE_CHAMPS = ["displayName", "membres"] as const;

type EtatForm = {
  statut: "vierge" | "succes" | "erreur";
  error?: string;
  fieldErrors?: Record<string, string>;
};

const ETAT_INITIAL: EtatForm = { statut: "vierge" };

export interface EngagesTournoiProps {
  tournoiId: string;
  /**
   * L'effectif attendu par ce tournoi. Vient de la BASE et traverse cet écran sans être
   * modifiable : le serveur le relit de toute façon, il ne fait jamais confiance au formulaire.
   */
  teamSize: number;
  /** La journée pointée, ou `null` pour l'état global du tournoi (2026-08-24). */
  jour: string | null;
  donnees: EngagesDuTournoi;
}

export function EngagesTournoi({ tournoiId, teamSize, donnees, jour }: EngagesTournoiProps) {
  const router = useRouter();
  const individuel = teamSize === 1;

  const [displayName, setDisplayName] = useState("");
  const [membres, setMembres] = useState<string[]>(() => Array.from({ length: teamSize }, () => ""));

  const [, demarrer] = useTransition();
  const [erreurListe, setErreurListe] = useState<string | null>(null);
  /**
   * 🔴 L'ATTENTE EST **PAR LIGNE**, PAS GLOBALE. Un seul drapeau `enTransition` désactivait les
   * 4 boutons des 64 lignes — 256 commandes gelées — pendant le pointage d'une seule personne.
   * Sur dix lignes ça ne se voyait pas ; à 64, tout le tableau a l'air mort à chaque clic.
   */
  const [enCoursId, setEnCoursId] = useState<string | null>(null);

  const [etat, soumettre, enCours] = useActionState(
    async (_precedent: EtatForm, formData: FormData): Promise<EtatForm> => {
      // Validation CLIENT avec le MÊME schéma que le serveur (patron `AtelierForm`, 6.9) :
      // le focus au premier champ en erreur n'attend pas un aller-retour réseau. Le serveur
      // re-valide quand même — c'est lui qui tranche, et lui seul connaît `teamSize`.
      const analyse = engageSaisie(teamSize).safeParse({
        displayName: formData.get("displayName"),
        membres: formData.getAll("membre").map((valeur) => String(valeur)),
      });

      if (!analyse.success) {
        const fieldErrors: Record<string, string> = {};
        for (const souci of analyse.error.issues) {
          const clef = souci.path[0];
          if (typeof clef === "string" && !(clef in fieldErrors)) fieldErrors[clef] = souci.message;
        }
        return {
          statut: "erreur",
          error: analyse.error.issues[0]?.message ?? "Vérifiez la saisie.",
          fieldErrors,
        };
      }

      try {
        const resultat = await ajouterEngage(tournoiId, formData);
        if (!resultat.ok) {
          return { statut: "erreur", error: resultat.error, fieldErrors: resultat.fieldErrors };
        }
        // Les champs sont CONTRÔLÉS : ils ne se vident pas tout seuls. On les remet à blanc
        // ici, et seulement au succès — un échec ne doit jamais faire perdre la saisie.
        setDisplayName("");
        setMembres(Array.from({ length: teamSize }, () => ""));
        router.refresh();
        return { statut: "succes" };
      } catch {
        // 🔴 `requireAdmin()` LÈVE avant le `try` de la Server Action : une session expirée ou
        // un compte retiré de l'allowlist arrive ici, et nulle part ailleurs (leçon 6.3).
        return {
          statut: "erreur",
          error:
            "Votre session n'est plus valide, ou le réseau a échoué. Rechargez la page et " +
            "reconnectez-vous — ce que vous avez tapé est toujours à l'écran.",
        };
      }
    },
    ETAT_INITIAL,
  );

  useEffect(() => {
    if (!etat.fieldErrors) return;
    const premier = ORDRE_CHAMPS.find((champ) => etat.fieldErrors?.[champ]);
    if (premier === "displayName") document.getElementById("engage-displayName")?.focus();
    else if (premier === "membres") document.getElementById("engage-membre-0")?.focus();
  }, [etat.fieldErrors]);

  const erreurs = etat.fieldErrors ?? {};
  const { engages, parEtat, total, tronquee } = donnees;

  const pointer = (id: string, nom: string, cible: EntryState) => {
    setEnCoursId(id);
    demarrer(async () => {
      setErreurListe(null);
      try {
        // ⚠️ LE JOUR EST TRANSMIS, ET C'EST CE QUI ÉVITE D'ÉCRASER LA SEMAINE PRÉCÉDENTE.
        // `null` ⇒ on pointe l'état global du tournoi, comme avant le 2026-08-24.
        const resultat = await pointerEngage(id, cible, jour);
        if (!resultat.ok) {
          setErreurListe(resultat.error);
          return;
        }
        router.refresh();
      } catch {
        setErreurListe(
          `Le pointage de « ${nom} » n'a pas abouti : votre session n'est plus valide, ou le ` +
            "réseau a échoué. Rechargez la page.",
        );
      } finally {
        setEnCoursId(null);
      }
    });
  };

  return (
    <div className={styles.bloc}>
      {/* ══════════════════════════════════════════════════════════════════════════════════
          LE COMPTE DES PRÉSENTS — AC 7, ET C'EST CE QUE LA STORY 10.8 CONSOMMERA
          ══════════════════════════════════════════════════════════════════════════════
          🔴 « SUR N ENGAGÉS » ET NON « SUR N INSCRITS », alors que le dossier de story écrivait
          « inscrits ». Le mot est ambigu SUR CET ÉCRAN PRÉCIS, et nulle part ailleurs :
          `inscrit` y est aussi le nom d'un ÉTAT (« pas encore pointé »). « 7 présents sur 9
          inscrits » se lirait donc « 7 présents parmi les 9 qui ne sont pas encore pointés »,
          c'est-à-dire une phrase qui se contredit. Le détail par état est donné juste dessous,
          où chaque mot a son sens strict. */}
      <div className={styles.enTete}>
        {/* 🔴 LE COMPTEUR NOMME LA JOURNÉE QU'IL COMPTE (13.1). Il SUIT déjà la journée choisie
            depuis la 10.12 — mais sans le dire : « 48 présents » au-dessus d'un tableau pointé
            samedi 13 se lit comme un total du tournoi, et c'est le genre d'écart qu'on ne
            remarque qu'en recomptant à la main un jour de tournoi. */}
        <p className={styles.compte} role="status">
          {total === 0 ? (
            "Aucun engagé pour l’instant."
          ) : (
            <>
              <strong>
                {parEtat.present} présent{parEtat.present > 1 ? "s" : ""}
              </strong>{" "}
              sur {total} engagé{total > 1 ? "s" : ""}
              {jour !== null ? (
                <>
                  {" — "}
                  <time className={styles.compteJour} dateTime={jour}>
                    {jourLisible(jour)}
                  </time>
                </>
              ) : null}
            </>
          )}
        </p>

        {total > 0 ? (
          <p className={styles.detail}>
            {parEtat.inscrit} pas encore pointé{parEtat.inscrit > 1 ? "s" : ""} ·{" "}
            {parEtat.absent} absent{parEtat.absent > 1 ? "s" : ""} · {parEtat.abandonne} abandon
            {parEtat.abandonne > 1 ? "s" : ""}
          </p>
        ) : null}
      </div>

      {tronquee ? (
        /* ⚠️ Une troncature silencieuse se lit exactement comme « tout va bien ». Le décompte
           ci-dessus, lui, porte sur la table entière — il ne ment pas. */
        <p className={formulaire.avertissement} role="note">
          Cette liste n&rsquo;affiche que les {engages.length} premiers engagés. Le décompte
          ci-dessus porte bien sur les {total}.
        </p>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════════════════════════
          🔴 CE QUE CHAQUE POINTAGE VEUT DIRE — AC 5, DIT UNE FOIS ET AVANT LE GESTE
          ══════════════════════════════════════════════════════════════════════════════
          « Absent » et « a abandonné » se ressemblent en français courant et n'ont rien à voir
          ici : le second garde ses points au classement. Ce bloc est un livrable, pas une
          décoration — sans lui, le mauvais bouton se clique de bonne foi.
          ⚠️ Il porte AUSSI le refus de suppression, qui vivait auparavant en toutes lettres sur
          CHAQUE ligne verrouillée — c'est-à-dire, en cours de tournoi, sur presque toutes. */}
      <p className={formulaire.regle} role="note">
        <strong>Absent</strong> : {AIDES_ETAT_ENGAGE.absent}
        <br />
        <strong>A abandonné</strong> : {AIDES_ETAT_ENGAGE.abandonne}
        <br />
        <strong>Suppression</strong> : un engagé qui figure déjà dans une rencontre ne se
        supprime plus — sa ligne indique alors dans combien. S&rsquo;il a arrêté en cours de
        route, marquez-le « a abandonné ».
      </p>

      {engages.length === 0 ? (
        <p className={styles.vide}>
          Personne n&rsquo;est encore engagé sur ce tournoi. Saisissez-les ci-dessous —{" "}
          {individuel ? "un nom par joueur" : `un nom d’équipe et ses ${teamSize} joueurs`} —,
          puis pointez-les le jour J. C&rsquo;est ce pointage qui dira qui entre réellement dans
          le tableau.
        </p>
      ) : (
        /* ══════════════════════════════════════════════════════════════════════════════════
           🔴 UN TABLEAU, PARCE QUE LES COLONNES DOIVENT SE NOMMER — AC de la 13.1
           ══════════════════════════════════════════════════════════════════════════════
           La 10.12 a rendu le pointage PAR JOURNÉE, mais l'écran ne portait aucun en-tête :
           les mêmes quatre boutons signifiaient « état dans le tournoi » ou « présence ce
           samedi » selon un onglet situé bien plus haut. Deux gestes qu'on ne distingue qu'en
           se souvenant d'où l'on vient sont deux gestes qu'on confond.
           ⚠️ `<table>` et pas une liste maquillée : les en-têtes de colonne sont ANNONCÉS par
           les lecteurs d'écran à chaque cellule (« Pointage — samedi 13 septembre »), ce
           qu'aucune ligne de titre en `<div>` ne fait. */
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{individuel ? "Joueur" : "Équipe"}</th>

                {/* 🔴 LA COLONNE N'APPARAÎT QUE SI UNE JOURNÉE EST CHOISIE. Sur « tout le
                    tournoi », l'état global EST celui qu'on pointe : deux colonnes
                    identiques côte à côte feraient chercher une différence inexistante. */}
                {jour !== null ? <th scope="col">Dans le tournoi</th> : null}

                <th scope="col">
                  {jour === null ? (
                    "État dans le tournoi"
                  ) : (
                    <>
                      Pointage —{" "}
                      <time dateTime={jour} className={styles.enTeteJour}>
                        {jourLisible(jour)}
                      </time>
                    </>
                  )}
                </th>

                <th scope="col">
                  <span className="sr-only">Retirer du tournoi</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {engages.map((engage) => (
                <tr key={engage.id} className={styles.engage}>
                  <td>
                    <p className={styles.nom}>
                      {engage.displayName}
                      {engage.externalId ? (
                        /* ⚠️ Un engagé venu de MATELY n'existe pas encore (Story 11.2), mais la
                           colonne existe depuis la 10.1 : le marquer évite qu'on croie un jour
                           avoir saisi à la main une ligne qu'une re-synchronisation réécrira. */
                        <span className={styles.origine} title="Importé depuis MATELY">
                          {" "}
                          MATELY
                        </span>
                      ) : null}
                    </p>
                    {!individuel && engage.membres.length > 0 ? (
                      <p className={styles.membres}>
                        {engage.membres.map((membre) => membre.displayName).join(" · ")}
                      </p>
                    ) : null}
                  </td>

                  {/* ══════════════════════════════════════════════════════════════════════
                      GESTE N° 1 — L'ÉTAT GLOBAL, EN PASTILLE : IL SE LIT, IL NE SE CLIQUE PAS
                      ══════════════════════════════════════════════════════════════════
                      🔴 DEUX GESTES VOISINS PRENNENT DEUX FORMES, JAMAIS DEUX COULEURS
                      (principe ② de l'exploration Stitch). La forme sépare ici plus que
                      l'apparence : sur une journée, un seul des deux est CLIQUABLE, donc on
                      ne peut pas écraser l'état du tournoi en croyant pointer un samedi.
                      L'état global se modifie depuis « Tout le tournoi », et l'onglet le dit.
                      ⚠️ LE MOT EST ÉCRIT, jamais la couleur seule (AA) : la pastille porte le
                      libellé en toutes lettres, elle n'est qu'un repère de plus. */}
                  {jour !== null ? (
                    <td>
                      <span
                        className={
                          engage.stateGlobal === "abandonne"
                            ? `${styles.pastille} ${styles.pastilleAbandon}`
                            : styles.pastille
                        }
                        title={AIDES_ETAT_ENGAGE[engage.stateGlobal]}
                      >
                        {LIBELLES_ETAT_ENGAGE[engage.stateGlobal]}
                      </span>
                    </td>
                  ) : null}

                  {/* ══════════════════════════════════════════════════════════════════════
                      GESTE N° 2 — LE POINTAGE, EN BOUTONS LARGES : C'EST LUI QU'ON FAIT
                      ══════════════════════════════════════════════════════════════════
                      🔴 UN CLIC, SANS ROUVRIR DE FORMULAIRE (AC 4 de la 10.5). L'état courant
                      est PLEIN, les autres creux : on lit l'état sans lire le libellé — même
                      vocabulaire que la bascule de publication du reste du back-office. */}
                  <td>
                    <div className={styles.etats}>
                      {ENTRY_STATES.map((cible) => {
                        const courant = engage.state === cible;
                        return (
                          <button
                            key={cible}
                            type="button"
                            /* 🔴 UNE CLASSE LOCALE EXPLICITE POUR CHAQUE CAS, et non un
                               `:not(:disabled)` : le bouton courant EST `disabled` (on ne le
                               re-clique pas), mais TOUS le deviennent pendant l'aller-retour
                               d'un pointage — les trois autres reprendraient alors la couleur
                               d'accent le temps de la requête. L'état ne doit jamais clignoter
                               sur une liste qu'on parcourt à 64 lignes. */
                            className={
                              courant
                                ? `${actions.basculePubliee} ${styles.boutonEtat}`
                                : `${actions.bascule} ${styles.boutonEtat} ${styles.etatAutre}`
                            }
                            aria-pressed={courant}
                            title={AIDES_ETAT_ENGAGE[cible]}
                            disabled={enCoursId === engage.id || courant}
                            onClick={() => pointer(engage.id, engage.displayName, cible)}
                          >
                            {LIBELLES_ETAT_ENGAGE[cible]}
                            <span className="sr-only"> — {engage.displayName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </td>

                  <td>
                    <div className={styles.fin}>
                      {engage.supprimable ? (
                        <BoutonConfirmation
                          libelle="Supprimer"
                          question={`Supprimer « ${engage.displayName} » de ce tournoi ?`}
                          precision={
                            "Cet engagé ne figure dans aucune rencontre : rien d’autre ne " +
                            "disparaît. Si la personne était là et a arrêté en cours de route, " +
                            "n’utilisez pas ce bouton — marquez-la « a abandonné », ses points " +
                            "restent au classement."
                          }
                          onConfirmer={async () => {
                            const resultat = await supprimerEngage(engage.id);
                            if (resultat.ok) router.refresh();
                            return resultat.ok
                              ? { ok: true }
                              : { ok: false, error: resultat.error };
                          }}
                        />
                      ) : (
                        /* 🔴 LE REFUS REPOSE SUR LE MÊME TÉMOIN QUE LA BASE — l'existence d'une
                           place de rencontre (`ON DELETE RESTRICT`). Ce n'est donc pas une
                           seconde garde qui pourrait diverger : c'est le refus de la base, rendu
                           lisible avant le clic. Si la course se produit quand même (une
                           rencontre générée dans un autre onglet), le `23503` traduit par
                           l'action dit la même chose.
                           ⚠️ Le FAIT tient sur la ligne ; le QUOI FAIRE est dit une fois
                           au-dessus. */
                        <p
                          className={styles.verrou}
                          title="Un engagé qui figure dans une rencontre ne se supprime plus. S’il a arrêté en cours de route, marquez-le « a abandonné » : ses points restent au classement."
                        >
                          Dans {engage.placesDeRencontre} rencontre
                          {engage.placesDeRencontre > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {erreurListe ? (
        <p className={formulaire.erreur} role="alert">
          {erreurListe}
        </p>
      ) : null}

      <form action={soumettre} className={formulaire.form} noValidate>
        <h2 className={styles.titreAjout}>
          {individuel ? "Ajouter un joueur" : "Ajouter une équipe"}
        </h2>

        <ChampTexte
          id="engage-displayName"
          name="displayName"
          label={individuel ? "Nom du joueur (obligatoire)" : "Nom de l'équipe (obligatoire)"}
          valeur={displayName}
          onChange={setDisplayName}
          max={NOM_ENGAGE_MAX}
          aide={
            individuel
              ? "Le pseudo tel qu'il apparaîtra sur le tableau et au classement."
              : "Le nom de l'équipe tel qu'il apparaîtra sur le tableau et au classement."
          }
          erreur={erreurs.displayName}
        />

        {/* 🔴 EN INDIVIDUEL, LE FORMULAIRE NE PARLE JAMAIS D'ÉQUIPE (AC 2) — et il ne demande
            qu'UN nom, parce que `teamSize` vaut 1. Ce n'est pas un second chemin de code :
            c'est le même, avec un mot différent. */}
        {individuel ? (
          <ChampTexte
            id="engage-membre-0"
            name="membre"
            label="Pseudo en jeu (obligatoire)"
            valeur={membres[0] ?? ""}
            onChange={(valeur) => setMembres([valeur])}
            max={NOM_MEMBRE_MAX}
            aide="Le pseudo utilisé en jeu, s'il diffère du nom ci-dessus. Recopiez-le sinon."
            erreur={erreurs.membres}
          />
        ) : (
          <fieldset className={formulaire.champ}>
            <legend className={formulaire.legend}>
              Les {teamSize} joueurs de l&rsquo;équipe (obligatoire)
            </legend>
            {membres.map((valeur, index) => (
              <ChampTexte
                key={index}
                id={`engage-membre-${index}`}
                name="membre"
                label={`Joueur ${index + 1}`}
                valeur={valeur}
                onChange={(saisie) =>
                  setMembres((precedents) =>
                    precedents.map((autre, rang) => (rang === index ? saisie : autre)),
                  )
                }
                max={NOM_MEMBRE_MAX}
                erreur={index === 0 ? erreurs.membres : undefined}
              />
            ))}
            {/* ⚠️ L'effectif est EXACT, dans les deux sens : une équipe incomplète n'entre pas,
                une équipe trop nombreuse non plus. Le dire avant, c'est éviter de saisir cinq
                noms pour se les faire refuser en bloc. */}
            <p className={formulaire.sousChamp}>
              <span>
                Une équipe compte <strong>exactement {teamSize} joueurs</strong>. C&rsquo;est
                MATELY qui compose les équipes : on les saisit déjà formées.
              </span>
            </p>
          </fieldset>
        )}

        {etat.statut === "erreur" && etat.error ? (
          <p className={formulaire.erreur} role="alert">
            {etat.error}
          </p>
        ) : null}

        {etat.statut === "succes" ? (
          <div className={formulaire.confirmation} role="status">
            <p>
              Enregistré. L&rsquo;engagé apparaît dans la liste ci-dessus, à l&rsquo;état{" "}
              <strong>« inscrit »</strong> — il reste à le pointer le jour J.
            </p>
          </div>
        ) : null}

        <div className={formulaire.actions}>
          {/* Jamais `disabled` — patron 5.1 : un bouton grisé pendant une latence réseau
              donne l'impression d'une page morte. Le libellé porte l'état. */}
          <Button type="submit">
            {enCours ? "Enregistrement…" : individuel ? "Ajouter le joueur" : "Ajouter l'équipe"}
          </Button>
        </div>
      </form>
    </div>
  );
}
