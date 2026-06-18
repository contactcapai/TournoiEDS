import styles from "./Losanges.module.css";

// Losanges — signature de marque (3 carrés or pivotés en triade dégressive).
// Purement décoratif → conteneur aria-hidden (le sens est porté par le texte voisin).
export function Losanges() {
  return (
    <span className={styles.losanges} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
