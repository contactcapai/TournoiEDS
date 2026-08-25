"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@repo/ui";

import { ChampTexte } from "@/components/admin/ChampTexte/ChampTexte";
import { memberInputSchema, PRENOM_MAX, ROLE_MAX } from "@/lib/schemas/member";
import { creerMembre, enregistrerMembre } from "@/server/actions/membres";
import styles from "@/styles/admin-form.module.css";

/**
 * Création et modification d'un membre de l'équipe (Story 6.10, FR35, FR9, FR16).
 *
 * Reprend LITTÉRALEMENT le patron de saisie posé par `EventForm` (6.3), `PhotoForm` (6.4),
 * `PartenaireForm` (6.5) puis `AtelierForm` (6.9) :
 *   · tous les champs CONTRÔLÉS — React 19 réinitialise les champs non contrôlés d'un
 *     `<form action={fn}>` après résolution de l'action, succès COMME échec (défaut réel de la
 *     Story 5.1). Ne pas « simplifier » en repassant en non contrôlé ;
 *   · validation CLIENT avec le MÊME schéma Zod que le serveur, pour que le focus au premier
 *     champ en erreur n'attende pas un aller-retour réseau — le serveur re-valide quand même ;
 *   · focus au premier champ en erreur dans l'ordre VISUEL, pas dans celui du schéma ;
 *   · bouton JAMAIS `disabled` pendant l'attente (patron 5.1) : le libellé porte l'état.
 *
 * 🔴 CE FORMULAIRE NE PORTE NI LE PORTRAIT, NI LE RANG, NI LA PUBLICATION, et l'omission EST la
 * garde : il ne les **soumet pas**, donc il ne peut pas écraser une publication basculée depuis
 * la liste pendant qu'il était ouvert (dette **R35**, rendue sans objet par le découpage). Et
 * pour le portrait, l'enjeu est plus fort encore : un champ soumis permettrait de faire pointer
 * un membre vers le fichier d'un AUTRE par un POST direct.
 *
 * 🔴 ET IL NE COLLECTE **QUE** CE QUE LA PAGE REND — pas de nom de famille, pas d'e-mail, pas
 * de téléphone, pas de date d'entrée au bureau. Ce ne sont pas des champs manquants : c'est la
 * **minimisation** RGPD (NFR5). Ajouter un champ ici, ce n'est pas ajouter une fonctionnalité,
 * c'est collecter une donnée personnelle de plus. ⚠️ Ne pas « compléter » ce formulaire.
 */

/** Ordre VISUEL des champs — c'est lui qui décide où va le focus. */
const ORDRE_CHAMPS = ["firstName", "role"] as const;

type EtatForm = {
  statut: "vierge" | "succes" | "erreur";
  error?: string;
  fieldErrors?: Record<string, string>;
};

const ETAT_INITIAL: EtatForm = { statut: "vierge" };

export interface MembreFormProps {
  /** `undefined` = création. Sinon : les valeurs à pré-remplir. */
  membre?: {
    id: string;
    firstName: string;
    role: string;
  };
}

