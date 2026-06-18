import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import styles from "./Sticker.module.css";

export interface StickerProps {
  /** Texte court du macaron (ex. « CE JEUDI »), rendu en Bebas sur or. */
  children: ReactNode;
  /** Classe de positionnement fournie par le contexte. La primitive pose un offset
   *  par défaut (coin haut-gauche, calé sur PhotoFrame) surchargé via cette classe. */
  className?: string;
}

// Sticker — macaron rond or, légèrement pivoté (rotate -12°). Texte ink sur or (AA).
// NB : tout futur micro-pulse/glow (Story 2.1) devra respecter prefers-reduced-motion.
export function Sticker({ children, className }: StickerProps) {
  return <span className={cn(styles.sticker, className)}>{children}</span>;
}
