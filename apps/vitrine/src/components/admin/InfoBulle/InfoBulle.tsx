"use client";

import { useId, useState, type ReactNode } from "react";

import styles from "./InfoBulle.module.css";

/**
 * Un « i » en exposant qui ouvre une explication : au survol sur ordinateur, au toucher sur
 * téléphone (où le survol n'existe pas), Échap pour refermer.
 */
export function InfoBulle({ libelle, children }: { libelle: string; children: ReactNode }) {
  const [ouverte, setOuverte] = useState(false);
  const id = useId();

  return (
    <span
      className={styles.info}
      // La souris seule : un toucher émule un survol juste avant le clic, qui refermerait aussitôt.
      onPointerEnter={(e) => e.pointerType === "mouse" && setOuverte(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setOuverte(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOuverte(false);
      }}
    >
      <button
        type="button"
        className={styles.bouton}
        aria-label={libelle}
        aria-expanded={ouverte}
        aria-controls={id}
        onClick={() => setOuverte((v) => !v)}
        onBlur={() => setOuverte(false)}
      >
        <span className={styles.rond} aria-hidden="true">
          i
        </span>
      </button>
      <span id={id} role="tooltip" className={styles.bulle} hidden={!ouverte}>
        {children}
      </span>
    </span>
  );
}
