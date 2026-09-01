"use client";

import { useState } from "react";
import styles from "./PointFocal.module.css";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LE POINT FOCAL — « OÙ EST LE SUJET », DÉSIGNÉ SUR L'IMAGE (Story 7.3)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 ON DÉSIGNE, ON NE SAISIT PAS DEUX NOMBRES. Deux champs `number` auraient été
 * strictement équivalents pour la base et inutilisables pour un bénévole : personne ne
 * sait dire « le sujet est à 38 % / 22 % » en regardant une photo. C'est le principe ③ de
 * l'Epic 13 — l'assistance montre avant d'écrire.
 *
 * ⚠️ LA VALEUR PART DANS UN CHAMP CACHÉ, et le clic ne fait que la déplacer : le
 * formulaire reste un `<form>` ordinaire, soumis par la même Server Action que le reste.
 * Aucun aller-retour propre à ce composant, donc rien à réconcilier si l'enregistrement
 * échoue.
 *
 * 🔴 ACCESSIBLE AU CLAVIER, ET CE N'EST PAS UNE OPTION SUR CE PROJET (AA). Les flèches
 * déplacent le point de 5 %, ce qui donne 21 positions par axe — assez pour cadrer, assez
 * peu pour rester atteignable sans s'acharner.
 * ⚠️ `role="slider"` ET NON un simple bouton : c'est une VALEUR qu'on ajuste, pas une
 * action qu'on déclenche, et c'est le seul rôle qui laisse annoncer où l'on en est.
 * `aria-valuetext` porte les DEUX axes en toutes lettres — `aria-valuenow`, qui n'accepte
 * qu'un nombre, ne pourrait dire que l'horizontale et tairait la moitié de l'état.
 *
 * ⚠️ LA PRÉVISUALISATION MONTRE LE CADRE 4/3 DU HERO, pas un cadre neutre : c'est le seul
 * consommateur du point focal aujourd'hui, et voir « ce que ça donne » vaut mieux que
 * comprendre « ce que ça veut dire ». Le jour où la bande citation en aura un, elle aura
 * son propre aperçu — un aperçu générique ne montrerait aucun des deux.
 */
export interface PointFocalProps {
  /** Nom de fichier du média, servi par `/admin/medias/<filename>`. */
  filename: string;
  /** Texte alternatif de la photo — repris tel quel pour l'aperçu. */
  alt: string;
  focalX: number;
  focalY: number;
}

const PAS = 5;

/** Borne à l'entier entre 0 et 100 — la même règle que le `CHECK` en base. */
const borner = (valeur: number) => Math.max(0, Math.min(100, Math.round(valeur)));

export function PointFocal({ filename, alt, focalX, focalY }: PointFocalProps) {
  const [x, setX] = useState(borner(focalX));
  const [y, setY] = useState(borner(focalY));

  function poserDepuisClic(evenement: React.MouseEvent<HTMLDivElement>) {
    const cadre = evenement.currentTarget.getBoundingClientRect();
    // ⚠️ Les coordonnées sont relatives au CADRE RENDU, pas à l'image d'origine : c'est
    // exactement ce qu'on veut, puisqu'on stocke un POURCENTAGE. Un calcul en pixels
    // d'origine serait faux dès que l'aperçu change de taille.
    setX(borner(((evenement.clientX - cadre.left) / cadre.width) * 100));
    setY(borner(((evenement.clientY - cadre.top) / cadre.height) * 100));
  }

  function deplacerAuClavier(evenement: React.KeyboardEvent<HTMLDivElement>) {
    const deplacements: Record<string, [number, number]> = {
      ArrowLeft: [-PAS, 0],
      ArrowRight: [PAS, 0],
      ArrowUp: [0, -PAS],
      ArrowDown: [0, PAS],
    };
    const pas = deplacements[evenement.key];
    if (pas === undefined) return;
    // Sans ça, les flèches feraient défiler la page sous le point qu'on déplace.
    evenement.preventDefault();
    setX((actuel) => borner(actuel + pas[0]));
    setY((actuel) => borner(actuel + pas[1]));
  }

  const centre = x === 50 && y === 50;

  return (
    <div className={styles.bloc}>
      <p className={styles.titre}>Point focal</p>
      <p className={styles.aide}>
        Cliquez sur le sujet de la photo — un visage, le kakémono. Les cadres du site
        garderont ce point visible quelle que soit leur forme.
        {centre ? " Par défaut, c’est le centre." : null}
      </p>

      <div className={styles.paire}>
        {/* ⚠️ Aucun `eslint-disable` ici, et c'en est la preuve : `role="slider"` + `tabIndex`
            + `onKeyDown` suffisent à en faire un contrôle légitime aux yeux du lint a11y.
            J'en avais posé un « au cas où » — il est ressorti en warning « directive
            inutile », donc retiré. Un garde-fou qui ne garde rien masque les vrais. */}
        <div
          className={styles.zone}
          role="slider"
          tabIndex={0}
          aria-label="Point focal de la photo"
          aria-valuetext={`horizontalement ${x} %, verticalement ${y} %`}
          aria-valuenow={x}
          aria-valuemin={0}
          aria-valuemax={100}
          onClick={poserDepuisClic}
          onKeyDown={deplacerAuClavier}
        >
          {/* `<img>` et non `next/image` : cette route sert un média PROTÉGÉ par session,
              et rien de protégé ne peut passer par `/_next/image` — l'optimiseur requête
              depuis le serveur, sans cookie, et reçoit la redirection de la garde (leçon
              de la 6.4, écrite dans `next.config.ts`). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.image} src={`/admin/medias/${filename}`} alt={alt} />
          <span
            aria-hidden="true"
            className={styles.repere}
            style={{ left: `${x}%`, top: `${y}%` }}
          />
        </div>

        <div className={styles.apercu}>
          <p className={styles.legende}>Aperçu dans le cadre de l’accueil</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.imageApercu}
            src={`/admin/medias/${filename}`}
            alt=""
            style={{ objectPosition: `${x}% ${y}%` }}
          />
        </div>
      </div>

      <input type="hidden" name="focalX" value={x} />
      <input type="hidden" name="focalY" value={y} />
    </div>
  );
}
