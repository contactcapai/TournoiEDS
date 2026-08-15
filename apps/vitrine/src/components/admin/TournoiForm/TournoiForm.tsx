"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@repo/ui";

import { ChampTexte } from "@/components/admin/ChampTexte/ChampTexte";
import {
  formatLongDate,
  parisWallClockFromInput,
  parisWallClockOptionnelFromInput,
  toInputValue,
} from "@/lib/date-paris";
import {
  AIDES_ETAT_INSCRIPTION,
  AIDES_MODE_INSCRIPTION,
  LIBELLES_ETAT_INSCRIPTION,
  LIBELLES_MODE_INSCRIPTION,
} from "@/lib/libelles-tournoi";
import {
  DUREE_MATCH_MAX,
  FORMAT_MAX,
  IDENTIFIANT_MAX,
  JEU_MAX,
  LIEU_MAX,
  LOTS_MAX,
  NOM_MAX,
  PLACES_MAX,
  PODIUM_MAX,
  TARIF_MAX,
  REGISTRATION_MODES,
  REGISTRATION_STATES,
  URL_MAX,
  fabriquerIdentifiant,
  type TournamentRegistrationMode,
  type TournamentRegistrationState,
} from "@/lib/schemas/tournament";
import { enregistrerTournoi } from "@/server/actions/tournois";
import type { EvenementRattachable, PhotoVisuel } from "@/server/db/queries/tournaments";
import styles from "@/styles/admin-form.module.css";
import propre from "@/app/admin/(protege)/tournois/tournois.module.css";

/**
 * Création et modification d'un tournoi (Story 9.1, A21/A23).
 *
 * Reprend LITTÉRALEMENT le patron de saisie posé par `EventForm` (6.3), `PhotoForm` (6.4),
 * `PartenaireForm` (6.5) puis `AtelierForm` (6.9) :
 *   · tous les champs CONTRÔLÉS — React 19 réinitialise les champs non contrôlés d'un
 *     `<form action={fn}>` après résolution de l'action, succès COMME échec (défaut réel de la
 *     Story 5.1). Ne pas « simplifier » en repassant en non contrôlé ;
 *   · validation CLIENT **puis** serveur, le serveur re-validant toujours ;
 *   · focus au premier champ en erreur dans l'ordre VISUEL, pas dans celui du schéma ;
 *   · bouton JAMAIS `disabled` pendant l'attente (patron 5.1) : le libellé porte l'état.
 *
 * 🔴 CE FORMULAIRE NE PORTE **PAS** LA PUBLICATION, et l'omission EST la garde : il ne la
 * **soumet pas**, donc il ne peut pas écraser une bascule faite depuis la liste pendant qu'il
 * était ouvert. C'est la dette **R35** rendue sans objet par le découpage plutôt que par un
 * jeton de version (patron 6.9).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LA VALIDATION CLIENT NE RÉ-EXÉCUTE **PAS** LE SCHÉMA COMPLET, ET C'EST DÉLIBÉRÉ
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `AtelierForm` re-parse `workshopInputSchema` côté client pour poser le focus sans
 * aller-retour réseau. Ici c'est **impossible sans mentir** : `tournamentInputSchema` exige un
 * `startsAt` déjà converti par `parisWallClockFromInput`, et surtout son unicité d'adresse se
 * décide **en base**. Un pré-parsage partiel afficherait « tout va bien » sur un formulaire que
 * le serveur va refuser — un faux vert, et le pire des deux mondes.
 * ⇒ On garde la **seule** vérification client qui soit à la fois honnête et utile : la date,
 * dont l'inexistence (heure de changement d'heure) se détecte localement et sans base. Tout le
 * reste est tranché par le serveur, qui renvoie ses `fieldErrors` et où va le focus.
 */

/** Ordre VISUEL des champs — c'est lui qui décide où va le focus. */
const ORDRE_CHAMPS = [
  "eventId",
  "name",
  "game",
  "slug",
  "startsAt",
  // Story 9.6 — à leur place VISUELLE. `endsAt` suit immédiatement `startsAt` (les deux bornes
  // d'un même horaire), et `priceText` rejoint le bloc « ce qu'il faut savoir pour venir », juste
  // après le lieu. Les ajouter en fin de liste enverrait le focus au mauvais champ.
  "endsAt",
  "venueName",
  "priceText",
  "photoId",
  "registrationMode",
  "registrationUrl",
  "registrationState",
  "capacity",
  "formatText",
  "matchDurationMinutes",
  "prizes",
  "podiumFirst",
  "podiumSecond",
  "podiumThird",
] as const;

