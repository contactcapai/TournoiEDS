import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import styles from "./Tag.module.css";

type TagVariant = "default" | "highlight";

export interface TagProps {
  /** `default` (crème, bord discret) ou `highlight` (or — « Temps fort »). */
  variant?: TagVariant;
  children: ReactNode;
}

// Tag — pilule d'étiquette. La variante `highlight` (bord + texte or) marque un temps fort.
export function Tag({ variant = "default", children }: TagProps) {
  const classes = cn(styles.tag, variant === "highlight" && styles.highlight);

  return <span className={classes}>{children}</span>;
}
