import Link from "next/link";

import { jourLisible } from "@/lib/date-paris";
import styles from "./BarreJournees.module.css";

/**
 * Le choix d'une journée, en bandeau (Story 13.1).
 *
 * 🔴 DEUX CONSOMMATEURS DE MÊME NATURE, ET C'EST CE QUI AUTORISE LE PARTAGE. Les engagés et
 * le jour J posent la MÊME question — « quelle journée regarde-t-on ? » — et doivent y
 * répondre de la même façon, sinon on croit changer de sujet en changeant d'écran.
 *
 * ⚠️ CE QU'ILS NE PARTAGENT PAS, C'EST LA DESTINATION. Les engagés portent la journée dans
 * `?jour=` ; le jour J l'atteint par la PREMIÈRE PHASE de cette journée (`?phase=`), pour
 * n'avoir qu'une seule source de vérité dans son URL. D'où `href` fourni par l'appelant et
 * jamais construit ici — un composant qui fabriquerait les deux adresses casserait au premier
 * consommateur d'une troisième nature (leçon de la 6.7).
 *
 * ⚠️ L'ENTRÉE QUI N'EST PAS UNE DATE NE VEUT PAS DIRE LA MÊME CHOSE DES DEUX CÔTÉS : « tout le
 * tournoi » chez les engagés (un agrégat), « sans jour fixé » au jour J (un vrai groupe de
 * phases). Elle porte donc son propre libellé, et le type l'EXIGE — un `libelleTout` unique
 * pour les deux aurait fini par mentir sur l'un des deux écrans.
 *
 * ⚠️ CE SONT DES LIENS, pas des boutons : partageables, ouvrables dans un onglet, utilisables
 * sans JavaScript. Le jour J, l'écran est ouvert sur un téléphone qui perd le réseau.
 */
export type EntreeJournee =
  | { jour: string; href: string; actif: boolean }
  | { jour: null; libelle: string; href: string; actif: boolean };

export function BarreJournees({
  entrees,
  intitule,
}: {
  entrees: readonly EntreeJournee[];
  /** Le nom du groupe, pour les lecteurs d'écran. */
  intitule: string;
}) {
  return (
    <nav className={styles.barre} aria-label={intitule}>
      <span className={styles.intitule} aria-hidden="true">
        Journées
      </span>

      <ul className={styles.liste}>
        {entrees.map((entree) => (
          <li key={entree.jour ?? "sans-date"}>
            <Link
              href={entree.href}
              className={entree.actif ? `${styles.onglet} ${styles.actif}` : styles.onglet}
              aria-current={entree.actif ? "page" : undefined}
            >
              {entree.jour === null ? (
                entree.libelle
              ) : (
                <time dateTime={entree.jour}>{jourLisible(entree.jour)}</time>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
