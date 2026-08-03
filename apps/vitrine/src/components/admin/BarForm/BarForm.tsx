"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@repo/ui";

import { ChampTexte } from "@/components/admin/ChampTexte/ChampTexte";
import {
  BAR_ADRESSE_MAX,
  BAR_NOM_MAX,
  BAR_QUARTIER_MAX,
  BAR_VILLE_MAX,
  barInputSchema,
} from "@/lib/schemas/event";
import { enregistrerBar } from "@/server/actions/agenda";
import type { Bar } from "@/server/db/schema";
import styles from "@/styles/admin-form.module.css";

/**
 * Formulaire d'un bar du roulement (Story 6.3).
 *
 * Même patron que `EventForm` — champs contrôlés (React 19 réinitialise les non contrôlés),
 * validation client avec le schéma partagé, focus au premier champ en erreur, bouton jamais
 * `disabled`. Il n'y a **pas** de composant « formulaire générique » entre les deux : ils
 * partagent un vocabulaire de mise en page (`admin-form.module.css`) et un champ
 * (`ChampTexte`), pas un moteur de formulaire.
 *
 * ⚠️ Un bar au nom provisoire (« Bar partenaire #2 », UX-DR11) se saisit TEL QUEL : c'est de
 * la donnée, pas un état. Aucun champ « provisoire » n'existe dans le modèle, et il ne faut
 * pas en inventer un ici.
 */

const ORDRE_CHAMPS = ["name", "address", "district", "city"] as const;

type EtatForm = {
  statut: "vierge" | "succes" | "erreur";
  error?: string;
  fieldErrors?: Record<string, string>;
};

const ETAT_INITIAL: EtatForm = { statut: "vierge" };

export interface BarFormProps {
  /** Absent en création. */
  bar?: Bar;
}

export function BarForm({ bar }: BarFormProps) {
  const router = useRouter();

  const [name, setName] = useState(bar?.name ?? "");
  const [address, setAddress] = useState(bar?.address ?? "");
  const [district, setDistrict] = useState(bar?.district ?? "");
  const [city, setCity] = useState(bar?.city ?? "Reims");

  const [etat, soumettre, enCours] = useActionState(
    async (_precedent: EtatForm, formData: FormData): Promise<EtatForm> => {
      const analyse = barInputSchema.safeParse({
        name: formData.get("name"),
        address: formData.get("address"),
        district: formData.get("district"),
        city: formData.get("city") || undefined,
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
        const resultat = await enregistrerBar(bar?.id ?? null, formData);
        if (!resultat.ok) {
          return { statut: "erreur", error: resultat.error, fieldErrors: resultat.fieldErrors };
        }

        // Rafraîchit le CACHE ROUTEUR seulement : les pages publiques sont `force-dynamic`,
        // il n'y a aucun cache de données à invalider.
        router.refresh();

        if (!bar) {
          // CRÉATION : on vide pour enchaîner sur le bar suivant. En ÉDITION on ne vide
          // PAS — effacer sous les yeux de la personne ce qu'elle vient de corriger
          // ressemble à une perte de saisie.
          // ⚠️ Ici et non dans un effet : un `setState` synchrone dans un effet déclenche
          // des rendus en cascade (`react-hooks/set-state-in-effect`, payée en Story 5.1).
          setName("");
          setAddress("");
          setDistrict("");
          setCity("Reims");
        }
        return { statut: "succes" };
      } catch {
        return { statut: "erreur", error: "Une erreur réseau est survenue, merci de réessayer." };
      }
    },
    ETAT_INITIAL,
  );

  useEffect(() => {
    if (!etat.fieldErrors) return;
    const premier = ORDRE_CHAMPS.find((champ) => etat.fieldErrors?.[champ]);
    if (premier) document.getElementById(`bar-${premier}`)?.focus();
  }, [etat.fieldErrors]);

  const erreurs = etat.fieldErrors ?? {};

  return (
    <form action={soumettre} className={styles.form} noValidate>
      <ChampTexte
        id="bar-name"
        name="name"
        label="Nom du bar"
        valeur={name}
        onChange={setName}
        max={BAR_NOM_MAX}
        aide="Un accord pas encore signé s'écrit tel quel : « Bar partenaire #2 »."
        erreur={erreurs.name}
      />
      <ChampTexte
        id="bar-address"
        name="address"
        label="Adresse"
        valeur={address}
        onChange={setAddress}
        max={BAR_ADRESSE_MAX}
        autoComplete="street-address"
        erreur={erreurs.address}
      />
      <ChampTexte
        id="bar-district"
        name="district"
        label="Quartier"
        valeur={district}
        onChange={setDistrict}
        max={BAR_QUARTIER_MAX}
        aide="Affiché à côté du nom sur la carte du prochain rendez-vous."
        erreur={erreurs.district}
      />
      <ChampTexte
        id="bar-city"
        name="city"
        label="Ville"
        valeur={city}
        onChange={setCity}
        max={BAR_VILLE_MAX}
        erreur={erreurs.city}
      />

      {etat.statut === "erreur" && etat.error ? (
        <p className={styles.erreur} role="alert">
          {etat.error}
        </p>
      ) : null}

      {etat.statut === "succes" ? (
        <p className={styles.confirmation} role="status">
          Enregistré.
        </p>
      ) : null}

      <div className={styles.actions}>
        <Button type="submit">
          {enCours ? "Enregistrement…" : bar ? "Enregistrer" : "Ajouter le bar"}
        </Button>
      </div>
    </form>
  );
}
