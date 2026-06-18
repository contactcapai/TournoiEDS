import { Eyebrow } from "@repo/ui";
import styles from "./page.module.css";

// Coquille d'accueil (Story 1.6) : page publique minimale, sémantique et à la
// charte, servie en RSC/SSG (aucun 'use client'). Le <main id="content"> est
// fourni par (public)/layout.tsx → cette page ne déclare PAS son propre <main>
// (un seul <main>/<h1> dans le DOM). Le vrai Hero + sections arrivent en Epic 2
// (Story 2.1+) ; ici le contenu reste un placeholder propre assumé.
export default function Home() {
  return (
    <section className={styles.hero} aria-labelledby="home-title">
      <Eyebrow>Reims · esport associatif</Eyebrow>
      <h1 id="home-title" className={styles.title}>
        Esport des Sacres
      </h1>
      <p className={styles.lead}>
        La communauté esport rémoise se retrouve chaque jeudi, en roulement sur
        quatre bars de la ville. Agenda, animations et tournois arrivent ici très
        bientôt.
      </p>
    </section>
  );
}
