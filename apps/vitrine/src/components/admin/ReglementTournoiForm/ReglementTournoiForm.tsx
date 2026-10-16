"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@repo/ui";

import { ChoixReglement } from "@/components/admin/ChoixReglement/ChoixReglement";
import { enregistrerReglementTournoi } from "@/server/actions/reglements";
import styles from "@/styles/admin-form.module.css";

type EtatForm = { statut: "vierge" | "succes" | "erreur"; error?: string; fieldErrors?: Record<string, string> };

/** L'onglet « Le règlement » d'un tournoi : un seul champ, enregistré seul. */
export function ReglementTournoiForm({
  tournoiId,
  reglement,
  modeles,
  valeursAuto,
}: {
  tournoiId: string;
  reglement: string | null;
  modeles: readonly { id: string; name: string; body: string }[];
  valeursAuto: Readonly<Record<string, string>>;
}) {
  const router = useRouter();
  const [rules, setRules] = useState(reglement ?? "");

  const [etat, soumettre, enCours] = useActionState(
    async (_precedent: EtatForm, formData: FormData): Promise<EtatForm> => {
      try {
        const resultat = await enregistrerReglementTournoi(tournoiId, formData);
        if (!resultat.ok) {
          return { statut: "erreur", error: resultat.error, fieldErrors: resultat.fieldErrors };
        }
        router.refresh();
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
    if (etat.fieldErrors?.rules) document.getElementById("tournoi-rules")?.focus();
  }, [etat.fieldErrors]);

  return (
    <form action={soumettre} className={styles.form} noValidate>
      <ChoixReglement
        modeles={modeles}
        valeur={rules}
        onChange={setRules}
        valeursAuto={valeursAuto}
        erreur={etat.fieldErrors?.rules}
      />

      {etat.statut === "erreur" && etat.error ? (
        <p className={styles.erreur} role="alert">
          {etat.error}
        </p>
      ) : null}
      {etat.statut === "succes" ? (
        <div className={styles.confirmation} role="status">
          <p>
            {rules.trim()
              ? "Règlement enregistré."
              : "Règlement retiré : la page du tournoi n'affiche plus de lien."}
          </p>
        </div>
      ) : null}

      <div className={styles.actions}>
        <Button type="submit">{enCours ? "Enregistrement…" : "Enregistrer le règlement"}</Button>
      </div>
    </form>
  );
}
