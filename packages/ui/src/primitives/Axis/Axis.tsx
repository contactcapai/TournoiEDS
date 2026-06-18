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
      <span className={styles.n} aria-hidden="true">
        {number}
      </span>
      <div>
        <Heading className={styles.title}>{title}</Heading>
        <p className={styles.body}>{children}</p>
      </div>
    </div>
  );
}
