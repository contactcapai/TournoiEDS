import type { ReactNode } from "react";
import styles from "./Axis.module.css";

export interface AxisProps {
  /** Numéro d'axe affiché en chiffre fantôme (ex. « 01 »). Décoratif. */
  number: string;
  /** Titre de l'axe — porte le sens (rendu en heading). */
  title: string;
  /** Niveau du titre (1–6) pour respecter la hiérarchie du document du contexte.
   *  Défaut 3. La primitive ne force pas un niveau fixe ni un rôle de liste : le
   *  regroupement (ul/ol, section) reste à la charge de la composition (Epic 2+). */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Corps de texte de l'axe. */
  children: ReactNode;
}

// Axis — bloc « axe numéroté ». Conteneur neutre (<div>) : un axe n'a de sens qu'en
// contexte (pas de syndication → pas d'<article>). Le numéro fantôme (or 28 %) est
// purement décoratif (aria-hidden) ; le sens est porté par le heading + le texte.
export function Axis({ number, title, headingLevel = 3, children }: AxisProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={styles.axe}>
      {/* Le numéro est passé en `data-number` et rendu par `::before` (voir le CSS),
          PAS en nœud texte. Raison : à 28 % d'opacité il plafonne à 1.80:1, et
          axe-core/Lighthouse contrôlent le contraste de tout texte VISIBLE sans
          tenir compte d'`aria-hidden` — l'audit `color-contrast` échouait donc sur
          chaque page portant un axe (mesuré en Story 2.2 : A11y 96/100). WCAG 1.4.3
          exempte la décoration pure, mais l'outil ne peut pas le savoir.
          Le contenu généré n'est pas un nœud texte → plus d'échec, rendu identique,
          et `aria-hidden` couvre aussi le pseudo-élément : aucun lecteur d'écran
          n'annonce « 01 ». L'opacité de charte (28 %) est préservée telle quelle. */}
      <span className={styles.n} aria-hidden="true" data-number={number} />
      <div>
        <Heading className={styles.title}>{title}</Heading>
        <p className={styles.body}>{children}</p>
      </div>
    </div>
  );
}
