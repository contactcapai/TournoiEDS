"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@repo/ui";

import { ChampTexte } from "@/components/admin/ChampTexte/ChampTexte";
import { LIBELLES_FAMILLE } from "@/lib/familles-ateliers";
import {
  PUBLIC_MAX,
  RESUME_MAX,
  TITRE_MAX,
  WORKSHOP_FAMILIES,
  workshopInputSchema,
  type WorkshopFamily,
} from "@/lib/schemas/workshop";
import { creerAtelier, enregistrerAtelier } from "@/server/actions/ateliers";
import styles from "@/styles/admin-form.module.css";

/**
 * Création et modification d'un atelier (Story 6.9, FR34, FR10, FR16, FR33).
 *
 * Reprend LITTÉRALEMENT le patron de saisie posé par `EventForm` (6.3), `PhotoForm` (6.4) puis
 * `PartenaireForm` (6.5) :
 *   · tous les champs CONTRÔLÉS — React 19 réinitialise les champs non contrôlés d'un
 *     `<form action={fn}>` après résolution de l'action, succès COMME échec (défaut réel de la
 *     Story 5.1). Ne pas « simplifier » en repassant en non contrôlé ;
 *   · validation CLIENT avec le MÊME schéma Zod que le serveur, pour que le focus au premier
 *     champ en erreur n'attende pas un aller-retour réseau — le serveur re-valide quand même ;
 *   · focus au premier champ en erreur dans l'ordre VISUEL, pas dans celui du schéma ;
 *   · bouton JAMAIS `disabled` pendant l'attente (patron 5.1) : le libellé porte l'état.
 *
 * 🔴 CE FORMULAIRE NE PORTE NI LE RANG, NI LA PUBLICATION, et l'omission EST la garde : il ne
 * les **soumet pas**, donc il ne peut pas écraser une publication basculée depuis la liste
 * pendant qu'il était ouvert. C'est la dette **R35** (acceptée en 6.3) rendue sans objet par le
 * découpage plutôt que par un jeton de version.
 *
 * 🔴 ET IL NE PORTE **AUCUN** CHAMP DE TARIF, DE DURÉE NI D'EFFECTIF — c'est le livrable, pas
 * une omission. **FR10** fait de `/animations` une offre d'**utilité sociale** et non une
 * prestation ; **FR16** interdit tout chiffre de communauté. L'AC exige que ce soit un
 * **garde-fou de schéma** : la table n'a pas ces colonnes, donc le formulaire ne peut pas les
 * proposer, donc personne n'a à se souvenir de la règle. ⚠️ Ne pas « compléter » ce formulaire.
 */

/** Ordre VISUEL des champs — c'est lui qui décide où va le focus. */
const ORDRE_CHAMPS = ["title", "family", "summary", "audience"] as const;

/**
 * Ce que chaque famille recouvre, dit AU MOMENT DU CHOIX.
 *
 * ⚠️ Les LIBELLÉS viennent de `lib/familles-ateliers.ts` — un seul exemplaire pour le site
 * public, la liste d'admin et ce `<select>`. Seules les AIDES sont propres à cet écran : elles
 * n'ont de sens que pour la personne qui saisit.
 *
 * ⚠️ `Record<WorkshopFamily, string>` EXHAUSTIF : ajouter une valeur à l'enum sans lui donner
 * d'aide CASSE LE TYPECHECK.
 */
const AIDES: Record<WorkshopFamily, string> = {
  atelier:
    "On installe les postes et on encadre les parties — tournoi léger ou jeu libre. C'est la famille de tout ce qui consiste à faire jouer les gens ensemble.",
  sensibilisation:
    "Un temps d'échange sur les usages des écrans, abordé en joueurs. C'est la famille de tout ce qui se parle plutôt que se joue.",
  evenement:
    "On vient tenir l'espace jeu sur un événement organisé par quelqu'un d'autre : fête de quartier, forum, journée portes ouvertes.",
};

type EtatForm = {
  statut: "vierge" | "succes" | "erreur";
  error?: string;
  fieldErrors?: Record<string, string>;
};

const ETAT_INITIAL: EtatForm = { statut: "vierge" };

export interface AtelierFormProps {
  /** `undefined` = création. Sinon : les valeurs à pré-remplir. */
  atelier?: {
    id: string;
    title: string;
    family: WorkshopFamily;
    summary: string | null;
    audience: string | null;
  };
}

