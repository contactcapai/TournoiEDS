"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@repo/ui";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import { ChampTexte } from "@/components/admin/ChampTexte/ChampTexte";
import { MODELE_NOM_MAX, REGLEMENT_MAX, TROUS_AUTOMATIQUES, trousDu } from "@/lib/reglement";
import {
  enregistrerModeleReglement,
  supprimerModeleReglement,
} from "@/server/actions/reglements";
import styles from "@/styles/admin-form.module.css";

type EtatForm = {
  statut: "vierge" | "succes" | "erreur";
  error?: string;
  fieldErrors?: Record<string, string>;
};

const RETOUR = "/admin/tournois/reglements";

/** Création et modification d'un modèle de règlement — patron `AtelierForm` (champs contrôlés). */
export function ModeleReglementForm({
  modele,
}: {
  modele?: { id: string; name: string; body: string };
}) {
  const router = useRouter();
  const creation = modele === undefined;
  const [name, setName] = useState(modele?.name ?? "");
  const [body, setBody] = useState(modele?.body ?? "");

  const [etat, soumettre, enCours] = useActionState(
    async (_precedent: EtatForm, formData: FormData): Promise<EtatForm> => {
      try {
        const resultat = await enregistrerModeleReglement(modele?.id ?? null, formData);
        if (!resultat.ok) {
          return { statut: "erreur", error: resultat.error, fieldErrors: resultat.fieldErrors };
        }
        router.refresh();
        if (creation) router.push(RETOUR);
        return { statut: "succes" };
      } catch {
        return {
          statut: "erreur",
          error:
            "Votre session n'est plus valide, ou le réseau a échoué. Rechargez la page et " +
            "reconnectez-vous — ce que vous avez tapé est toujours à l'écran.",
        };
      }
    },
    { statut: "vierge" },
  );

  useEffect(() => {
    const premier = ["name", "body"].find((champ) => etat.fieldErrors?.[champ]);
    if (premier) document.getElementById(`modele-${premier}`)?.focus();
  }, [etat.fieldErrors]);

  const erreurs = etat.fieldErrors ?? {};
  const trous = trousDu(body);

  return (
    <>
      <form action={soumettre} className={styles.form} noValidate>
        <ChampTexte
          id="modele-name"
          name="name"
          label="Nom du modèle (obligatoire)"
          valeur={name}
          onChange={setName}
          max={MODELE_NOM_MAX}
          aide="Ce qu'on choisira à la création d'un tournoi. Exemple : « Règlement TFT EDS »."
          erreur={erreurs.name}
        />

        <ChampTexte
          id="modele-body"
          name="body"
          label="Texte du modèle (obligatoire)"
          valeur={body}
          onChange={setBody}
          max={REGLEMENT_MAX}
          multiligne
          lignes={24}
          aide={`Écrivez entre doubles accolades ce qui change d'un tournoi à l'autre. Remplis seuls depuis la fiche et le déroulé : ${TROUS_AUTOMATIQUES.map((trou) => `{{${trou}}}`).join(", ")}. Tout autre nom sera demandé dans l'onglet « Le règlement » du tournoi. « # » fait un article, « ## » un sous-article, « - » un élément de liste.`}
          erreur={erreurs.body}
        />

        <p className={styles.regle} role="note">
          {trous.length > 0
            ? `Informations à compléter dans ce modèle : ${trous.join(", ")}.`
            : "Ce modèle n'a aucune information à compléter : il sera copié tel quel."}
        </p>

        {etat.statut === "erreur" && etat.error ? (
          <p className={styles.erreur} role="alert">
            {etat.error}
          </p>
        ) : null}
        {etat.statut === "succes" && !creation ? (
          <div className={styles.confirmation} role="status">
            <p>Enregistré. Les tournois déjà créés gardent leur propre copie.</p>
          </div>
        ) : null}

        <div className={styles.actions}>
          <Button type="submit">
            {enCours ? "Enregistrement…" : creation ? "Créer le modèle" : "Enregistrer le modèle"}
          </Button>
          <Link className={styles.lien} href={RETOUR}>
            Retour aux modèles
          </Link>
        </div>
      </form>

      {modele ? (
        <div className={styles.actions}>
          <BoutonConfirmation
            libelle="Supprimer ce modèle"
            question={`Supprimer le modèle « ${modele.name} » ?`}
            precision="Les tournois qui en ont été pré-remplis gardent leur règlement."
            onConfirmer={async () => {
              const resultat = await supprimerModeleReglement(modele.id);
              if (resultat.ok) router.push(RETOUR);
              return resultat;
            }}
          />
        </div>
      ) : null}
    </>
  );
}
