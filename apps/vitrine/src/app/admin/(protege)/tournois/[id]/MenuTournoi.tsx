"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ENTREES_ESPACE_TOURNOI } from "./_espace";
import styles from "./layout.module.css";

/**
 * Le menu de l'espace d'un tournoi (Story 10.9, dette R61).
 *
 * 🔴 SEUL COMPOSANT CLIENT DU CHROME, et uniquement parce qu'il faut `usePathname()` pour
 * marquer l'entrée courante. Le layout qui le monte reste un RSC : il lit la base, pas lui.
 *
 * ⚠️ `aria-current="page"` ET une marque visuelle : la couleur seule ne dit rien à un lecteur
 * d'écran, et l'attribut seul ne dit rien à l'œil.
 */
export function MenuTournoi({ tournoiId }: { tournoiId: string }) {
  const chemin = usePathname();
  const base = `/admin/tournois/${tournoiId}`;
  const reste = chemin.startsWith(base) ? chemin.slice(base.length).replace(/\/$/, "") : null;

  return (
    <nav className={styles.menu} aria-label="Cet espace tournoi">
      <ul className={styles.menuListe}>
        {ENTREES_ESPACE_TOURNOI.map((entree) => {
          const courante = reste === entree.segment;
          return (
            <li key={entree.segment}>
              <Link
                className={courante ? `${styles.menuLien} ${styles.menuLienActif}` : styles.menuLien}
                href={`${base}${entree.segment}`}
                aria-current={courante ? "page" : undefined}
              >
                <span className={styles.menuLibelle}>{entree.libelle}</span>
                <span className={styles.menuMoment}>{entree.moment}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