export function AtelierForm({ atelier }: AtelierFormProps) {
  const router = useRouter();
  const creation = atelier === undefined;

  const [title, setTitle] = useState(atelier?.title ?? "");
  const [family, setFamily] = useState<WorkshopFamily>(atelier?.family ?? "atelier");
  const [summary, setSummary] = useState(atelier?.summary ?? "");
  const [audience, setAudience] = useState(atelier?.audience ?? "");

  // La famille de DÉPART, figée au montage : elle sert à n'avertir du changement de rang que
  // si la famille change réellement (voir l'avertissement plus bas).
  const familleInitiale = atelier?.family;

  const [etat, soumettre, enCours] = useActionState(
    async (_precedent: EtatForm, formData: FormData): Promise<EtatForm> => {
      const analyse = workshopInputSchema
        .omit({ sortOrder: true, isPublished: true })
        .safeParse({
          title: formData.get("title"),
          family: formData.get("family"),
          summary: formData.get("summary"),
          audience: formData.get("audience"),
        });

      if (!analyse.success) {
        const fieldErrors: Record<string, string> = {};
        for (const souci of analyse.error.issues) {
          const clef = souci.path[0];
          if (typeof clef === "string" && !(clef in fieldErrors)) fieldErrors[clef] = souci.message;
        }
        return {
          statut: "erreur",
          error: analyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
          fieldErrors,
        };
      }

      try {
        const resultat = creation
          ? await creerAtelier(formData)
          : await enregistrerAtelier(atelier.id, formData);

        if (!resultat.ok) {
          return { statut: "erreur", error: resultat.error, fieldErrors: resultat.fieldErrors };
        }
        // Ne concerne que le cache ROUTEUR du navigateur : `/animations` est `force-dynamic`,
        // il n'y a AUCUN cache de données à invalider.
        router.refresh();
        // 🔴 À LA CRÉATION, ON REVIENT À LA LISTE — et non sur la fiche, contrairement aux
        // partenaires. Là-bas la fiche portait le téléversement du logo, donc l'étape
        // suivante y vivait. Ici il n'y a rien de plus à faire sur la fiche : le geste
        // suivant est « publier », et il vit sur la ligne de la liste.
        if (creation) router.push("/admin/ateliers");
        return { statut: "succes" };
      } catch {
        // 🔴 `exigerRoleAction()` s'exécute AVANT le `try` de la Server Action et **LÈVE** : une
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
    if (premier) document.getElementById(`atelier-${premier}`)?.focus();
  }, [etat.fieldErrors]);

  const erreurs = etat.fieldErrors ?? {};
  const changeDeFamille = familleInitiale !== undefined && familleInitiale !== family;

  return (
    <form action={soumettre} className={styles.form} noValidate>
      <ChampTexte
        id="atelier-title"
        name="title"
        label="Intitulé (obligatoire)"
        valeur={title}
        onChange={setTitle}
        max={TITRE_MAX}
        aide="Le nom de l'atelier tel qu'il apparaîtra sur la page Animations, en gras. Exemple : « Tournoi Mario Kart en maison de quartier »."
        erreur={erreurs.title}
      />

      {/* ── La famille ─────────────────────────────────────────────────────────────────
          🔴 OBLIGATOIRE, ET L'ÉCRAN DIT POURQUOI : la page publique est GROUPÉE par
          famille. Un atelier sans famille n'aurait nulle part où s'afficher. */}
      <div className={styles.champ}>
        <label className={styles.label} htmlFor="atelier-family">
          Famille (obligatoire)
        </label>
        <select
          id="atelier-family"
          name="family"
          className={styles.saisie}
          value={family}
          onChange={(evenement) => setFamily(evenement.target.value as WorkshopFamily)}
          aria-invalid={erreurs.family ? "true" : undefined}
          aria-describedby="atelier-family-aide"
        >
          {WORKSHOP_FAMILIES.map((valeur) => (
            <option key={valeur} value={valeur}>
              {LIBELLES_FAMILLE[valeur]}
            </option>
          ))}
        </select>
        {/* L'aide CHANGE avec le choix — trois paragraphes affichés en permanence ne
            seraient lus par personne. `aria-live="polite"` : le lecteur d'écran annonce la
            nouvelle explication quand la sélection change. */}
        <p className={styles.sousChamp} id="atelier-family-aide" aria-live="polite">
          <span>{AIDES[family]}</span>
        </p>
        {erreurs.family ? <p className={styles.erreur}>{erreurs.family}</p> : null}
      </div>

      {/* 🔴 CONSÉQUENCE DITE AVANT LE GESTE, PAS DÉCOUVERTE APRÈS. Changer de famille donne
          à l'atelier le rang suivant de sa NOUVELLE famille : son ancien rang n'y aurait
          aucun sens (collision, ou propulsion en tête). Sans cette phrase, quelqu'un qui a
          soigneusement ordonné une famille verrait son entrée « sauter à la fin » sans
          comprendre. */}
      {changeDeFamille ? (
        <p className={styles.avertissement} role="status">
          Vous changez cet atelier de famille. Il sera placé <strong>en dernier</strong> dans
          « {LIBELLES_FAMILLE[family]} » — son ordre actuel n&rsquo;a pas de sens dans une
          autre famille. Vous pourrez le remonter depuis la liste.
        </p>
      ) : null}

      <ChampTexte
        id="atelier-summary"
        name="summary"
        label="Description (facultative)"
        valeur={summary}
        onChange={setSummary}
        max={RESUME_MAX}
        multiligne
        aide="Une LIGNE de contexte, affichée à la suite de l'intitulé. Exemple : « Deux heures, en autonomie ou encadré, sur console ». Pas un paragraphe."
        erreur={erreurs.summary}
      />

      <ChampTexte
        id="atelier-audience"
        name="audience"
        label="Public visé (facultatif)"
        valeur={audience}
        onChange={setAudience}
        max={PUBLIC_MAX}
        aide="À qui l'atelier s'adresse. Exemple : « Collégiens et lycéens » ou « Tout public à partir de 8 ans »."
        erreur={erreurs.audience}
      />

      {/* ══════════════════════════════════════════════════════════════════════════════
          🔴 FR33 ET FR10 RAPPELÉS AU POINT DE SAISIE — PAS DANS UNE DOC
          ══════════════════════════════════════════════════════════════════════════════
          Deux règles de contenu que le formulaire ne peut pas empêcher mécaniquement, et
          qui s'enfreignent de BONNE FOI :
            · nommer un partenariat qu'on espère plutôt qu'un partenariat acquis (FR33) —
              on ne le fait pas par malveillance, on le fait parce qu'on y croit ;
            · glisser un tarif ou une durée dans la description, alors que la page dit en
              toutes lettres que « le format exact se définit avec vous ».
          ⚠️ AUCUN TIERS N'EST NOMMÉ ICI. Nommer l'organisme dont le partenariat est en
          discussion ferait exactement ce que cette phrase interdit. */}
      <p className={styles.regle} role="note">
        <strong>Décrivez ce qui existe déjà.</strong> Un partenariat en cours de discussion
        ne se nomme pas ici tant qu&rsquo;il n&rsquo;est pas acquis — le site prouve par les
        actes, jamais par les intentions.
        <br />
        Et <strong>pas de tarif, pas de durée, pas de nombre de places</strong> : la page
        annonce au visiteur que le format se cale avec lui. C&rsquo;est pour cela
        qu&rsquo;il n&rsquo;y a pas de champ pour ça.
      </p>

      {etat.statut === "erreur" && etat.error ? (
        <p className={styles.erreur} role="alert">
          {etat.error}
        </p>
      ) : null}

      {etat.statut === "succes" && !creation ? (
        <div className={styles.confirmation} role="status">
          <p>Enregistré. Le changement est visible sur le site au rechargement suivant.</p>
        </div>
      ) : null}

      <div className={styles.actions}>
        {/* Jamais `disabled` — patron 5.1 : un bouton grisé pendant une latence réseau donne
            l'impression d'une page morte. */}
        <Button type="submit">
          {enCours
            ? "Enregistrement…"
            : creation
              ? "Créer l'atelier"
              : "Enregistrer les modifications"}
        </Button>
        <Link className={styles.lien} href="/admin/ateliers">
          Retour aux ateliers
        </Link>
      </div>

      {creation ? (
        /* ⚠️ DIT AVANT LE GESTE, PAS APRÈS : un atelier naît en brouillon. Sans cette
           phrase, on croit avoir publié et on cherche pourquoi le site ne change pas. */
        <p className={styles.avertissement} role="note">
          L&rsquo;atelier sera créé <strong>en brouillon</strong> : il n&rsquo;apparaîtra pas
          sur le site tant que vous ne l&rsquo;aurez pas publié depuis la liste.
        </p>
      ) : null}
    </form>
  );
}
