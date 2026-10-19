import type { ReactNode } from "react";

import { InfoBulle } from "@/components/admin/InfoBulle/InfoBulle";
import styles from "@/styles/admin-page.module.css";

/**
 * Le titre d'un écran du back-office, et son « i » : l'explication de l'écran vit dans la
 * bulle, pas sous le titre (Brice, 2026-10-19). Un ÉTAT (brouillon, date…) reste visible.
 * `niveau={2}` dans l'espace d'un tournoi, où le `<h1>` est le nom du tournoi.
 */
export function TitrePage({
  children,
  info,
  niveau = 1,
  libelleInfo = "À propos de cet écran",
}: {
  children: ReactNode;
  /** Un paragraphe par élément. */
  info?: ReactNode[];
  niveau?: 1 | 2;
  libelleInfo?: string;
}) {
  const Titre = niveau === 1 ? "h1" : "h2";

  return (
    <div className={styles.entete}>
      <Titre className={styles.titre}>{children}</Titre>
      {info && info.length > 0 ? (
        <InfoBulle libelle={libelleInfo}>
          {info.map((paragraphe, i) => (
            <span className={styles.bulleTexte} key={i}>
              {paragraphe}
            </span>
          ))}
        </InfoBulle>
      ) : null}
    </div>
  );
}