export function MembreForm({ membre }: MembreFormProps) {
  const router = useRouter();
  const creation = membre === undefined;

  const [firstName, setFirstName] = useState(membre?.firstName ?? "");
  const [role, setRole] = useState(membre?.role ?? "");

  const [etat, soumettre, enCours] = useActionState(
    async (_precedent: EtatForm, formData: FormData): Promise<EtatForm> => {
      const analyse = memberInputSchema
        .omit({ portrait: true, sortOrder: true, isPublished: true })
        .safeParse({
          firstName: formData.get("firstName"),
          role: formData.get("role"),
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
          ? await creerMembre(formData)
          : await enregistrerMembre(membre.id, formData);

        if (!resultat.ok) {
          return { statut: "erreur", error: resultat.error, fieldErrors: resultat.fieldErrors };
        }
        // Ne concerne que le cache ROUTEUR du navigateur : `/l-asso` est `force-dynamic`, il
        // n'y a AUCUN cache de données à invalider.
        router.refresh();
        // 🔴 À LA CRÉATION, ON VA SUR LA FICHE — et non à la liste, contrairement aux ateliers.
        // Là-bas il n'y avait plus rien à faire sur la fiche ; ici l'étape suivante y vit : le
        // téléversement du portrait. Même arbitrage qu'en 6.5 pour le logo, et pour la même
        // raison — l'écran mène là où le geste suivant se trouve.
        if (creation && resultat.data) router.push(`/admin/membres/${resultat.data.id}`);
        return { statut: "succes" };
      } catch {
        // 🔴 `exigerRoleAction()` s'exécute AVANT le `try` de la Server Action et **LÈVE** : une
        // session expirée ou un compte retiré de l'allowlist arrive ici, et nulle part ailleurs.
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
    if (premier) document.getElementById(`membre-${premier}`)?.focus();
  }, [etat.fieldErrors]);

  const erreurs = etat.fieldErrors ?? {};

  return (
    <form action={soumettre} className={styles.form} noValidate>
      <ChampTexte
        id="membre-firstName"
        name="firstName"
        label="Prénom (obligatoire)"
        valeur={firstName}
        onChange={setFirstName}
        max={PRENOM_MAX}
        aide="Le prénom tel qu'il apparaîtra sur la page « L'asso ». Le prénom seul suffit — le site ne publie pas de nom de famille."
        erreur={erreurs.firstName}
      />

      <ChampTexte
        id="membre-role"
        name="role"
        label="Rôle (obligatoire)"
        valeur={role}
        onChange={setRole}
        max={ROLE_MAX}
        aide="Ce que la personne fait dans l'association. Exemple : « Présidente », « Trésorier », « Bénévole animation »."
        erreur={erreurs.role}
      />

      {/* ══════════════════════════════════════════════════════════════════════════════
          🔴 CE QUI EST EN JEU, RAPPELÉ AU POINT DE SAISIE — PAS DANS UNE DOC
          ══════════════════════════════════════════════════════════════════════════════
          Deux règles que le formulaire ne peut pas empêcher mécaniquement :
            · publier le prénom de quelqu'un est une décision qui l'engage. Le rôle est
              obligatoire précisément parce que c'est lui qui justifie la publication ;
            · FR16 interdit tout chiffre de communauté. La tentation ici est d'écrire
              l'effectif dans un rôle (« Bénévole — nous sommes 12 »), et c'est pour cela
              qu'on le dit plutôt que de compter dessus. */}
      <p className={styles.regle} role="note">
        <strong>Demandez son accord à la personne avant de publier sa fiche.</strong> Son
        prénom et son rôle seront visibles publiquement, et son portrait aussi si vous en
        ajoutez un. Un départ se gère en un clic : « Retirer du site » depuis la liste.
        <br />
        Et <strong>pas de compteur de membres</strong> : la page « L&rsquo;asso » dit en
        toutes lettres qu&rsquo;il n&rsquo;y a « pas de compteur de membres ni de
        statistiques d&rsquo;audience sur ce site ». C&rsquo;est pour cela qu&rsquo;il
        n&rsquo;y a pas de champ pour ça.
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
              ? "Créer la fiche"
              : "Enregistrer les modifications"}
        </Button>
        <Link className={styles.lien} href="/admin/membres">
          Retour aux membres
        </Link>
      </div>

      {creation ? (
        /* ⚠️ DIT AVANT LE GESTE, PAS APRÈS : un membre naît en brouillon. Sans cette phrase,
           on croit avoir publié et on cherche pourquoi le site ne change pas. */
        <p className={styles.avertissement} role="note">
          La fiche sera créée <strong>en brouillon</strong> : elle n&rsquo;apparaîtra pas sur
          le site tant que vous ne l&rsquo;aurez pas publiée depuis la liste. Vous pourrez
          ajouter un portrait juste après — c&rsquo;est facultatif.
        </p>
      ) : null}
    </form>
  );
}
