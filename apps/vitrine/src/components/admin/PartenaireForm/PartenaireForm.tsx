"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@repo/ui";

import { ChampTexte } from "@/components/admin/ChampTexte/ChampTexte";
import {
  DESCRIPTION_MAX,
  LINK_MAX,
  NAME_MAX,
  PARTNER_CATEGORIES,
  partnerInputSchema,
  type PartnerCategory,
} from "@/lib/schemas/partner";
import { creerPartenaire, enregistrerPartenaire } from "@/server/actions/partenaires";
import styles from "@/styles/admin-form.module.css";
import propre from "./PartenaireForm.module.css";

/**
 * Création et modification d'un partenaire (Story 6.5, FR22, FR33).
 *
 * Reprend LITTÉRALEMENT le patron de saisie posé par `EventForm` (6.3) puis `PhotoForm` (6.4) :
 *   · tous les champs CONTRÔLÉS — React 19 réinitialise les champs non contrôlés d'un
 *     `<form action={fn}>` après résolution de l'action, succès COMME échec (défaut réel de la
 *     Story 5.1). Ne pas « simplifier » en repassant en non contrôlé ;
 *   · validation CLIENT avec le MÊME schéma Zod que le serveur, pour que le focus au premier
 *     champ en erreur n'attende pas un aller-retour réseau — le serveur re-valide quand même ;
 *   · focus au premier champ en erreur dans l'ordre VISUEL, pas dans celui du schéma ;
 *   · bouton JAMAIS `disabled` pendant l'attente (patron 5.1) : le libellé porte l'état.
 *
 * ⚠️ CE FORMULAIRE NE PORTE NI LE LOGO, NI LE RANG, NI LA PUBLICATION — et c'est une garde,
 * pas un oubli. Chacun a son action dédiée, donc ce formulaire ne les **soumet pas** : il ne
 * peut pas écraser une publication basculée depuis la liste pendant qu'il était ouvert. C'est
 * la dette **R35** (acceptée en 6.3 sur `enregistrerEvenement`) rendue sans objet par le
 * découpage plutôt que par un jeton de version.
 */

/** Ordre VISUEL des champs — c'est lui qui décide où va le focus. */
const ORDRE_CHAMPS = ["name", "category", "description", "link"] as const;

/**
 * 🔴 LIBELLÉS ET GARDE-FOU ÉDITORIAL DES QUATRE CATÉGORIES — **FR33, AU POINT DE SAISIE**.
 *
 * `seed.ts` le disait déjà noir sur blanc : *« cette garde vit ici aujourd'hui parce que ce
 * script est le seul point d'écriture. Avec le back-office (Story 6.5) elle devra AUSSI être
 * rappelée au point de SAISIE : un commentaire dans un fichier que le bénévole ne lira jamais
 * ne protège rien. »*
 *
 * ⚠️ C'est la règle de contenu **la plus facile à enfreindre de bonne foi** : personne
 * n'ajoute une collectivité par malveillance, on l'ajoute parce qu'on espère la convaincre.
 * D'où une phrase par catégorie, au moment du choix — et **non bloquante** : on ne peut pas
 * prouver qu'un soutien est acquis, on peut poser la question au bon moment.
 *
 * ⚠️ `Record<PartnerCategory, …>` EXHAUSTIF : ajouter une valeur à l'enum sans lui donner de
 * libellé CASSE LE TYPECHECK. Même garde que le `CATEGORY_LABELS` de `/partenaires` (4.2), et
 * pour la même raison — un objet indexé librement rendrait une option anonyme, en silence.
 */
const CATEGORIES: Record<PartnerCategory, { libelle: string; aide: string }> = {
  sponsor: {
    libelle: "Sponsor",
    aide: "Une structure qui soutient l'association matériellement ou financièrement, et qui l'a déjà fait.",
  },
  partenaire: {
    libelle: "Partenaire",
    aide: "Une association ou une structure avec qui l'asso travaille réellement — pas une simple connaissance.",
  },
  soutien: {
    libelle: "Soutien (institutionnel)",
    aide:
      "Un appui ACQUIS, déjà accordé. ⚠️ Le Département de la Marne, la Région Grand Est et " +
      "le Grand Reims sont des structures à convaincre, pas des soutiens : les inscrire ici " +
      "les afficherait comme acquis sur le site public.",
  },
  participation: {
    libelle: "Participation",
    aide:
      "Un événement où l'asso tient un stand (Game in Reims), ou une fédération dont elle est " +
      "adhérente (France Esport). Ce n'est pas un partenariat : le dire autrement affirmerait " +
      "une relation qui n'existe pas.",
  },
};

type EtatForm = {
  statut: "vierge" | "succes" | "erreur";
  error?: string;
  fieldErrors?: Record<string, string>;
};

const ETAT_INITIAL: EtatForm = { statut: "vierge" };

export interface PartenaireFormProps {
  /** `undefined` = création. Sinon : les valeurs à pré-remplir. */
  partenaire?: {
    id: string;
    name: string;
    category: PartnerCategory;
    description: string | null;
    link: string | null;
  };
}

