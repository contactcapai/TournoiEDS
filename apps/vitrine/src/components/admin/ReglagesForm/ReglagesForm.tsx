"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@repo/ui";

import { ChampTexte } from "@/components/admin/ChampTexte/ChampTexte";
import {
  CHAMPS_URL,
  EMAIL_MAX,
  URL_MAX,
  siteSettingInputSchema,
} from "@/lib/schemas/site-setting";
import { enregistrerReglages } from "@/server/actions/reglages";
import styles from "@/styles/admin-form.module.css";

/**
 * Les six réglages du site (Story 6.13, FR38).
 *
 * Reprend LITTÉRALEMENT le patron de saisie posé par `EventForm` (6.3) et repayé par
 * `PhotoForm`, `PartenaireForm`, `AtelierForm` et `MembreForm` :
 *   · tous les champs CONTRÔLÉS — React 19 réinitialise les champs non contrôlés d'un
 *     `<form action={fn}>` après résolution de l'action, succès COMME échec (défaut réel de la
 *     Story 5.1). Ne pas « simplifier » en repassant en non contrôlé ;
 *   · validation CLIENT avec le MÊME schéma Zod que le serveur, pour que le focus au premier
 *     champ en erreur n'attende pas un aller-retour réseau — le serveur re-valide quand même ;
 *   · focus au premier champ en erreur dans l'ordre VISUEL ;
 *   · bouton JAMAIS `disabled` pendant l'attente (patron 5.1) : le libellé porte l'état.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE FORMULAIRE A LE PLUS GRAND RAYON DE DÉGÂTS DU BACK-OFFICE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Les six autres surfaces écrivent des lignes qu'on publie une par une, avec un aperçu avant
 * publication. Celle-ci **n'a pas de brouillon** : ce qui est enregistré est en ligne au
 * rechargement suivant, dans le **header et le footer des 5 pages**. D'où deux choix :
 *
 *   · l'avertissement est **AU-DESSUS** du bouton et dit ce qui va se passer, pas ce qui
 *     s'est passé ;
 *   · **chaque champ vide le DIT** (`AideVide` ci-dessous) — c'est le seul rappel de la dette
 *     **R29** qui survivra au go-live, et la dette **R15** documente exactement ce qu'on perd
 *     quand un placeholder disparaît sans rien laisser derrière lui.
 *
 * 🔴 **IL N'Y A PAS D'APERÇU, ET C'EST DÉLIBÉRÉ** : le rendu de ces valeurs, c'est **le site
 * lui-même**, immédiatement, sur n'importe quelle page. Un écran d'aperçu serait une SECONDE
 * implémentation du header et du footer — donc une divergence garantie. Les six autres sections
 * ont un `apercu/` parce que leur rendu vit sur une page qu'on ne peut pas voir sans publier.
 */

/** Ordre VISUEL des champs — c'est lui qui décide où va le focus. */
const ORDRE_CHAMPS = [...CHAMPS_URL.map((c) => c.cle), "contactEmail"] as const;

type EtatForm = {
  statut: "vierge" | "succes" | "erreur";
  error?: string;
  fieldErrors?: Record<string, string>;
};

const ETAT_INITIAL: EtatForm = { statut: "vierge" };

export interface ReglagesFormProps {
  /**
   * Les valeurs en base, **`null` compris** — d'où `lireReglagesPourSaisie` et non
   * `lireReglages` : cet écran a besoin de savoir qu'une colonne est VIDE, là où le rendu n'a
   * besoin que de savoir qu'elle est « absente ».
   */
  reglages: {
    discordUrl: string | null;
    instagramUrl: string | null;
    xUrl: string | null;
    linkedinUrl: string | null;
    helloassoUrl: string | null;
    contactEmail: string;
  };
}

/**
 * La mention affichée sous un champ d'URL **vide**.
 *
 * ⚠️ Elle est **DÉRIVÉE DE LA VALEUR SAISIE**, jamais écrite en dur : elle apparaît et disparaît
 * toute seule, et elle sera vraie tant que le champ le sera. Même patron que l'avertissement
 * SMTP de la Story 6.11, qui MESURE l'environnement au lieu d'affirmer « les e-mails ne partent
 * pas » — une phrase en dur est vraie aujourd'hui et fausse demain, et rien ne la corrigera.
 */
function aideDuChamp(base: string, valeur: string): string {
  return valeur.trim() === ""
    ? `${base} Tant que ce champ est vide, le lien n'apparaît nulle part sur le site — ni dans le pied de page, ni dans le menu.`
    : base;
}

