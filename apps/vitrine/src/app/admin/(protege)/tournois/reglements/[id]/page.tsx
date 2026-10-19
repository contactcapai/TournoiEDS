import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ModeleReglementForm } from "@/components/admin/ModeleReglementForm/ModeleReglementForm";
import { TitrePage } from "@/components/admin/TitrePage/TitrePage";
import { exigerRolePage } from "@/server/auth/guard";
import { getModeleReglementById } from "@/server/db/queries/reglements";
import styles from "@/styles/admin-page.module.css";

export const metadata: Metadata = {
  title: "Modifier un modèle de règlement",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ModifierModeleReglementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerRolePage("admin_tournoi");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const modele = await getModeleReglementById(id);
  if (!modele) notFound();

  return (
    <>
      <TitrePage
        info={[
          <>
            Les tournois déjà pré-remplis avec ce modèle gardent leur propre copie : ce que vous
            changez ici ne vaudra que pour les prochains.
          </>,
        ]}
      >
        Modifier un modèle de règlement
      </TitrePage>
      <div className={styles.section}>
        <ModeleReglementForm modele={modele} />
      </div>
    </>
  );
}
