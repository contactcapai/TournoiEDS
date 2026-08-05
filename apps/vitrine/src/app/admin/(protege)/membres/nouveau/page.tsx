import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MembreForm } from "@/components/admin/MembreForm/MembreForm";
import { lireAdmin } from "@/server/auth/guard";
import styles from "@/styles/admin-page.module.css";

// Création d'un membre (Story 6.10).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION (défaut mesuré en 6.1 : une garde de `layout` n'arrête pas
// le rendu de la `page` enfant).
//
// ⚠️ CRÉATION EN DEUX TEMPS, comme les partenaires (6.5) et contrairement aux ateliers (6.9) :
// le portrait ne peut pas être téléversé avant que la fiche existe — il lui faut un
// identifiant à rattacher. La création mène donc à la FICHE, où vit le geste suivant, et non
// à la liste.

export const metadata: Metadata = {
  title: "Ajouter un membre",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NouveauMembrePage() {
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  return (
    <>
      <h1 className={styles.titre}>Ajouter un membre</h1>
      <p className={styles.chapo}>
        La fiche est créée en <strong>brouillon</strong> : rien n&rsquo;apparaît sur la page
        « L&rsquo;asso » tant que vous ne l&rsquo;avez pas publiée. Le portrait s&rsquo;ajoute
        ensuite, et il est facultatif.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/membres">
          Retour aux membres
        </Link>
      </div>

      <div className={styles.section}>
        <MembreForm />
      </div>
    </>
  );
}
