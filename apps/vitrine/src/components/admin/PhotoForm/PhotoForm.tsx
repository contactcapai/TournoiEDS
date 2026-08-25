"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@repo/ui";

import { ChampTexte } from "@/components/admin/ChampTexte/ChampTexte";
import { ALT_MAX, ALT_MIN, CAPTION_MAX, photoInputSchema } from "@/lib/schemas/photo";
import { enregistrerPhoto } from "@/server/actions/galerie";
import styles from "@/styles/admin-form.module.css";

/**
 * Modification d'une photo déjà téléversée (Story 6.4) — description, légende, rattachement.
 *
 * Reprend LITTÉRALEMENT le patron de saisie posé par `EventForm` (6.3) :
 *   · tous les champs CONTRÔLÉS — React 19 réinitialise les champs non contrôlés d'un
 *     `<form action={fn}>` après résolution de l'action, succès COMME échec (défaut réel de
 *     la Story 5.1). Ne pas « simplifier » en repassant en non contrôlé ;
 *   · validation CLIENT avec le MÊME schéma Zod que le serveur, pour que le focus au premier
 *     champ en erreur n'attende pas un aller-retour réseau — le serveur re-valide quand même ;
 *   · focus au premier champ en erreur dans l'ordre VISUEL, pas dans celui du schéma.
 *
 * ⚠️ CE FORMULAIRE NE REMPLACE PAS LE FICHIER, ET L'ÉCRAN LE DIT. Changer l'image d'une
 * photo existante signifierait écrire un second fichier et retirer le premier : c'est un
 * téléversement, pas une modification. Le taire ferait chercher un bouton qui n'existe pas.
 */

/** Ordre VISUEL des champs — c'est lui qui décide où va le focus. */
const ORDRE_CHAMPS = ["alt", "caption", "eventId"] as const;

type EtatForm = {
  statut: "vierge" | "succes" | "erreur";
  error?: string;
  fieldErrors?: Record<string, string>;
};

const ETAT_INITIAL: EtatForm = { statut: "vierge" };

export interface PhotoFormProps {
  photo: {
    id: string;
    alt: string;
    caption: string | null;
    eventId: string | null;
  };
  evenements: readonly { id: string; titre: string }[];
}

export function PhotoForm({ photo, evenements }: PhotoFormProps) {
  const router = useRouter();

  const [alt, setAlt] = useState(photo.alt);
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [eventId, setEventId] = useState(photo.eventId ?? "");

  const [etat, soumettre, enCours] = useActionState(
    async (_precedent: EtatForm, formData: FormData): Promise<EtatForm> => {
      const analyse = photoInputSchema
        .omit({ filename: true, sortOrder: true, isPublished: true })
        .safeParse({
          alt: formData.get("alt"),
          caption: formData.get("caption"),
          eventId: formData.get("eventId") === "" ? null : formData.get("eventId"),
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
        const resultat = await enregistrerPhoto(photo.id, formData);
        if (!resultat.ok) {
          return { statut: "erreur", error: resultat.error, fieldErrors: resultat.fieldErrors };
        }
        // Ne concerne que le cache ROUTEUR du navigateur : les pages publiques sont
        // `force-dynamic`, il n'y a AUCUN cache de données à invalider.
        router.refresh();
        return { statut: "succes" };
      } catch {
        // 🔴 `exigerRoleAction()` s'exécute AVANT le `try` de la Server Action et **LÈVE** : une
        // session expirée ou un compte retiré de l'allowlist arrive ici, et nulle part
        // ailleurs. C'est le mécanisme de révocation immédiate le plus mis en avant du
        // projet — sans ce `catch`, il produirait le seul rejet non géré de la surface
        // (défaut trouvé en revue de la 6.3 sur `EventActions`).
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
    if (premier) document.getElementById(`photo-${premier}`)?.focus();
  }, [etat.fieldErrors]);

  const erreurs = etat.fieldErrors ?? {};

  return (
    <form action={soumettre} className={styles.form} noValidate>
      {/* 🔴 LA DISTINCTION `alt` / LÉGENDE EST PORTÉE PAR LES LIBELLÉS ET LES AIDES — c'est
          le SEUL endroit où elle peut encore se perdre. La base et Zod ont fait tout ce
          qu'ils pouvaient : ils exigent un `alt` non vide, ils ne peuvent pas exiger qu'il
          soit PERTINENT. Lighthouse non plus. */}
      <ChampTexte
        id="photo-alt"
        name="alt"
        label="Description de la photo (obligatoire)"
        valeur={alt}
        onChange={setAlt}
        max={ALT_MAX}
        multiligne
        aide={
          `Ce que MONTRE la photo, pour les personnes qui ne la voient pas. ` +
          `Au moins ${ALT_MIN} caractères. Exemple : « Une dizaine de joueurs attablés ` +
          `devant deux écrans, dans un bar ».`
        }
        erreur={erreurs.alt}
      />

      <ChampTexte
        id="photo-caption"
        name="caption"
        label="Légende (facultative)"
        valeur={caption}
        onChange={setCaption}
        max={CAPTION_MAX}
        aide={
          "Ce qu'on COMMENTE, en écriture manuscrite sous la photo. Exemple : " +
          "« Le stand, plein à craquer ». Ce n'est pas la description : la légende commente, " +
          "la description informe."
        }
        erreur={erreurs.caption}
      />

      <div className={styles.champ}>
        <label className={styles.label} htmlFor="photo-eventId">
          Rattacher à un événement (facultatif)
        </label>
        <select
          id="photo-eventId"
          name="eventId"
          className={styles.saisie}
          value={eventId}
          onChange={(evenement) => setEventId(evenement.target.value)}
          aria-invalid={erreurs.eventId ? "true" : undefined}
          aria-describedby={erreurs.eventId ? "photo-eventId-erreur" : undefined}
        >
          {/* Une photo SANS événement est un cas NOMINAL — « la vie de l'asso ». */}
          <option value="">Aucun — une photo de la vie de l&rsquo;asso</option>
          {evenements.map((evenement) => (
            <option key={evenement.id} value={evenement.id}>
              {evenement.titre}
            </option>
          ))}
        </select>
        <p className={styles.sousChamp}>
          <span>
            Supprimer l&rsquo;événement plus tard <strong>ne supprime pas</strong> la photo :
            elle redevient simplement une photo de la vie de l&rsquo;asso.
          </span>
        </p>
        {erreurs.eventId ? (
          <p id="photo-eventId-erreur" className={styles.erreur}>
            {erreurs.eventId}
          </p>
        ) : null}
      </div>

      {etat.statut === "erreur" && etat.error ? (
        <p className={styles.erreur} role="alert">
          {etat.error}
        </p>
      ) : null}

      {etat.statut === "succes" ? (
        <div className={styles.confirmation} role="status">
          <p>Enregistré.</p>
        </div>
      ) : null}

      <div className={styles.actions}>
        {/* Jamais `disabled` — patron 5.1 : un bouton grisé pendant une latence réseau donne
            l'impression d'une page morte. */}
        <Button type="submit">
          {enCours ? "Enregistrement…" : "Enregistrer les modifications"}
        </Button>
        <Link className={styles.lien} href="/admin/galerie">
          Retour à la galerie
        </Link>
      </div>
    </form>
  );
}
