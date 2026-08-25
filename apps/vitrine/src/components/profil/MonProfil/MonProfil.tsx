"use client";

import { useState, useTransition } from "react";
import { Button } from "@repo/ui";

import { CHAMPS_PROFIL, type ProfilSaisi } from "@/lib/schemas/profil";
import { enregistrerProfil } from "@/server/actions/profil";
import styles from "./MonProfil.module.css";

/**
 * Le formulaire du profil et la suppression de compte (Story 12.1).
 *
 * 🔴 **`'use client'` SUR CE SEUL COMPOSANT**, jamais sur la page : la page reste un Server
 * Component qui lit, garde et compose — c'est la règle du projet, et elle vaut ici parce que
 * l'interactivité se limite à un état d'erreur et à une confirmation en deux temps.
 *
 * ⚠️ **`BoutonConfirmation` (back-office) N'EST PAS RÉEMPLOYÉ**, et c'est raisonné : la 6.7 a
 * payé qu'un composant partagé entre neuf consommateurs de **même nature** casse au premier d'une
 * autre. Celui-ci porte l'habillage du back-office ; cette page porte celui du site public. La
 * confirmation en deux temps est reprise — l'apparence, non.
 */
export function MonProfil({
  profil,
  onSupprimer,
}: {
  profil: { [K in keyof ProfilSaisi]: string | null };
  /**
   * ⚠️ **PASSÉE PAR LA PAGE, PAS IMPORTÉE ICI** : la suppression doit enchaîner sur `signOut()`,
   * qui écrit des en-têtes — une Server Action appelée depuis le client ne le peut pas. La page
   * l'enveloppe donc dans une action à elle.
   */
  onSupprimer: () => Promise<void>;
}) {
  const [enTransition, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ton: "ok" | "erreur"; texte: string } | null>(null);
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);

  const enregistrer = (donnees: FormData) => {
    demarrer(async () => {
      setMessage(null);
      try {
        const resultat = await enregistrerProfil(donnees);
        setMessage(
          resultat.ok
            ? { ton: "ok", texte: "Profil enregistré." }
            : { ton: "erreur", texte: resultat.error },
        );
      } catch {
        setMessage({ ton: "erreur", texte: "L'enregistrement a échoué. Réessayez." });
      }
    });
  };

  return (
    <>
      <form action={enregistrer} className={styles.form}>
        {CHAMPS_PROFIL.map((champ) => (
          <div className={styles.champ} key={champ.cle}>
            <label className={styles.label} htmlFor={`profil-${champ.cle}`}>
              {champ.label}
            </label>
            <input
              autoComplete="off"
              className={styles.saisie}
              defaultValue={profil[champ.cle] ?? ""}
              id={`profil-${champ.cle}`}
              name={champ.cle}
              type="text"
            />
            <p className={styles.aide}>{champ.aide}</p>
          </div>
        ))}

        {/* ⚠️ `role="status"` : le message arrive APRÈS l'aller-retour, donc hors du flux de
            lecture. Sans lui, un lecteur d'écran ne l'annonce jamais et la personne ne sait pas
            si son enregistrement a abouti. */}
        {message ? (
          <p
            className={message.ton === "ok" ? styles.messageOk : styles.messageErreur}
            role="status"
          >
            {message.texte}
          </p>
        ) : null}

        <div className={styles.actions}>
          <Button disabled={enTransition} type="submit">
            {enTransition ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </form>

      {/* ══════════════════════════════════════════════════════════════════════════════
          SUPPRIMER SON COMPTE — RGPD
          ══════════════════════════════════════════════════════════════════════════════
          🔴 EN DEUX TEMPS, ET LE SECOND BOUTON EST UN AUTRE BOUTON, À UN AUTRE ENDROIT :
          un double-clic malheureux sur le premier ne peut pas déclencher la suppression
          (patron de `BoutonConfirmation`, 6.3).
          🔴 ET LA PRÉCISION EST LE CŒUR DU GESTE, pas une politesse : quelqu'un qui croit
          effacer ses résultats de tournoi n'osera pas supprimer son compte, et le droit que
          cette section existe pour offrir ne servira à personne. */}
      <div className={styles.zoneDanger}>
        <h3 className={styles.titreDanger}>Supprimer mon compte</h3>
        <p className={styles.texteDanger}>
          Votre compte, vos moyens de connexion et tout ce que vous avez déclaré ici
          disparaissent définitivement.{" "}
          <strong>Vos résultats de tournoi, eux, restent publiés</strong> — ils cessent
          simplement d&rsquo;être rattachés à vous. Les effacer réécrirait les parties où
          d&rsquo;autres joueurs vous ont rencontré.
        </p>

        {confirmeSuppression ? (
          <div className={styles.actions}>
            <Button
              disabled={enTransition}
              onClick={() => demarrer(async () => onSupprimer())}
              variant="outline"
            >
              {enTransition ? "Suppression…" : "Oui, supprimer mon compte"}
            </Button>
            <button
              className={styles.lienDoux}
              onClick={() => setConfirmeSuppression(false)}
              type="button"
            >
              Annuler
            </button>
          </div>
        ) : (
          <div className={styles.actions}>
            <button
              className={styles.boutonDanger}
              onClick={() => setConfirmeSuppression(true)}
              type="button"
            >
              Supprimer mon compte
            </button>
          </div>
        )}
      </div>
    </>
  );
}
