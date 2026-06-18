import type { ReactNode } from "react";
import styles from "./Brush.module.css";

interface BrushProps {
  /** Texte souligné par le trait « brush ». Le trait lui-même est décoratif. */
  children: ReactNode;
}

// Brush — souligné main (trait or) tracé en ::after via data-URI SVG. Décoratif :
// aucune information n'est portée par le trait (le sens reste dans le texte).
export function Brush({ children }: BrushProps) {
  return <span className={styles.brush}>{children}</span>;
}
