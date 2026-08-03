import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { BarForm } from "@/components/admin/BarForm/BarForm";
import { lireAdmin } from "@/server/auth/guard";
import { getBarById } from "@/server/db/queries/events";
import styles from "@/styles/admin-page.module.css";

// Édition d'un bar du roulement (Story 6.3).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION · `params` est une PROMESSE · identifiant validé AVANT
// la base (un `uuid` malformé fait lever Postgres → 500 au lieu de 404). Mêmes trois
// règles que `agenda/[id]/page.tsx` — c'est le patron des routes dynamiques d'admin.

export const metadata: Metadata = {
  title: "Modifier un bar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ModifierBarPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const etablissement = await getBarById(id);
  if (!etablissement) notFound();

  return (
    <>
      <h1 className={styles.titre}>Modifier un bar</h1>
      <p className={styles.chapo}>
        Le nom et le quartier s&rsquo;affichent sur la carte du prochain rendez-vous ;
        l&rsquo;adresse complète n&rsquo;apparaît que sur la page Agenda.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/agenda/bars">
          Retour aux bars
        </Link>
      </div>

      <div className={styles.section}>
        <BarForm bar={etablissement} />
      </div>
    </>
  );
}
