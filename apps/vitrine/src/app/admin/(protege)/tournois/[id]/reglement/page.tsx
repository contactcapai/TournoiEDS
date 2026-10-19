import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { ReglementTournoiForm } from "@/components/admin/ReglementTournoiForm/ReglementTournoiForm";
import { TitrePage } from "@/components/admin/TitrePage/TitrePage";
import { valeursDuTournoi } from "@/lib/reglement";
import { baseDuSite } from "@/lib/site-url";
import { exigerRolePage } from "@/server/auth/guard";
import { getModelesReglement, getPhasesPourReglement } from "@/server/db/queries/reglements";
import { getTournamentById } from "@/server/db/queries/tournaments";
import styles from "@/styles/admin-page.module.css";

// L'onglet « Le règlement » : APRÈS le déroulé, parce que le pré-remplissage lit la fiche
// ENREGISTRÉE et les phases. Écrit dans la fiche, il ne voyait jamais le déroulé.

export const metadata: Metadata = {
  title: "Le règlement d'un tournoi",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ReglementTournoiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerRolePage("admin_tournoi");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [tournoi, phases, modeles] = await Promise.all([
    getTournamentById(id),
    getPhasesPourReglement(id),
    getModelesReglement(),
  ]);
  if (!tournoi) notFound();

  return (
    <>
      <TitrePage
        niveau={2}
        info={[
          <>
            Il paraît à l&rsquo;adresse <code>/tournois/{tournoi.slug}/reglement</code>, avec un
            lien depuis la page du tournoi.
          </>,
          phases.length > 0
            ? `Le pré-remplissage lit la fiche et les ${phases.length} phases du déroulé.`
            : "Le pré-remplissage lit la fiche et, une fois composé, le déroulé.",
        ]}
      >
        Le règlement
      </TitrePage>
      {/* Une action à faire reste visible ; l'explication est dans le « i ». */}
      {phases.length === 0 ? (
        <p className={styles.chapo}>
          Le déroulé n&rsquo;est <strong>pas encore composé</strong>&nbsp;: le pré-remplissage
          reprendra le texte «&nbsp;déroulé annoncé&nbsp;» de la fiche.{" "}
          <Link className={styles.lien} href={`/admin/tournois/${tournoi.id}/phases`}>
            Composer le déroulé
          </Link>
        </p>
      ) : null}

      <div className={styles.section}>
        <ReglementTournoiForm
          tournoiId={tournoi.id}
          reglement={tournoi.rules}
          modeles={modeles}
          valeursAuto={valeursDuTournoi({ ...tournoi, phases }, baseDuSite())}
        />
      </div>
    </>
  );
}
