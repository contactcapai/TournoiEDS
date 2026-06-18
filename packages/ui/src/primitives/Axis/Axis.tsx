import type { ReactNode } from "react";
import styles from "./Axis.module.css";

interface AxisProps {
  /** Numéro d'axe affiché en chiffre fantôme (ex. « 01 »). Décoratif. */
  number: string;
  /** Titre de l'axe — porte le sens (rendu en <h3>). */
  title: string;
  /** Corps de texte de l'axe. */
  children: ReactNode;
}

// Axis — bloc « axe numéroté ». Le numéro fantôme (or 28 %) est purement décoratif
// (aria-hidden) ; le sens et l'ordre de lecture sont portés par le <h3> + le texte.
export function Axis({ number, title, children }: AxisProps) {
  return (
    <article className={styles.axe}>
      <span className={styles.n} aria-hidden="true">
        {number}
      </span>
      <div>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.body}>{children}</p>
      </div>
    </article>
  );
}