type EtatForm = {
  statut: "vierge" | "succes" | "erreur";
  error?: string;
  fieldErrors?: Record<string, string>;
  avertissement?: string | null;
};

const ETAT_INITIAL: EtatForm = { statut: "vierge" };

export interface TournoiFormProps {
  /** `undefined` = création. Sinon : les valeurs à pré-remplir. */
  tournoi?: {
    id: string;
    /** `null` depuis la 9.5 : le tournoi peut être le rendez-vous lui-même. */
    eventId: string | null;
    name: string;
    game: string;
    slug: string;
    startsAt: Date;
    /** `null` = aucune fin annoncée (Story 9.6, A5 — c'est le livrable, pas un manque). */
    endsAt: Date | null;
    /** Le tarif annoncé, en toutes lettres (Story 9.6). `null` ⇒ le site n'affiche RIEN. */
    priceText: string | null;
    venueName: string | null;
    formatText: string | null;
    prizes: string | null;
    matchDurationMinutes: number | null;
    capacity: number | null;
    registrationMode: TournamentRegistrationMode;
    registrationUrl: string | null;
    registrationState: TournamentRegistrationState;
    podiumFirst: string | null;
    podiumSecond: string | null;
    podiumThird: string | null;
    photoId: string | null;
    /** Décide si l'identifiant d'adresse est encore modifiable (A3). */
    isPublished: boolean;
  };
  /**
   * Les événements d'agenda proposables au rattachement — **facultatif depuis la 9.5**.
   * ⚠️ Une liste vide n'est plus un état bloquant : c'est le cas nominal d'une base neuve, et
   * le tournoi se saisit très bien sans.
   */
  evenements: readonly EvenementRattachable[];
  /**
   * Les photos de la galerie proposables comme visuel (A2). **Publiées uniquement** — voir
   * `getPhotosPourVisuel`, et l'écart assumé d'A2 qu'elle referme.
   */
  photos: readonly PhotoVisuel[];
}