export function ReglagesForm({ reglages }: ReglagesFormProps) {
  const router = useRouter();

  const [valeurs, setValeurs] = useState({
    discordUrl: reglages.discordUrl ?? "",
    instagramUrl: reglages.instagramUrl ?? "",
    xUrl: reglages.xUrl ?? "",
    linkedinUrl: reglages.linkedinUrl ?? "",
    helloassoUrl: reglages.helloassoUrl ?? "",
    contactEmail: reglages.contactEmail,
  });

  const changer = (cle: keyof typeof valeurs) => (valeur: string) =>
    setValeurs((precedent) => ({ ...precedent, [cle]: valeur }));

  const [etat, soumettre, enCours] = useActionState(
    async (_precedent: EtatForm, formData: FormData): Promise<EtatForm> => {
      const analyse = siteSettingInputSchema.safeParse({
        discordUrl: formData.get("discordUrl"),
        instagramUrl: formData.get("instagramUrl"),
        xUrl: formData.get("xUrl"),
        linkedinUrl: formData.get("linkedinUrl"),
        helloassoUrl: formData.get("helloassoUrl"),
        contactEmail: formData.get("contactEmail"),
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
        const resultat = await enregistrerReglages(formData);
        if (!resultat.ok) {
          return { statut: "erreur", error: resultat.error, fieldErrors: resultat.fieldErrors };
        }
        // Ne concerne que le cache ROUTEUR du navigateur : les 5 pages publiques sont
        // `force-dynamic`, il n'y a AUCUN cache de données à invalider.
        router.refresh();
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
    if (premier) document.getElementById(`reglage-${premier}`)?.focus();
  }, [etat.fieldErrors]);

  const erreurs = etat.fieldErrors ?? {};

  return (
    <form action={soumettre} className={styles.form} noValidate>
      {CHAMPS_URL.map(({ cle, libelle, aide }) => (
        <ChampTexte
          key={cle}
          id={`reglage-${cle}`}
          name={cle}
          label={`${libelle} (facultatif)`}
          valeur={valeurs[cle]}
          onChange={changer(cle)}
          max={URL_MAX}
          aide={aideDuChamp(
            `${aide} L'adresse complète, en commençant par https://`,
            valeurs[cle],
          )}
          erreur={erreurs[cle]}
        />
      ))}

      <ChampTexte
        id="reglage-contactEmail"
        name="contactEmail"
        label="E-mail de contact (obligatoire)"
        valeur={valeurs.contactEmail}
        onChange={changer("contactEmail")}
        max={EMAIL_MAX}
        aide="L'adresse affichée en pied de page, et celle qui reçoit les demandes envoyées par le formulaire du site."
        erreur={erreurs.contactEmail}
        autoComplete="off"
      />

      {/* ══════════════════════════════════════════════════════════════════════════════
          🔴 CE QUI EST EN JEU, RAPPELÉ AU POINT DE SAISIE — PAS DANS UNE DOC
          ══════════════════════════════════════════════════════════════════════════════
          Deux faits que le formulaire ne peut pas empêcher mécaniquement :
            · ces valeurs ne passent PAS par un brouillon, contrairement à tout le reste du
              back-office. Le dire avant le geste, pas après ;
            · l'e-mail de contact ne change PAS le compte qui envoie les e-mails du site.
              C'est contre-intuitif, et le taire ferait chercher une panne au mauvais endroit
              (voir `server/mail/client.ts`). */}
      <p className={styles.regle} role="note">
        <strong>Ces réglages n&rsquo;ont pas de brouillon.</strong> Dès que vous enregistrez,
        le changement est visible sur <strong>toutes les pages du site</strong> au rechargement
        suivant — c&rsquo;est la seule section du back-office dans ce cas.
        <br />
        Un champ <strong>vidé</strong> retire le lien partout, proprement : il ne reste ni
        bouton mort, ni adresse qui ne mène nulle part. C&rsquo;est le bon geste quand un compte
        est fermé.
        <br />
        ⚠️ L&rsquo;<strong>e-mail de contact</strong> est l&rsquo;adresse <em>affichée</em> et
        celle qui <em>reçoit</em> les demandes. Il ne change pas le compte depuis lequel le site{" "}
        <em>envoie</em> ses messages : celui-là est réglé une fois pour toutes côté serveur, et
        le modifier demande une intervention technique.
      </p>

      {etat.statut === "erreur" && etat.error ? (
        <p className={styles.erreur} role="alert">
          {etat.error}
        </p>
      ) : null}

      {etat.statut === "succes" ? (
        <div className={styles.confirmation} role="status">
          <p>
            Enregistré. Le site est à jour au rechargement suivant — ouvrez n&rsquo;importe
            quelle page pour le vérifier.
          </p>
        </div>
      ) : null}

      <div className={styles.actions}>
        {/* Jamais `disabled` — patron 5.1 : un bouton grisé pendant une latence réseau donne
            l'impression d'une page morte. */}
        <Button type="submit">{enCours ? "Enregistrement…" : "Enregistrer les réglages"}</Button>
        <Link className={styles.lien} href="/admin">
          Retour au tableau de bord
        </Link>
      </div>
    </form>
  );
}
