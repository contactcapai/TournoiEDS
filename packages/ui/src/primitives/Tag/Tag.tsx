import type { ReactNode } from "react";
import styles from "./Tag.module.css";

type TagVariant = "default" | "highlight";

interface TagProps {
  /** `default` (crème, bord discret) ou `highlight` (or — « Temps fort »). */
  variant?: TagVariant;
  children: ReactNode;
}

// Tag — pilule d'étiquette. La variante `highlight` (bord + texte or) marque un temps fort.
export function Tag({ variant = "default", children }: TagProps) {
  const classes = [
    styles.tag,
    variant === "highlight" && styles.highlight,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={classes}>{children}</span>;
}