export function PartenaireForm({ partenaire }: PartenaireFormProps) {
  const router = useRouter();
  const creation = partenaire === undefined;

  const [name, setName] = useState(partenaire?.name ?? "");
  const [category, setCategory] = useState<PartnerCategory>(partenaire?.category ?? "sponsor");
  const [description, setDescription] = useState(partenaire?.description ?? "");
  const [link, setLink] = useState(partenaire?.link ?? "");

  const [etat, soumettre, enCours] = useActionState(
    async (_precedent: EtatForm, formData: FormData): Promise<EtatForm> => {
      const analyse = partnerInputSchema
        .omit({ logo: true, sortOrder: true, isPublished: true })
        .safeParse({
          name: formData.get("name"),
          category: formData.get("category"),
          description: formData.get("description"),
          link: formData.get("link"),
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
          ? await creerPartenaire(formData)
          : await enregistrerPartenaire(partenaire.id, formData);

        if (!resultat.ok) {
          return { statut: "erreur", error: resultat.error, fieldErrors: resultat.fieldErrors };
        }
        // Ne concerne que le cache ROUTEUR du navigateur : les pages publiques sont
        // `force-dynamic`, il n'y a AUCUN cache de données à invalider.
        router.refresh();
        // 🔴 À LA CRÉATION, ON VA SUR LA FICHE — c'est là que vit le téléversement du logo,
        // et une création qui resterait sur un formulaire vide ferait chercher où déposer le
        // fichier. L'ordre est délibéré : la ligne existe AVANT que le fichier soit écrit,
        // donc aucun octet ne peut se retrouver sans ligne pour le porter.
        if (creation) router.push(`/admin/partenaires/${resultat.data.id}`);
        return { statut: "succes" };
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
    if (premier) document.getElementById(`partenaire-${premier}`)?.focus();
  }, [etat.fieldErrors]);

  const erreurs = etat.fieldErrors ?? {};

  return (
    <form action={soumettre} className={styles.form} noValidate>
      <ChampTexte
        id="partenaire-name"
        name="name"
        label="Nom (obligatoire)"
        valeur={name}
        onChange={setName}
        max={NAME_MAX}
        aide="Le nom tel qu'il doit apparaître. C'est aussi le texte que lira un lecteur d'écran à la place du logo — écrivez-le comme la structure l'écrit elle-même."
        erreur={erreurs.name}
      />

      {/* ── La catégorie, et le garde-fou FR33 AU MOMENT DU CHOIX ───────────────────── */}
      <div className={styles.champ}>
        <label className={styles.label} htmlFor="partenaire-category">
          Catégorie (obligatoire)
        </label>
        <select
          id="partenaire-category"
          name="category"
          className={styles.saisie}
          value={category}
          onChange={(evenement) => setCategory(evenement.target.value as PartnerCategory)}
          aria-invalid={erreurs.category ? "true" : undefined}
          aria-describedby="partenaire-category-aide"
        >
          {PARTNER_CATEGORIES.map((valeur) => (
            <option key={valeur} value={valeur}>
              {CATEGORIES[valeur].libelle}
            </option>
          ))}
        </select>
        {/* 🔴 L'AIDE CHANGE AVEC LE CHOIX, et c'est ce qui la rend lisible : quatre
            paragraphes affichés en permanence ne seraient lus par personne.
            `aria-live="polite"` : le lecteur d'écran annonce la nouvelle explication quand
            la sélection change — sans elle, la garde n'existerait que pour les voyants. */}
        <p className={styles.sousChamp} id="partenaire-category-aide" aria-live="polite">
          <span>{CATEGORIES[category].aide}</span>
        </p>
        {erreurs.category ? <p className={styles.erreur}>{erreurs.category}</p> : null}
      </div>

      {/* ⚠️ RAPPEL PERMANENT, EN PLUS DE L'AIDE CONTEXTUELLE : c'est la règle de contenu la
          plus facile à enfreindre de bonne foi, et elle vaut pour les quatre catégories. */}
      <p className={propre.regle} role="note">
        <strong>Seuls les faits acquis ont leur place ici.</strong> Le site prouve par les
        actes, jamais par les intentions : une structure qu&rsquo;on espère convaincre
        n&rsquo;est pas un soutien, et l&rsquo;afficher comme tel engagerait
        l&rsquo;association sur quelque chose qui n&rsquo;existe pas encore.
      </p>

      <ChampTexte
        id="partenaire-description"
        name="description"
        label="Description (facultative)"
        valeur={description}
        onChange={setDescription}
        max={DESCRIPTION_MAX}
        multiligne
        aide="Une LIGNE de contexte, affichée sous la tuile sur la page Partenaires. Exemple : « Bar à jeux du centre-ville, l'une des étapes du roulement des jeudis ». Pas un paragraphe : le mur s'aligne mal au-delà."
        erreur={erreurs.description}
      />

      <ChampTexte
        id="partenaire-link"
        name="link"
        label="Adresse du site (facultative)"
        valeur={link}
        onChange={setLink}
        max={LINK_MAX}
        aide="L'adresse complète, en commençant par https:// — par exemple https://exemple.fr. Une adresse partielle enverrait le visiteur sur une page inexistante du site de l'asso, c'est pourquoi elle est refusée."
        erreur={erreurs.link}
      />

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
              ? "Créer le partenaire"
              : "Enregistrer les modifications"}
        </Button>
        <Link className={styles.lien} href="/admin/partenaires">
          Retour aux partenaires
        </Link>
      </div>

      {creation ? (
        /* ⚠️ DIT AVANT LE GESTE, PAS APRÈS : on ne peut pas téléverser un logo tant que la
           fiche n'existe pas — sinon un fichier serait écrit sans ligne pour le porter. */
        <p className={styles.avertissement} role="note">
          Le <strong>logo</strong> se téléverse depuis la fiche, une fois celle-ci créée. Vous
          y serez emmené automatiquement.
        </p>
      ) : null}
    </form>
  );
}
