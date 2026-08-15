"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@repo/ui";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import { ChampTexte } from "@/components/admin/ChampTexte/ChampTexte";
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
 * 🔴 CET ÉCRAN CONSOMME LES BRIQUES PARTAGÉES DU BACK-OFFICE — `admin-form.module.css`,
 * `ChampTexte`, `admin-actions.module.css`, `BoutonConfirmation`. Les dix autres formulaires
 * le font ; l'écran de la 10.4 ne le fait pas, et c'est **exactement** la dette R59 (« très
 * moche », « pas intuitif »). On ne la refait pas ici. La passe esthétique sur les trois
 * écrans du moteur reste la Story 10.9.
 *
 * 🔴 « ABSENT » ET « A ABANDONNÉ » SONT DEUX GESTES QUE TOUT OPPOSE, ET L'ÉCRAN LE DIT — AC 5.
 * Ce n'est pas du vocabulaire : les confondre fausserait le classement (dette R60). Chaque
 * bouton de pointage porte donc sa phrase, à l'endroit et au moment où on clique.
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
  donnees: EngagesDuTournoi;
}

export function EngagesTournoi({ tournoiId, teamSize, donnees }: EngagesTournoiProps) {
  const router = useRouter();
  const individuel = teamSize === 1;

  const [displayName, setDisplayName] = useState("");
  const [membres, setMembres] = useState<string[]>(() => Array.from({ length: teamSize }, () => ""));

  const [enTransition, demarrer] = useTransition();
  const [erreurListe, setErreurListe] = useState<string | null>(null);

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
    demarrer(async () => {
      setErreurListe(null);
      try {
        const resultat = await pointerEngage(id, cible);
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
      <p className={styles.compte} role="status">
        {total === 0 ? (
          "Aucun engagé pour l’instant."
        ) : (
          <>
            <strong>
              {parEtat.present} présent{parEtat.present > 1 ? "s" : ""}
            </strong>{" "}
            sur {total} engagé{total > 1 ? "s" : ""}
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

      {tronquee ? (
        /* ⚠️ Une troncature silencieuse se lit exactement comme « tout va bien ». Le décompte
           ci-dessus, lui, porte sur la table entière — il ne ment pas. */
        <p className={formulaire.avertissement} role="note">
          Cette liste n&rsquo;affiche que les {engages.length} premiers engagés. Le décompte
          ci-dessus porte bien sur les {total}.
        </p>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════════════════════════
          🔴 CE QUE CHAQUE POINTAGE VEUT DIRE — AC 5, DIT AVANT LE GESTE
          ══════════════════════════════════════════════════════════════════════════════
          « Absent » et « a abandonné » se ressemblent en français courant et n'ont rien à voir
          ici : le second garde ses points au classement. Cette phrase est un livrable, pas une
          décoration — sans elle, le mauvais bouton se clique de bonne foi. */}
      <p className={formulaire.regle} role="note">
        <strong>Absent</strong> : {AIDES_ETAT_ENGAGE.absent}
        <br />
        <strong>A abandonné</strong> : {AIDES_ETAT_ENGAGE.abandonne}
      </p>

      {engages.length === 0 ? (
        <p className={styles.vide}>
          Personne n&rsquo;est encore engagé sur ce tournoi. Saisissez-les ci-dessous —{" "}
          {individuel
            ? "un nom par joueur"
            : `un nom d’équipe et ses ${teamSize} joueurs`}{" "}
          —, puis pointez-les le jour J. C&rsquo;est ce pointage qui dira qui entre réellement
          dans le tableau.
        </p>
      ) : (
        <ul className={styles.liste}>
          {engages.map((engage) => (
            <li key={engage.id} className={styles.engage}>
              <div className={styles.identite}>
                <p className={styles.nom}>{engage.displayName}</p>
                {!individuel && engage.membres.length > 0 ? (
                  <p className={styles.membres}>
                    {engage.membres.map((membre) => membre.displayName).join(" · ")}
                  </p>
                ) : null}
                {engage.externalId ? (
                  /* ⚠️ Un engagé venu de MATELY n'existe pas encore (Story 11.2), mais la
                     colonne, elle, existe depuis la 10.1 : le dire ici évite qu'on croie un
                     jour avoir saisi à la main une ligne qui sera réécrite par une
                     re-synchronisation. */
                  <p className={styles.origine}>Importé depuis MATELY</p>
                ) : null}
                <p className={styles.etatCourant}>
                  {LIBELLES_ETAT_ENGAGE[engage.state]} — {AIDES_ETAT_ENGAGE[engage.state]}
                </p>
              </div>

              {/* 🔴 LE POINTAGE EST UN CLIC, SANS ROUVRIR DE FORMULAIRE (AC 4). L'état courant
                  est PLEIN, les autres sont creux : on lit l'état sans lire le libellé —
                  même vocabulaire que la bascule de publication du reste du back-office. */}
              <div className={actions.bloc}>
                {ENTRY_STATES.map((cible) => {
                  const courant = engage.state === cible;
                  return (
                    <button
                      key={cible}
                      type="button"
                      className={courant ? actions.basculePubliee : actions.bascule}
                      aria-pressed={courant}
                      title={AIDES_ETAT_ENGAGE[cible]}
                      disabled={enTransition || courant}
                      onClick={() => pointer(engage.id, engage.displayName, cible)}
                    >
                      {LIBELLES_ETAT_ENGAGE[cible]}
                      <span className="sr-only"> — {engage.displayName}</span>
                    </button>
                  );
                })}

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
                      return resultat.ok ? { ok: true } : { ok: false, error: resultat.error };
                    }}
                  />
                ) : (
                  /* 🔴 LE REFUS EST DIT, PAS DEVINÉ — et il repose sur LE MÊME TÉMOIN que la
                     base (l'existence d'une place de rencontre, `ON DELETE RESTRICT`). Ce
                     n'est donc pas une seconde garde qui pourrait diverger : c'est le refus
                     de la base, rendu lisible avant le clic plutôt qu'après. Si la course se
                     produit quand même (une rencontre générée dans un autre onglet), le
                     `23503` traduit par l'action dit la même chose. */
                  <p className={styles.verrou}>
                    Figure dans {engage.placesDeRencontre} rencontre
                    {engage.placesDeRencontre > 1 ? "s" : ""} : il ne se supprime plus.
                    S&rsquo;il a arrêté en cours de route, marquez-le{" "}
                    <strong>« a abandonné »</strong>.
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
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
              Enregistré. L&rsquo;engagé apparaît dans la liste ci-dessus, à
              l&rsquo;état <strong>« inscrit »</strong> — il reste à le pointer le jour J.
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
