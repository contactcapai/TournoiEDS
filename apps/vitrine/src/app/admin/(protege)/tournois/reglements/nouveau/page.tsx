import type { Metadata } from "next";

import { ModeleReglementForm } from "@/components/admin/ModeleReglementForm/ModeleReglementForm";
import { exigerRolePage } from "@/server/auth/guard";
import styles from "@/styles/admin-page.module.css";

export const metadata: Metadata = {
  title: "Ajouter un modèle de règlement",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NouveauModeleReglementPage() {
  await exigerRolePage("admin_tournoi");

  return (
    <>
      <h1 className={styles.titre}>Ajouter un modèle de règlement</h1>
      <div className={styles.section}>
        <ModeleReglementForm />
      </div>
    </>
  );
}
