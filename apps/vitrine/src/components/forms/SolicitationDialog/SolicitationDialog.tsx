"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@repo/ui";


import { SolicitationForm } from "../SolicitationForm/SolicitationForm";
import styles from "./SolicitationDialog.module.css";

/**
 * Bouton « Nous écrire » + la boîte de dialogue qui porte `SolicitationForm`.
 *
 * 🔴 POURQUOI UNE MODALE ET PAS UN FORMULAIRE EN PAGE (arbitrage de Brice au gate visuel
 * de la Story 5.1, 2026-07-31) : le formulaire posé en bas de `/partenaires` n'avait pas
 * de cohérence à cet endroit, et les surfaces qui portent une intention de CONTACT
 * (« Nous contacter » de la double porte, « Nous solliciter » d'`/animations`) menaient à
 * une page de DOCUMENTATION avant d'atteindre le formulaire. La modale supprime ce détour.
 *
 * 🔴 CE COMPOSANT EST AUTONOME, ET C'EST DÉLIBÉRÉ : chaque surface déclenchante rend sa
 * PROPRE instance (bouton + dialogue), sans contexte React partagé ni magasin global.
 * `project-context.md` §5 l'exige — « état minimal, pas de Redux/Zustand » — et un
 * fournisseur global pour trois boutons serait une machinerie sans consommateur.
 *
 * 🔴 RENDU EN PORTAIL SUR `document.body`, ET CE N'EST PAS UN RÉFLEXE : les trois surfaces
 * déclenchantes vivent DANS des sections qui portent `motion.reveal`, lequel anime un
 * `transform`. Or un ancêtre transformé devient le bloc conteneur d'un descendant
 * `position: fixed` — la modale serait alors positionnée par rapport à la section, pas au
 * viewport, et pourrait s'ouvrir hors écran. Le portail rend la question sans objet.
 * ⚠️ La `Lightbox` (4.3) rend en place et fonctionne, mais son overlay n'a jamais été
 * éprouvé sous un ancêtre transformé — ne pas en déduire que c'est équivalent.
 */
