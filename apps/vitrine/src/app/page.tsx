import styles from "./page.module.css";

// Placeholder de transition (Story 1.2) : prouve visuellement que la chaîne
// tokens → layout fonctionne (fond navy, Bebas/Roboto/Caveat de la charte).
// Remplacé par le vrai Hero en Epic 2 (Story 2.1).
export default function Home() {
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>Esport des Sacres — Reims</p>
      <h1 className={styles.title}>La charte est en place</h1>
      <p className={styles.lead}>
        Socle design system EDS : tokens couleurs, typographies et espacements
        sont câblés depuis <code>@repo/ui</code>. Le contenu arrive bientôt.
      </p>
      <p className={styles.hand}>à très vite, sur le site &amp; dans les bars rémois</p>
    </main>
  );
}
