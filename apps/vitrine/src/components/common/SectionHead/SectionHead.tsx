import type { ReactNode } from "react";
import { Eyebrow } from "@repo/ui";
import styles from "./SectionHead.module.css";

export interface SectionHeadProps {
  /** Label du sur-titre. Rendu par la primitive Eyebrow (losanges + capitales or). */
  eyebrow: ReactNode;
  /** Titre de section. ReactNode : l'appelant compose lui-même son <Brush>. */
  title: ReactNode;
  /** Id posé sur le titre, pour un `aria-labelledby` porté par la <section> appelante. */
  titleId?: string;
  /** Niveau du titre (1–6) pour respecter la hiérarchie du document du contexte.
   *  Défaut 2 : sur la home, le <h1> est celui du Hero. Les PAGES dédiées passent 1
   *  (leur <h1> est la tête de page). Même API que la primitive Axis — un seul
   *  patron de niveau de titre dans le dépôt. */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Chapô optionnel, rendu sous le titre (`.s-intro` de la maquette).
   *  ⚠️ Il rend du `var(--grey)`, qui n'est AA que sur les fonds les plus sombres
   *  (navy-deep / ink) et échoue sur `--surface` : ne pas l'utiliser sur une carte
   *  ou une bande relevée (DESIGN.md §Contraste & AA, UX-DR28). */
  intro?: ReactNode;
}

// SectionHead — tête de section éditoriale (`.s-head` de la maquette) : sur-titre +
// titre (+ chapô optionnel). Server Component, comme tout ce qui n'a pas d'interactivité.
//
// Vit dans `components/common/` et non `components/home/` : la page « L'asso » (2.6)
// l'utilise, la page « Animations » (2.7) l'utilisera aussi.
//
// API MINIMALE, et elle le reste (garde-fou n°7 de la Story 2.2) : `headingLevel` et
// `intro` ont été ajoutées par la Story 2.6 parce qu'elle en avait besoin — une tête
// de PAGE porte un <h1> et un chapô. Ne pas ajouter de 3ᵉ prop « au cas où »
// (`as`, `align`, `width`…) : la prochaine story qui en aura besoin l'ajoutera.
export function SectionHead({
  eyebrow,
  title,
  titleId,
  headingLevel = 2,
  intro,
}: SectionHeadProps) {
  const Heading = `h${headingLevel}` as const;

  return (
    <div className={styles.head}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Heading id={titleId} className={styles.title}>
        {title}
      </Heading>
      {intro && <p className={styles.intro}>{intro}</p>}
    </div>
  );
}