export function SolicitationDialog({
  label,
  contactEmail,
  variant = "gold",
}: {
  /** Libellé du bouton. Chaîne et non `ReactNode` : le repli `<noscript>` le réutilise. */
  label: string;
  /**
   * L'e-mail public de contact — Story 6.13.
   *
   * 🔴 EN PROP ET NON EN IMPORT, ET C'EST OBLIGATOIRE : ce composant porte `'use client'`, la
   * valeur vit dans `site_setting`, et son lecteur est `server-only`. Le parent RSC
   * (`DoubleDoor`) la reçoit de la page et la transmet.
   *
   * ⚠️ C'est le REPLI `<noscript>` qui en dépend — le seul moyen de joindre l'association
   * quand JavaScript est absent. Ne jamais le rendre facultatif ni lui donner de défaut : un
   * défaut en dur serait une SECONDE source de vérité, et elle divergerait en silence.
   */
  contactEmail: string;
  variant?: "gold" | "outline";
}) {
  const [ouverte, setOuverte] = useState(false);
  const titreId = useId();

  /**
   * L'élément déclencheur, capté depuis l'ÉVÉNEMENT de clic plutôt que par une `ref`
   * posée sur `<Button>` : la primitive `@repo/ui` est un composant fonction simple, sans
   * `forwardRef`, et son type de props n'expose pas `ref`. `currentTarget` donne
   * exactement le même élément, y compris quand l'activation vient du clavier.
   */
  const declencheur = useRef<HTMLElement | null>(null);
  const dialogue = useRef<HTMLDivElement>(null);
  const fermeture = useRef<HTMLButtonElement>(null);

  const fermer = useCallback(() => setOuverte(false), []);

  // À l'ouverture, le focus ENTRE dans le dialogue (sur la fermeture, la commande la plus
  // sûre) : sans cela il resterait sur le déclencheur, DERRIÈRE l'overlay. Patron Lightbox.
  useEffect(() => {
    if (ouverte) fermeture.current?.focus();
  }, [ouverte]);

  // Restitution du focus au déclencheur à la fermeture (UX-DR23, ARIA APG). Ne se déclenche
  // pas au montage initial : `ouverte` y vaut déjà `false` sans avoir jamais été `true`.
  const etaitOuverte = useRef(false);
  useEffect(() => {
    if (!ouverte && etaitOuverte.current) declencheur.current?.focus();
    etaitOuverte.current = ouverte;
  }, [ouverte]);

  /**
   * 🔴 PIÈGE DE FOCUS. Le sélecteur DIFFÈRE de celui de la `Lightbox`, qui ne balaie que
   * `button` — ici le dialogue porte un FORMULAIRE, donc des `input`, un `textarea` et des
   * radios.
   * ⚠️ `:not([tabindex="-1"])` N'EST PAS COSMÉTIQUE : le champ HONEYPOT est un `<input>`
   * porteur de `tabIndex={-1}`. Sans cette exclusion, le piège le ferait entrer dans le
   * cycle de tabulation — c'est-à-dire qu'il défairait exactement la garde anti-spam que
   * `gate:solicitation` vérifie (② le honeypot reste hors de portée).
   */
  const surTouche = useCallback(
    (evenement: React.KeyboardEvent<HTMLDivElement>) => {
      if (evenement.key === "Escape") {
        evenement.preventDefault();
        fermer();
        return;
      }
      if (evenement.key !== "Tab") return;

      const focalisables = dialogue.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), select:not([disabled])',
      );
      if (!focalisables || focalisables.length === 0) return;
      const premier = focalisables[0]!;
      const dernier = focalisables[focalisables.length - 1]!;
      const actif = document.activeElement;

      if (evenement.shiftKey && actif === premier) {
        evenement.preventDefault();
        dernier.focus();
      } else if (!evenement.shiftKey && actif === dernier) {
        evenement.preventDefault();
        premier.focus();
      }
    },
    [fermer],
  );

  return (
    <>
      <Button
        variant={variant}
        // Attribut `data-` et NON une classe CSS Modules : le repli `<noscript>` cible ce
        // sélecteur dans une chaîne écrite à la main, et une règle CSS vide serait
        // supprimée à la minification (détail dans le `.module.css`).
        data-solicitation-trigger=""
        onClick={(evenement) => {
          declencheur.current = evenement.currentTarget;
          setOuverte(true);
        }}
      >
        {label}
      </Button>

      {/*
        🔴 REPLI SANS JAVASCRIPT — une modale ne peut pas s'ouvrir sans JS, et un bouton
        mort serait pire que rien : ce serait le défaut soldé en Story 3.3 (un CTA sans
        destination) et celui que la dette R28 existe pour empêcher (six surfaces qui
        pointent vers une intention de contact sans moyen de contact).
        Le `<style>` n'est parsé QUE si les scripts sont désactivés — le navigateur traite
        le contenu d'un `<noscript>` comme du texte inerte sinon. Le bouton disparaît donc,
        et l'adresse e-mail le remplace, exactement au même endroit.
        ⚠️ `dangerouslySetInnerHTML` est ici le montage CORRECT et non un contournement :
        React ne rend pas de façon fiable des enfants JSX dans un `<noscript>` à
        l'hydratation. Le contenu est entièrement statique et ne porte aucune donnée
        utilisateur — aucune surface d'injection.
        ⚠️ Ce repli N'EST PAS un doublon du formulaire au sens de R28 : les deux ne sont
        JAMAIS rendus ensemble, c'est l'un OU l'autre selon que JS s'exécute.
      */}
      <noscript
        dangerouslySetInnerHTML={{
          __html:
            `<style>[data-solicitation-trigger]{display:none}</style>` +
            `<a class="${styles.repli}" href="mailto:${contactEmail}">${label} — ${contactEmail}</a>`,
        }}
      />

      {/* Aucun garde « composant monté » n'est nécessaire avant `createPortal` : `ouverte`
          ne peut passer à `true` que par un clic, donc jamais pendant le rendu serveur —
          `document` existe forcément quand cette branche s'évalue. */}
      {ouverte
        ? createPortal(
            <div
              className={styles.overlay}
              // Clic HORS ZONE : on ne ferme que si la cible est l'overlay LUI-MÊME et pas
              // un de ses enfants — sinon un clic dans le formulaire fermerait la modale
              // et ferait perdre la saisie (patron Lightbox).
              onClick={(evenement) => {
                if (evenement.target === evenement.currentTarget) fermer();
              }}
              onKeyDown={surTouche}
              ref={dialogue}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titreId}
            >
              <div className={styles.boite}>
                <button
                  type="button"
                  ref={fermeture}
                  className={styles.fermer}
                  onClick={fermer}
                  aria-label="Fermer le formulaire"
                >
                  <span aria-hidden="true">×</span>
                </button>

                <h2 id={titreId} className={styles.titre}>
                  Nous solliciter
                </h2>
                <p className={styles.chapo}>
                  Un partenariat, un coup de main sur un événement, une animation pour
                  votre structure : décrivez-nous votre projet, même s&apos;il est encore
                  flou.
                </p>

                <SolicitationForm />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