export function TournoiForm({ tournoi, evenements, photos }: TournoiFormProps) {
  const router = useRouter();
  const creation = tournoi === undefined;

  /**
   * 🔴 LE DÉFAUT EST « AUCUN », ET LA VERSION PRÉCÉDENTE RATTACHAIT AU HASARD.
   *
   * Elle lisait `tournoi?.eventId ?? evenements[0]?.id ?? ""` — or `getEventsPourRattachement`
   * trie **`desc(startsAt)`** : à la création, le formulaire rattachait donc d'office au
   * **dernier événement saisi**, que personne n'avait choisi, et qui n'a aucune raison d'être
   * le bon. C'est la duplication de la 9.1 vue de l'autre bout : non seulement il *fallait*
   * rattacher, mais on rattachait **à tort par défaut**.
   * ⇒ `""` à la création = l'option « Aucun », que `optionalUuid` ramène à `null`.
   */
  const [eventId, setEventId] = useState(tournoi?.eventId ?? "");
  const [name, setName] = useState(tournoi?.name ?? "");
  const [game, setGame] = useState(tournoi?.game ?? "");
  const [slug, setSlug] = useState(tournoi?.slug ?? "");
  const [startsAt, setStartsAt] = useState(tournoi ? toInputValue(tournoi.startsAt) : "");
  // Story 9.6 — `toInputValue` et JAMAIS `toISOString()` (qui afficherait l'heure UTC, piège ②
  // de `lib/date-paris.ts`). Absente ⇒ champ VIDE, jamais la chaîne « null ».
  const [endsAt, setEndsAt] = useState(tournoi?.endsAt ? toInputValue(tournoi.endsAt) : "");
  const [priceText, setPriceText] = useState(tournoi?.priceText ?? "");
  const [venueName, setVenueName] = useState(tournoi?.venueName ?? "");
  const [photoId, setPhotoId] = useState(tournoi?.photoId ?? "");
  const [formatText, setFormatText] = useState(tournoi?.formatText ?? "");
  const [prizes, setPrizes] = useState(tournoi?.prizes ?? "");
  const [matchDuration, setMatchDuration] = useState(
    tournoi?.matchDurationMinutes?.toString() ?? "",
  );
  const [capacity, setCapacity] = useState(tournoi?.capacity?.toString() ?? "");
  const [registrationMode, setRegistrationMode] = useState<TournamentRegistrationMode>(
    tournoi?.registrationMode ?? "mately",
  );
  const [registrationUrl, setRegistrationUrl] = useState(tournoi?.registrationUrl ?? "");
  const [registrationState, setRegistrationState] = useState<TournamentRegistrationState>(
    tournoi?.registrationState ?? "fermees",
  );
  const [podiumFirst, setPodiumFirst] = useState(tournoi?.podiumFirst ?? "");
  const [podiumSecond, setPodiumSecond] = useState(tournoi?.podiumSecond ?? "");
  const [podiumThird, setPodiumThird] = useState(tournoi?.podiumThird ?? "");

  /**
   * 🔴 L'IDENTIFIANT SE DÉRIVE DU NOM **TANT QUE PERSONNE NE L'A TOUCHÉ** (A3).
   *
   * Le suivi cesse au premier caractère tapé dans le champ d'adresse : sans ce drapeau, une
   * correction de faute de frappe dans le nom **écraserait** l'adresse que le bénévole vient
   * de choisir à la main — le geste le plus frustrant qu'un formulaire puisse produire.
   * ⚠️ En ÉDITION il démarre à `false` : l'adresse existe déjà, elle a pu être diffusée, et
   * la re-dériver au premier ajustement de nom la casserait en silence.
   */
  const [adresseLiee, setAdresseLiee] = useState(creation);

  // 🔴 L'ADRESSE EST FIGÉE DÈS QUE LE TOURNOI EST PUBLIÉ (A3), et le champ le DIT au lieu de
  // laisser le serveur refuser après coup. La garde qui compte reste côté serveur — celle-ci
  // n'est que l'explication, au bon endroit.
  const adresseFigee = tournoi?.isPublished === true;

  const [etat, soumettre, enCours] = useActionState(
    async (_precedent: EtatForm, formData: FormData): Promise<EtatForm> => {
      // La SEULE vérification client (voir l'en-tête) : une date qui n'existe pas — 2h30 le
      // jour du passage à l'heure d'été, par exemple — se détecte ici, sans base et sans
      // aller-retour. Le serveur la refait de toute façon.
      const saisieDate = String(formData.get("startsAt") ?? "");
      if (parisWallClockFromInput(saisieDate) === null) {
        return {
          statut: "erreur",
          error: "Cette date n'existe pas.",
          fieldErrors: {
            startsAt: "Vérifiez le jour, le mois et l'heure : cette date n'existe pas.",
          },
        };
      }

      // 🔴 MÊME VÉRIFICATION POUR LA FIN, ET ELLE DISTINGUE « VIDE » DE « ILLISIBLE » (9.6).
      // Un champ facultatif dont la saisie illisible retomberait sur « pas renseigné »
      // effacerait une fin déjà enregistrée, sans un mot. La règle est la MÊME que côté serveur
      // (`lireHeureDeFin`) : deux lectures divergentes seraient invisibles en local.
      if (parisWallClockOptionnelFromInput(String(formData.get("endsAt") ?? "")).cas === "invalide") {
        return {
          statut: "erreur",
          error: "Cette heure de fin n'existe pas.",
          fieldErrors: {
            endsAt: "Vérifiez le jour, le mois et l'heure : cette date n'existe pas.",
          },
        };
      }

      try {
        const resultat = await enregistrerTournoi(tournoi?.id ?? null, formData);

        if (!resultat.ok) {
          return { statut: "erreur", error: resultat.error, fieldErrors: resultat.fieldErrors };
        }
        // Ne concerne que le cache ROUTEUR du navigateur : les pages publiques sont
        // `force-dynamic`, il n'y a AUCUN cache de données à invalider.
        router.refresh();
        // 🔴 À LA CRÉATION, ON REVIENT À LA LISTE — patron des ateliers. Il n'y a rien de plus
        // à faire sur la fiche : le geste suivant est « publier », et il vit sur la ligne.
        if (creation) router.push("/admin/tournois");
        return { statut: "succes", avertissement: resultat.data.avertissement };
      } catch {
        // 🔴 `requireAdmin()` s'exécute AVANT le `try` de la Server Action et **LÈVE** : une
        // session expirée ou un compte retiré de l'allowlist arrive ici, et nulle part
        // ailleurs. Sans ce `catch`, ce serait le seul rejet non géré de la surface.
        // La saisie reste dans le DOM (champs contrôlés) : jamais perdre ce qui a été tapé.
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
    if (premier) document.getElementById(`tournoi-${premier}`)?.focus();
  }, [etat.fieldErrors]);

  const erreurs = etat.fieldErrors ?? {};

  function changerNom(valeur: string) {
    setName(valeur);
    if (adresseLiee && !adresseFigee) setSlug(fabriquerIdentifiant(valeur));
  }

  const evenementChoisi = evenements.find((e) => e.id === eventId);

  return (
    <form action={soumettre} className={styles.form} noValidate>
      {/* ══════════════════════════════════════════════════════════════════════════════════
          ① L'ESSENTIEL
          ══════════════════════════════════════════════════════════════════════════════ */}
      <fieldset className={propre.bloc}>
        <legend className={propre.blocTitre}>L&rsquo;essentiel</legend>
        <p className={propre.blocAide}>
          Ce qu&rsquo;un visiteur doit lire en premier : à quoi on joue, quand, et où.
        </p>

        {/* ── Le rattachement à l'agenda ────────────────────────────────────────────────
            🔴 FACULTATIF DEPUIS LA 9.5 — et l'écran doit dire ce que chacun des deux cas
            PRODUIT, pas seulement qu'un choix existe. Sans événement, le tournoi paraît
            lui-même à l'agenda ; rattaché, c'est l'événement qui paraît, et le tournoi en
            est une animation. Un bénévole qui ne le sait pas re-crée l'événement « pour être
            sûr » — c'est-à-dire exactement la double saisie que cette story supprime.
            ⚠️ L'ÉTAT VIDE N'EST PLUS BLOQUANT : une base neuve sans aucun événement est un
            cas parfaitement saisissable, et le `<select>` garde alors sa seule option. */}
        <div className={styles.champ}>
          <label className={styles.label} htmlFor="tournoi-eventId">
            Événement de l&rsquo;agenda (facultatif)
          </label>
          <select
            id="tournoi-eventId"
            name="eventId"
            className={styles.saisie}
            value={eventId}
            onChange={(evenement) => setEventId(evenement.target.value)}
            aria-invalid={erreurs.eventId ? "true" : undefined}
            aria-describedby="tournoi-eventId-aide"
          >
            {/* `value=""` ⇒ `optionalUuid` le ramène à `null`. Premier de la liste : c'est le
                cas le plus fréquent, et le défaut à la création. */}
            <option value="">Aucun — ce tournoi est le rendez-vous</option>
            {evenements.map((evenement) => (
              <option key={evenement.id} value={evenement.id}>
                {formatLongDate(evenement.startsAt)} — {evenement.title}
                {evenement.isPublished ? "" : " (brouillon)"}
              </option>
            ))}
          </select>
          <p className={styles.sousChamp} id="tournoi-eventId-aide">
            <span>
              {evenementChoisi ? (
                <>
                  Ce tournoi est une animation de cet événement : c&rsquo;est
                  l&rsquo;<strong>événement</strong> qui paraît à l&rsquo;agenda, et il peut
                  porter plusieurs tournois (la Game&rsquo;in Reims en porte dix).
                  {evenementChoisi.isPublished ? null : (
                    <>
                      {" "}
                      ⚠️ L&rsquo;événement choisi est un <strong>brouillon</strong> :
                      c&rsquo;est permis, mais il devra être publié pour paraître sur le site.
                    </>
                  )}
                </>
              ) : (
                <>
                  Sans événement, ce tournoi <strong>est</strong> le rendez-vous : il paraît
                  lui-même à l&rsquo;agenda et sur l&rsquo;accueil, et il faut alors indiquer
                  son lieu plus bas. Ne rattachez que s&rsquo;il fait partie d&rsquo;un
                  événement plus large.
                </>
              )}
            </span>
          </p>
          {erreurs.eventId ? <p className={styles.erreur}>{erreurs.eventId}</p> : null}
        </div>

        <ChampTexte
          id="tournoi-name"
          name="name"
          label="Nom du tournoi (obligatoire)"
          valeur={name}
          onChange={changerNom}
          max={NOM_MAX}
          aide="Le titre affiché sur la page du tournoi. Exemple : « CS2 2v2 — Game'in Reims 2026 »."
          erreur={erreurs.name}
        />

        <ChampTexte
          id="tournoi-game"
          name="game"
          label="Jeu (obligatoire)"
          valeur={game}
          onChange={setGame}
          max={JEU_MAX}
          aide="Le jeu tel qu'on le nomme. Exemple : « Counter-Strike 2 », « Teamfight Tactics »."
          erreur={erreurs.game}
        />

        {/* ── L'identifiant d'adresse ──────────────────────────────────────────────────
            🔴 IL SE DÉRIVE DU NOM, PUIS IL SE FIGE À LA PUBLICATION (A3). Les deux règles
            sont dites AVANT le geste, jamais découvertes après. */}
        <ChampTexte
          id="tournoi-slug"
          name="slug"
          label="Adresse de la page (obligatoire)"
          valeur={slug}
          onChange={(valeur) => {
            setAdresseLiee(false);
            setSlug(valeur);
          }}
          max={IDENTIFIANT_MAX}
          aide={
            adresseFigee
              ? "Ce tournoi est publié : son adresse est FIGÉE. Elle a pu être partagée sur Discord, imprimée sur un flyer ou lue en direct — la changer casserait ces liens. Pour la modifier, retirez d'abord le tournoi du site."
              : `La page du tournoi sera à l'adresse /tournois/${slug || "…"}. Lettres non accentuées, chiffres et tirets. Elle se remplit toute seule d'après le nom tant que vous n'y touchez pas ; une fois le tournoi publié, elle ne changera plus.`
          }
          erreur={erreurs.slug}
        />

        <ChampTexte
          id="tournoi-startsAt"
          name="startsAt"
          label="Début du tournoi (obligatoire)"
          type="datetime-local"
          valeur={startsAt}
          onChange={setStartsAt}
          aide="Heure de Paris. C'est l'heure DU TOURNOI, qui peut différer de celle de l'événement : à la Game'in Reims, dix animations se succèdent sur deux jours."
          erreur={erreurs.startsAt}
        />

        {/* 🔴 L'HEURE DE FIN — FACULTATIVE, ET L'AIDE DIT L'EFFET SUR LE SITE (Story 9.6).
            Patron `AIDES_MODE_INSCRIPTION` : on écrit au bénévole ce que la page du tournoi
            affichera, pas le format attendu du champ.
            ⚠️ Elle nomme le cas « après minuit » parce que c'est la faute de saisie la plus
            probable sur un tournoi du soir — et parce que le site, lui, l'affiche correctement
            (il NOMME le jour quand la fin n'est pas le même). */}
        <ChampTexte
          id="tournoi-endsAt"
          name="endsAt"
          label="Fin du tournoi (facultative)"
          type="datetime-local"
          valeur={endsAt}
          onChange={setEndsAt}
          aide="Heure de Paris. Laissée vide, la page n'annonce aucune fin. Une fin après minuit se saisit avec la date du lendemain — le site l'affiche alors en toutes lettres."
          erreur={erreurs.endsAt}
        />

        {/* 🔴 CE CHAMP CHANGE DE NATURE SELON LE RATTACHEMENT — 9.5.
            Son libellé disait « Salle ou espace (facultatif) » et son aide « le lieu général
            vient déjà de l'agenda » : **vrai tant que tout tournoi avait un événement**, faux
            depuis que le rattachement est facultatif. C'est `pieges/patron-eprouve-une-seule-
            nature.md` — le commentaire qui justifiait le comportement décrivait une
            CORRÉLATION prise pour une règle.
            ⚠️ Rattaché ⇒ précision facultative DANS le lieu de l'événement. Détaché ⇒ c'est
            le SEUL lieu qui existe, et `tournament_a_un_lieu` l'exige. */}
        <ChampTexte
          id="tournoi-venueName"
          name="venueName"
          label={
            evenementChoisi ? "Salle ou espace (facultatif)" : "Lieu du tournoi (obligatoire)"
          }
          valeur={venueName}
          onChange={setVenueName}
          max={LIEU_MAX}
          aide={
            evenementChoisi
              ? "Seulement s'il faut préciser où, DANS le lieu de l'événement. Exemple : « Hall B, scène esport ». Le lieu général vient déjà de l'agenda."
              : "Sans événement de rattachement, c'est le seul lieu affiché : indiquez-le. Exemple : « En ligne », « Le Kraken, Reims »."
          }
          erreur={erreurs.venueName}
        />

        {/* Le tarif (Story 9.6, dette R55). ⚠️ L'aide dit explicitement que le vide n'affiche
            RIEN — surtout pas « Gratuit ». C'est la règle la plus facile à supposer de travers,
            et celle dont l'erreur serait publique. */}
        <ChampTexte
          id="tournoi-priceText"
          name="priceText"
          label="Tarif (facultatif)"
          valeur={priceText}
          onChange={setPriceText}
          max={TARIF_MAX}
          aide="En toutes lettres : « 5 € », « Gratuit », « 3 € adhérents ». Laissé vide, la page n'affiche aucun tarif — elle n'annonce pas la gratuité à votre place."
          erreur={erreurs.priceText}
        />

        {/* ── Le visuel ────────────────────────────────────────────────────────────────
            🔴 UNE PHOTO DE LA **GALERIE**, PAS UN TÉLÉVERSEMENT (arbitrage A2). Une 4ᵉ
            famille de médias coûterait une route, son schéma, sa garde, et rouvrirait le
            piège du 404 silencieux de la Story 6.5. La galerie sait déjà téléverser,
            décrire et publier.
            ⚠️ SEULES LES PHOTOS **PUBLIÉES** SONT PROPOSÉES, et l'écran dit pourquoi : la
            route qui sert les médias ne rend que du publié (garde de la 6.4). Proposer un
            brouillon laisserait choisir un visuel qui ne s'afficherait jamais. */}
        <div className={styles.champ}>
          <label className={styles.label} htmlFor="tournoi-photoId">
            Visuel (facultatif)
          </label>
          <select
            id="tournoi-photoId"
            name="photoId"
            className={styles.saisie}
            value={photoId}
            onChange={(evenement) => setPhotoId(evenement.target.value)}
            aria-invalid={erreurs.photoId ? "true" : undefined}
            aria-describedby="tournoi-photoId-aide"
          >
            <option value="">Aucun visuel</option>
            {photos.map((photo) => (
              <option key={photo.id} value={photo.id}>
                {photo.alt}
              </option>
            ))}
          </select>
          <p className={styles.sousChamp} id="tournoi-photoId-aide">
            <span>
              {photos.length > 0 ? (
                <>
                  Choisi parmi les photos de la <strong>galerie</strong> — il n&rsquo;y a rien
                  à téléverser ici. Seules les photos <strong>publiées</strong> sont
                  proposées : une photo en brouillon ne s&rsquo;afficherait nulle part.
                </>
              ) : (
                <>
                  Aucune photo publiée dans la galerie pour l&rsquo;instant. Téléversez-en une
                  depuis la section <strong>Galerie</strong> et publiez-la : elle apparaîtra
                  ici. Un tournoi sans visuel s&rsquo;affiche très bien.
                </>
              )}
            </span>
          </p>
          {erreurs.photoId ? <p className={styles.erreur}>{erreurs.photoId}</p> : null}
        </div>
      </fieldset>

      {/* ══════════════════════════════════════════════════════════════════════════════════
          ② COMMENT S'INSCRIRE (A23 ②)
          ══════════════════════════════════════════════════════════════════════════════ */}
      <fieldset className={propre.bloc}>
        <legend className={propre.blocTitre}>Comment s&rsquo;inscrire</legend>
        <p className={propre.blocAide}>
          C&rsquo;est la partie que le visiteur cherche en premier quand le tournoi
          l&rsquo;intéresse.
        </p>

        <div className={styles.champ}>
          <label className={styles.label} htmlFor="tournoi-registrationMode">
            Mode d&rsquo;inscription (obligatoire)
          </label>
          <select
            id="tournoi-registrationMode"
            name="registrationMode"
            className={styles.saisie}
            value={registrationMode}
            onChange={(evenement) =>
              setRegistrationMode(evenement.target.value as TournamentRegistrationMode)
            }
            aria-invalid={erreurs.registrationMode ? "true" : undefined}
            aria-describedby="tournoi-registrationMode-aide"
          >
            {REGISTRATION_MODES.map((valeur) => (
              <option key={valeur} value={valeur}>
                {LIBELLES_MODE_INSCRIPTION[valeur]}
              </option>
            ))}
          </select>
          {/* L'aide CHANGE avec le choix — deux paragraphes affichés en permanence ne
              seraient lus par personne. `aria-live="polite"` : le lecteur d'écran annonce la
              nouvelle explication quand la sélection change. */}
          <p className={styles.sousChamp} id="tournoi-registrationMode-aide" aria-live="polite">
            <span>{AIDES_MODE_INSCRIPTION[registrationMode]}</span>
          </p>
          {erreurs.registrationMode ? (
            <p className={styles.erreur}>{erreurs.registrationMode}</p>
          ) : null}
        </div>

        <ChampTexte
          id="tournoi-registrationUrl"
          name="registrationUrl"
          label={
            registrationMode === "mately"
              ? "Adresse d'inscription (obligatoire pour MATELY)"
              : "Adresse d'inscription (facultative)"
          }
          valeur={registrationUrl}
          onChange={setRegistrationUrl}
          max={URL_MAX}
          aide="L'adresse complète, avec https:// — c'est elle qui devient le bouton « S'inscrire ». Une adresse partielle enverrait le visiteur sur une page inexistante du site de l'asso."
          erreur={erreurs.registrationUrl}
        />

        <div className={styles.champ}>
          <label className={styles.label} htmlFor="tournoi-registrationState">
            État des inscriptions
          </label>
          <select
            id="tournoi-registrationState"
            name="registrationState"
            className={styles.saisie}
            value={registrationState}
            onChange={(evenement) =>
              setRegistrationState(evenement.target.value as TournamentRegistrationState)
            }
            aria-invalid={erreurs.registrationState ? "true" : undefined}
            aria-describedby="tournoi-registrationState-aide"
          >
            {REGISTRATION_STATES.map((valeur) => (
              <option key={valeur} value={valeur}>
                {LIBELLES_ETAT_INSCRIPTION[valeur]}
              </option>
            ))}
          </select>
          <p className={styles.sousChamp} id="tournoi-registrationState-aide" aria-live="polite">
            <span>{AIDES_ETAT_INSCRIPTION[registrationState]}</span>
          </p>
          {erreurs.registrationState ? (
            <p className={styles.erreur}>{erreurs.registrationState}</p>
          ) : null}
        </div>

        {/* ⚠️ FAIT À DIRE, PAS À TAIRE. « À venir / passé » se DÉRIVE de la date du tournoi ;
            l'état ci-dessus est un fait SÉPARÉ. Les deux se combinent librement, et c'est
            exactement le piège que la note d'architecture (§6 ①) demande de désamorcer :
            sans cette phrase, on croirait qu'un tournoi passé ferme ses inscriptions tout
            seul, ou qu'ouvrir les inscriptions le fait remonter dans « à venir ». */}
        <p className={styles.regle} role="note">
          <strong>Cet état ne dit pas si le tournoi est passé.</strong> « À venir » et « déjà
          passé » se calculent tout seuls d&rsquo;après la date ci-dessus — il n&rsquo;y a
          rien à basculer. Un tournoi à venir dont les inscriptions sont déjà closes est
          normal, et l&rsquo;inverse aussi.
        </p>

        <ChampTexte
          id="tournoi-capacity"
          name="capacity"
          label="Nombre de places (facultatif)"
          valeur={capacity}
          onChange={setCapacity}
          aide={`Combien de joueurs ou d'équipes sont attendus. Laissez vide si ce n'est pas décidé. Maximum ${PLACES_MAX}.`}
          erreur={erreurs.capacity}
        />
      </fieldset>

      {/* ══════════════════════════════════════════════════════════════════════════════════
          ③ LE DÉROULÉ ANNONCÉ (A23 ③)
          ══════════════════════════════════════════════════════════════════════════════ */}
      <fieldset className={propre.bloc}>
        <legend className={propre.blocTitre}>Le déroulé annoncé</legend>
        <p className={propre.blocAide}>
          Ce qu&rsquo;on promet au public. Tout est facultatif — mieux vaut ne rien annoncer
          que d&rsquo;annoncer ce dont on n&rsquo;est pas sûr.
        </p>

        <ChampTexte
          id="tournoi-formatText"
          name="formatText"
          label="Format, en toutes lettres (facultatif)"
          valeur={formatText}
          onChange={setFormatText}
          max={FORMAT_MAX}
          multiligne
          aide="Comment ça se déroule, dit simplement. Exemple : « Deux poules de 4 en BO1, puis demi-finales et finale en BO3 »."
          erreur={erreurs.formatText}
        />

        <ChampTexte
          id="tournoi-matchDurationMinutes"
          name="matchDurationMinutes"
          label="Durée d'un match, en minutes (facultative)"
          valeur={matchDuration}
          onChange={setMatchDuration}
          aide={`Une estimation, pour que le visiteur sache combien de temps prévoir. Un nombre entier de minutes, ${DUREE_MATCH_MAX} au maximum.`}
          erreur={erreurs.matchDurationMinutes}
        />

        <ChampTexte
          id="tournoi-prizes"
          name="prizes"
          label="Lots (facultatif)"
          valeur={prizes}
          onChange={setPrizes}
          max={LOTS_MAX}
          aide="Une ligne. Exemple : « Bons d'achat offerts par nos partenaires »."
          erreur={erreurs.prizes}
        />

        {/* 🔴 LE FORMAT ANNONCÉ EST ÉDITORIAL, ET LES PHASES FERONT FOI (A23 ③). Ce fait est
            décidé MAINTENANT, avant que le cas se présente — sinon on aura deux descriptions
            du même format et personne ne saura laquelle croire. Le dire au point de saisie
            évite que quelqu'un tienne ce texte à jour à la main pendant un tournoi. */}
        <p className={styles.regle} role="note">
          <strong>Ce texte est une annonce, pas le déroulé réel.</strong> Quand le site saura
          faire tourner les tournois, c&rsquo;est le déroulé réel qui fera foi et
          s&rsquo;affichera à la place. Écrivez donc ici ce que vous <em>promettez</em>, sans
          craindre de devoir le corriger pendant l&rsquo;événement.
        </p>
      </fieldset>

      {/* ══════════════════════════════════════════════════════════════════════════════════
          ④ LE PODIUM (A23 ①)
          ══════════════════════════════════════════════════════════════════════════════ */}
      <fieldset className={propre.bloc}>
        <legend className={propre.blocTitre}>Le podium</legend>
        {/* ⚠️ CE BLOC EST TOUJOURS AFFICHÉ, MÊME SUR UN TOURNOI À VENIR — et c'est un choix.
            Le masquer aurait demandé de lire l'horloge pendant le rendu (impureté refusée par
            `react-hooks/purity`), et surtout : un tournoi saisi APRÈS coup, pour l'historique,
            est un cas nominal. La phrase dit quand remplir, ce qui est plus utile qu'un champ
            qui apparaît et disparaît. */}
        <p className={propre.blocAide}>
          À remplir <strong>après</strong> le tournoi. Laissez vide tant qu&rsquo;il
          n&rsquo;a pas eu lieu — le podium ne s&rsquo;affichera que sur un tournoi passé.
        </p>

        <ChampTexte
          id="tournoi-podiumFirst"
          name="podiumFirst"
          label="Première place (facultative)"
          valeur={podiumFirst}
          onChange={setPodiumFirst}
          max={PODIUM_MAX}
          aide="Le pseudo du joueur ou le nom de l'équipe."
          erreur={erreurs.podiumFirst}
        />
        <ChampTexte
          id="tournoi-podiumSecond"
          name="podiumSecond"
          label="Deuxième place (facultative)"
          valeur={podiumSecond}
          onChange={setPodiumSecond}
          max={PODIUM_MAX}
          erreur={erreurs.podiumSecond}
        />
        <ChampTexte
          id="tournoi-podiumThird"
          name="podiumThird"
          label="Troisième place (facultative)"
          valeur={podiumThird}
          onChange={setPodiumThird}
          max={PODIUM_MAX}
          erreur={erreurs.podiumThird}
        />

        <p className={styles.regle} role="note">
          <strong>Remplissez dans l&rsquo;ordre.</strong> Une deuxième place sans première,
          ou une troisième sans deuxième, est refusée : ce serait un podium à trou.
        </p>
      </fieldset>

      {etat.statut === "erreur" && etat.error ? (
        <p className={styles.erreur} role="alert">
          {etat.error}
        </p>
      ) : null}

      {etat.statut === "succes" && !creation ? (
        <div className={styles.confirmation} role="status">
          <p>Enregistré.</p>
          {/* R23 : l'heure saisie n'existe pas ou est ambiguë (changement d'heure). Le
              message vient du serveur, qui a fait le diagnostic sur la saisie brute. */}
          {etat.avertissement ? <p>{etat.avertissement}</p> : null}
        </div>
      ) : null}

      <div className={styles.actions}>
        {/* Jamais `disabled` — patron 5.1 : un bouton grisé pendant une latence réseau donne
            l'impression d'une page morte. */}
        <Button type="submit">
          {enCours
            ? "Enregistrement…"
            : creation
              ? "Créer le tournoi"
              : "Enregistrer les modifications"}
        </Button>
        <Link className={styles.lien} href="/admin/tournois">
          Retour aux tournois
        </Link>
      </div>

      {creation ? (
        /* ⚠️ DIT AVANT LE GESTE, PAS APRÈS : un tournoi naît en brouillon. Sans cette phrase,
           on croit avoir publié et on cherche pourquoi le site ne change pas. */
        <p className={styles.avertissement} role="note">
          Le tournoi sera créé <strong>en brouillon</strong>. Vous pourrez le publier depuis
          la liste — et tant que la page publique des tournois n&rsquo;est pas en ligne,
          publier ne change encore rien pour les visiteurs.
        </p>
      ) : null}
    </form>
  );
}
