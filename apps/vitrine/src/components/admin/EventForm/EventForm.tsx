"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@repo/ui";

import { ChampTexte } from "@/components/admin/ChampTexte/ChampTexte";
import {
  diagnostiquerHeureMurale,
  parisWallClockFromInput,
  parisWallClockOptionnelFromInput,
  toInputValue,
} from "@/lib/date-paris";
import {
  DESCRIPTION_MAX,
  EVENT_TYPES,
  JEUX_MAX,
  LIEU_ADRESSE_MAX,
  LIEU_NOM_MAX,
  RECAP_MAX,
  TARIF_MAX,
  TITRE_MAX,
  eventInputSchema,
} from "@/lib/schemas/event";
import { enregistrerEvenement } from "@/server/actions/agenda";
import type { Bar, Event } from "@/server/db/schema";
import styles from "@/styles/admin-form.module.css";

/**
 * Formulaire de saisie d'un événement (Story 6.3) — **le patron de saisie du projet**.
 *
 * 🔴 TOUS LES CHAMPS SONT CONTRÔLÉS, ET CE N'EST PAS NÉGOCIABLE. React 19 RÉINITIALISE
 * les champs NON contrôlés d'un `<form action={fn}>` une fois l'action résolue — succès
 * COMME échec. Défaut réel trouvé par `gate:solicitation` pendant la Story 5.1 : le
 * message tapé disparaissait exactement au moment où il fallait le conserver. Ne pas
 * « simplifier » en repassant en non contrôlé.
 *
 * 🔴 LA DATE PASSE PAR `parisWallClockFromInput`, DES DEUX CÔTÉS. Le champ natif rend
 * `"2026-08-06T19:00"` — sans fuseau — et le pré-remplissage à l'édition passe par
 * `toInputValue`, jamais par `toISOString()` (qui afficherait l'heure UTC).
 *
 * ⚠️ La validation CLIENT est complète et utilise le MÊME schéma Zod que le serveur : le
 * focus au premier champ en erreur ne doit pas attendre un aller-retour réseau. Le serveur
 * re-valide quand même — il ne fait jamais confiance au client.
 */

/** Ordre VISUEL des champs — c'est lui qui décide où va le focus, pas l'ordre du schéma. */
const ORDRE_CHAMPS = [
  "title",
  "barId",
  "venueName",
  "venueAddress",
  "startsAt",
  // Story 9.6 — à leur place VISUELLE, entre la date et les jeux. L'ordre de ce tableau décide
  // où va le focus après une erreur : les ajouter en fin de liste ferait remonter la page au
  // mauvais champ, sur un formulaire qui en compte désormais dix.
  "endsAt",
  "priceText",
  "games",
  "description",
  "recap",
] as const;

const LIBELLE_TYPE: Record<(typeof EVENT_TYPES)[number], string> = {
  thursday: "Jeudi jeux (hebdo)",
  special: "Temps fort",
};

type EtatForm = {
  statut: "vierge" | "succes" | "erreur";
  error?: string;
  fieldErrors?: Record<string, string>;
  avertissement?: string | null;
  idEnregistre?: string;
};

const ETAT_INITIAL: EtatForm = { statut: "vierge" };

export interface EventFormProps {
  bars: readonly Bar[];
  /** Absent en création. */
  evenement?: Event;
}

