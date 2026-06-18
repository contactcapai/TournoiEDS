import type { ReactNode } from "react";
import { Losanges } from "../Losanges/Losanges";
import styles from "./Eyebrow.module.css";

interface EyebrowProps {
  /** Label de sur-titre (rendu en capitales via CSS). */
  children: ReactNode;
}

// Eyebrow — sur-titre de section : losanges de marque + label or en capitales.
export function Eyebrow({ children }: EyebrowProps) {
  return (
    <span className={styles.eyebrow}>
      <Losanges />
      <span className={styles.label}>{children}</span>
    </span>
  );
}
