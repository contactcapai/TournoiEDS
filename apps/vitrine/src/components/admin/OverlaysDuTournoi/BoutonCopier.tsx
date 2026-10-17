"use client";

import { useState } from "react";

import styles from "./OverlaysDuTournoi.module.css";

/** Copie une adresse dans le presse-papiers, et le dit (annonce polie au lecteur d'écran). */
export function BoutonCopier({ texte, libelle }: { texte: string; libelle: string }) {
  const [etat, setEtat] = useState<"repos" | "copie" | "echec">("repos");

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte);
      setEtat("copie");
    } catch {
      // Contexte non sécurisé ou permission refusée : l'adresse reste sélectionnable à la main.
      setEtat("echec");
    }
    setTimeout(() => setEtat("repos"), 2500);
  }

  return (
    <button type="button" className={styles.copier} onClick={copier} aria-label={`Copier ${libelle}`}>
      <span aria-live="polite">
        {etat === "copie" ? "Copiée" : etat === "echec" ? "Copie impossible" : "Copier"}
      </span>
    </button>
  );
}