export function EventForm({ bars, evenement }: EventFormProps) {
  const router = useRouter();

  const [type, setType] = useState<(typeof EVENT_TYPES)[number]>(evenement?.type ?? "thursday");
  const [title, setTitle] = useState(evenement?.title ?? "");
  const [barId, setBarId] = useState(evenement?.barId ?? "");
  const [venueName, setVenueName] = useState(evenement?.venueName ?? "");
  const [venueAddress, setVenueAddress] = useState(evenement?.venueAddress ?? "");
  const [startsAt, setStartsAt] = useState(
    evenement ? toInputValue(evenement.startsAt) : "",
  );
  // Story 9.6 — `toInputValue` et JAMAIS `toISOString()` pour le pré-remplissage : le second
  // afficherait l'heure UTC, et le bénévole « corrigerait » une heure qui était juste (piège ②
  // en tête de la section SAISIE de `lib/date-paris.ts`). Absente ⇒ champ VIDE, jamais la
  // chaîne « null » — et c'est le champ vide qui redira « pas de fin » au prochain envoi.
  const [endsAt, setEndsAt] = useState(
    evenement?.endsAt ? toInputValue(evenement.endsAt) : "",
  );
  const [priceText, setPriceText] = useState(evenement?.priceText ?? "");
  const [games, setGames] = useState(evenement?.games ?? "");
  const [description, setDescription] = useState(evenement?.description ?? "");
  const [recap, setRecap] = useState(evenement?.recap ?? "");
  const [isPublished, setIsPublished] = useState(evenement?.isPublished ?? false);

  const [etat, soumettre, enCours] = useActionState(
    async (precedent: EtatForm, formData: FormData): Promise<EtatForm> => {
      // 🔴 L'IDENTIFIANT VIENT DE L'ÉTAT PRÉCÉDENT, PAS D'UN `useState`. Après une
      // CRÉATION réussie, le formulaire doit devenir celui de l'événement créé — sinon un
      // second clic sur « Enregistrer » créerait un DOUBLON. Le déduire de `precedent`
      // plutôt que de synchroniser un state dans un effet évite des rendus en cascade
      // (règle `react-hooks/set-state-in-effect`) et supprime la question « lequel des
      // deux fait foi ».
      const idCourant = precedent.idEnregistre ?? evenement?.id ?? null;

      // ── Validation CLIENT, avec le même schéma que le serveur ──────────────────
      const instant = parisWallClockFromInput(String(formData.get("startsAt") ?? ""));
      // 🔴 `idEnregistre` EST RECONDUIT DANS CHAQUE RETOUR D'ERREUR, ET C'EST UNE GARDE
      // ANTI-DOUBLON. Sans lui, la séquence « je crée (succès) → je corrige mal (échec) →
      // je corrige bien (succès) » repartirait d'un identifiant perdu et créerait un
      // SECOND événement, sans que rien ne le signale.
      const echec = (etat: Omit<EtatForm, "statut" | "idEnregistre">): EtatForm => ({
        statut: "erreur",
        idEnregistre: idCourant ?? undefined,
        ...etat,
      });

      if (instant === null) {
        return echec({
          error: "Cette date n'existe pas.",
          fieldErrors: {
            startsAt: "Vérifiez le jour, le mois et l'heure : cette date n'existe pas.",
          },
        });
      }

      // 🔴 L'heure de fin est FACULTATIVE : « vide » et « illisible » se distinguent, sans quoi
      // une faute de frappe effacerait une fin déjà enregistrée. MÊME lecture que le serveur
      // (`lireHeureDeFin`) — deux règles de fuseau divergentes seraient invisibles en local.
      const lectureFin = parisWallClockOptionnelFromInput(String(formData.get("endsAt") ?? ""));
      if (lectureFin.cas === "invalide") {
        return echec({
          error: "Cette heure de fin n'existe pas.",
          fieldErrors: {
            endsAt: "Vérifiez le jour, le mois et l'heure : cette date n'existe pas.",
          },
        });
      }

      const analyse = eventInputSchema.safeParse({
        type: formData.get("type") ?? undefined,
        title: formData.get("title"),
        barId: formData.get("barId"),
        venueName: formData.get("venueName"),
        venueAddress: formData.get("venueAddress"),
        startsAt: instant,
        endsAt: lectureFin.cas === "ok" ? lectureFin.instant : null,
        priceText: formData.get("priceText"),
        games: formData.get("games"),
        description: formData.get("description"),
        recap: formData.get("recap"),
        isPublished: formData.get("isPublished") === "on",
      });

      if (!analyse.success) {
        const fieldErrors: Record<string, string> = {};
        for (const souci of analyse.error.issues) {
          const clef = souci.path[0];
          if (typeof clef === "string" && !(clef in fieldErrors)) fieldErrors[clef] = souci.message;
        }
        return echec({
          error: analyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
          fieldErrors,
        });
      }

      try {
        const resultat = await enregistrerEvenement(idCourant, formData);
        if (!resultat.ok) {
          return echec({ error: resultat.error, fieldErrors: resultat.fieldErrors });
        }
        // Les lectures publiques sont `force-dynamic` : il n'y a AUCUN cache de DONNÉES à
        // invalider (voir `server/actions/agenda.ts`). Ce rafraîchissement ne concerne que
        // le cache ROUTEUR du navigateur, pour que la liste et l'aperçu montrent la
        // version qu'on vient d'écrire. Appelé ici et non dans un effet : un `setState`
        // synchrone dans un effet déclenche des rendus en cascade (règle
        // `react-hooks/set-state-in-effect`, déjà payée en Story 5.1).
        router.refresh();
        return {
          statut: "succes",
          idEnregistre: resultat.data.id,
          avertissement: resultat.data.avertissement,
        };
      } catch {
        // La saisie reste dans le DOM (champs contrôlés) : jamais perdre ce qui a été tapé.
        return echec({ error: "Une erreur réseau est survenue, merci de réessayer." });
      }
    },
    ETAT_INITIAL,
  );

  // Focus au premier champ en erreur, dans l'ordre VISUEL (patron `SolicitationForm`).
  useEffect(() => {
    if (!etat.fieldErrors) return;
    const premier = ORDRE_CHAMPS.find((champ) => etat.fieldErrors?.[champ]);
    if (premier) document.getElementById(`evenement-${premier}`)?.focus();
  }, [etat.fieldErrors]);

  const erreurs = etat.fieldErrors ?? {};
  /** Identifiant de l'événement une fois créé — décide du libellé du bouton. */
  const idCourant = etat.idEnregistre ?? evenement?.id ?? null;
  const diagnostic = startsAt ? diagnostiquerHeureMurale(startsAt) : { cas: "ok" as const };
  const avertissementHeure = diagnostic.cas === "ok" ? null : diagnostic.message;

  return (
    <form action={soumettre} className={styles.form} noValidate>
      <fieldset className={styles.champ}>
        <legend className={styles.legend}>Nature</legend>
        <div className={styles.choix}>
          {EVENT_TYPES.map((valeur) => (
            <label key={valeur} className={styles.choixLabel}>
              <input
                type="radio"
                name="type"
                value={valeur}
                checked={type === valeur}
                onChange={() => setType(valeur)}
              />
              {LIBELLE_TYPE[valeur]}
            </label>
          ))}
        </div>
      </fieldset>

      <ChampTexte
        id="evenement-title"
        name="title"
        label="Titre"
        valeur={title}
        onChange={setTitle}
        max={TITRE_MAX}
        aide="Ce que le public lit en premier."
        erreur={erreurs.title}
      />

      <div className={styles.champ}>
        <label className={styles.label} htmlFor="evenement-barId">
          Bar du roulement
        </label>
        <select
          id="evenement-barId"
          name="barId"
          className={styles.saisie}
          value={barId}
          onChange={(evenement) => setBarId(evenement.target.value)}
          aria-invalid={erreurs.barId ? "true" : undefined}
          aria-describedby={erreurs.barId ? "evenement-barId-erreur" : undefined}
        >
          <option value="">Aucun — c&rsquo;est un lieu libre</option>
          {bars.map((etablissement) => (
            <option key={etablissement.id} value={etablissement.id}>
              {etablissement.name} — {etablissement.district}
            </option>
          ))}
        </select>
        {erreurs.barId ? (
          <p id="evenement-barId-erreur" className={styles.erreur}>
            {erreurs.barId}
          </p>
        ) : null}
      </div>

      <ChampTexte
        id="evenement-venueName"
        name="venueName"
        label="Nom du lieu (si ce n'est pas un bar du roulement)"
        valeur={venueName}
        onChange={setVenueName}
        max={LIEU_NOM_MAX}
        aide="À remplir uniquement quand aucun bar n'est choisi."
        erreur={erreurs.venueName}
      />

      <ChampTexte
        id="evenement-venueAddress"
        name="venueAddress"
        label="Adresse du lieu"
        valeur={venueAddress}
        onChange={setVenueAddress}
        max={LIEU_ADRESSE_MAX}
        erreur={erreurs.venueAddress}
      />

      <ChampTexte
        id="evenement-startsAt"
        name="startsAt"
        label="Date et heure"
        type="datetime-local"
        valeur={startsAt}
        onChange={setStartsAt}
        aide="Heure de Reims."
        erreur={erreurs.startsAt}
      />

      {/* 🔴 AVERTISSEMENT NON BLOQUANT — dette R23. Les deux heures pathologiques du
          changement d'heure ne sont pas corrigées dans le dos de la personne : on lui dit
          ce qui sera enregistré, et elle décide. `role="status"` et non `alert` : ce n'est
          pas une erreur, rien n'est empêché. */}
      {avertissementHeure ? (
        <p className={styles.avertissement} role="status">
          {avertissementHeure}
        </p>
      ) : null}

      {/* 🔴 L'HEURE DE FIN — FACULTATIVE, ET L'AIDE DIT CE QUE LE VISITEUR VERRA (Story 9.6).
          Patron `AIDES_MODE_INSCRIPTION` de `TournoiForm` : on écrit au bénévole l'EFFET de son
          geste sur le site public, pas le format attendu du champ (le navigateur s'en charge).
          ⚠️ Elle nomme les DEUX cas — rempli et vide — parce que le vide est ici une décision,
          pas un oubli : un jeudi en bar n'a pas de fin, et la phrase « on reste tant qu'on
          veut » est précisément ce que le site rend à sa place. */}
      <ChampTexte
        id="evenement-endsAt"
        name="endsAt"
        label="Heure de fin (facultative)"
        type="datetime-local"
        valeur={endsAt}
        onChange={setEndsAt}
        aide={
          "Heure de Reims. Laissée vide, le site n'annonce aucune fin — sur un jeudi il écrit " +
          "« on reste tant qu'on veut ». Une fin après minuit se saisit avec la date du lendemain."
        }
        erreur={erreurs.endsAt}
      />

      {/* Le tarif (Story 9.6). ⚠️ L'aide dit explicitement que le vide n'affiche RIEN, et
          surtout pas « Gratuit » : c'est la règle la plus facile à supposer de travers, et
          celle dont l'erreur serait publique. */}
      <ChampTexte
        id="evenement-priceText"
        name="priceText"
        label="Tarif"
        valeur={priceText}
        onChange={setPriceText}
        max={TARIF_MAX}
        aide={
          "En toutes lettres : « 5 € », « Gratuit », « 3 € adhérents ». Laissé vide, le site " +
          "n'affiche aucun tarif — il n'annonce pas la gratuité à votre place."
        }
        erreur={erreurs.priceText}
      />

      <ChampTexte
        id="evenement-games"
        name="games"
        label="Jeux annoncés"
        valeur={games}
        onChange={setGames}
        max={JEUX_MAX}
        aide="Laissé vide, la ligne disparaît du site — elle ne s'affiche pas à moitié."
        erreur={erreurs.games}
      />

      <ChampTexte
        id="evenement-description"
        name="description"
        label="Description"
        valeur={description}
        onChange={setDescription}
        max={DESCRIPTION_MAX}
        multiligne
        aide="Affichée en entier sur la page Agenda."
        erreur={erreurs.description}
      />

      <ChampTexte
        id="evenement-recap"
        name="recap"
        label="Compte-rendu"
        valeur={recap}
        onChange={setRecap}
        max={RECAP_MAX}
        multiligne
        aide="À écrire APRÈS l'événement : c'est ce qui apparaît dans « Déjà passé »."
        erreur={erreurs.recap}
      />

      <div className={styles.champ}>
        <label className={styles.choixLabel}>
          <input
            type="checkbox"
            name="isPublished"
            value="on"
            checked={isPublished}
            onChange={(evenement) => setIsPublished(evenement.target.checked)}
          />
          Publier sur le site
        </label>
        <p className={styles.sousChamp}>
          <span>
            Tant que la case est décochée, l&rsquo;événement n&rsquo;apparaît nulle part sur le
            site public.
          </span>
        </p>
      </div>

      {etat.statut === "erreur" && etat.error ? (
        <p className={styles.erreur} role="alert">
          {etat.error}
        </p>
      ) : null}

      {etat.statut === "succes" ? (
        <div className={styles.confirmation} role="status">
          <p>Enregistré.</p>
          {etat.avertissement ? <p>{etat.avertissement}</p> : null}
          {etat.idEnregistre ? (
            <p>
              <Link className={styles.lien} href={`/admin/agenda/${etat.idEnregistre}/apercu`}>
                Voir le rendu public
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className={styles.actions}>
        {/* Jamais `disabled` — patron de la Story 5.1 : on laisse cliquer, les gardes
            serveur font le reste. Un bouton grisé pendant une latence réseau donne
            l'impression d'une page morte. */}
        <Button type="submit">
          {enCours
            ? "Enregistrement…"
            : idCourant
              ? "Enregistrer les modifications"
              : "Créer l'événement"}
        </Button>
        <Link className={styles.lien} href="/admin/agenda">
          Retour à la liste
        </Link>
      </div>
    </form>
  );
}
