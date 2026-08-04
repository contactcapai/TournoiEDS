import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EventForm } from "@/components/admin/EventForm/EventForm";
import { lireAdmin } from "@/server/auth/guard";
import { getBars } from "@/server/db/queries/events";
import styles from "@/styles/admin-page.module.css";

// Création d'un événement (Story 6.3).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION : une garde de `layout` n'arrête pas le rendu de la
// `page` enfant (défaut mesuré en Story 6.1). Patron des Stories 6.3 → 6.13.

export const metadata: Metadata = {
  title: "Nouvel événement",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NouvelEvenementPage() {
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  const bars = await getBars();

  return (
    <>
      <h1 className={styles.titre}>Nouvel événement</h1>
      <p className={styles.chapo}>
        Un jeudi jeux ou un temps fort. Rien n&rsquo;est visible sur le site tant que la case
        « Publier » reste décochée.
      </p>

      <div className={styles.section}>
        <EventForm bars={bars} />
      </div>
    </>
  );
}
