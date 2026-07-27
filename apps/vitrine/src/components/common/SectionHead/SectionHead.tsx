import type { ReactNode } from "react";
import { Eyebrow } from "@repo/ui";
import styles from "./SectionHead.module.css";

export interface SectionHeadProps {
  /** Label du sur-titre. Rendu par la primitive Eyebrow (losanges + capitales or). */
  eyebrow: ReactNode;
  /** Titre de section. ReactNode : l'appelant compose lui-même son <Brush>. */
  title: ReactNode;
  /** Id posé sur le <h2>, pour un `aria-labelledby` porté par la <section> appelante. */
  titleId?: string;
}

// SectionHead — tête de section éditoriale (`.s-head` de la maquette) : sur-titre +
// titre. Server Component, comme tout ce qui n'a pas d'interactivité.
//
// Vit dans `components/common/` et non `components/home/` : les pages « L'asso »
// (2.6) et « Animations » (2.7) l'utiliseront aussi.
//
// API volontairement MINIMALE (garde-fou n°7 de la Story 2.2) :
//  - le niveau de titre est <h2> en dur — sur la home comme sur les pages, le <h1>
//    est ailleurs. Le jour où un appelant a besoin d'un autre niveau, on ajoute une
//    prop `headingLevel` comme l'a fait la primitive Axis, pas avant ;
//  - pas de prop `intro` tant qu'aucune section n'en a besoin. La première story qui
//    en aura besoin l'ajoutera avec le `.s-intro` de la maquette
//    (color: var(--grey); font-size: 16.5px; margin-top: 22px).
export function SectionHead({ eyebrow, title, titleId }: SectionHeadProps) {
  return (
    <div className={styles.head}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
    </div>
  );
}
