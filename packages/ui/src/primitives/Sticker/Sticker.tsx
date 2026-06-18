import type { ReactNode } from "react";
import styles from "./Sticker.module.css";

interface StickerProps {
  /** Texte court du macaron (ex. « CE JEUDI »), rendu en Bebas sur or. */
  children: ReactNode;
}

// Sticker — macaron rond or, légèrement pivoté (rotate -12°). Texte ink sur or (AA).
// NB : tout futur micro-pulse/glow (Story 2.1) devra respecter prefers-reduced-motion.
export function Sticker({ children }: StickerProps) {
  return <span className={styles.sticker}>{children}</span>;
}
