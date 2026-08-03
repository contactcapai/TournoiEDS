import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BarActions } from "@/components/admin/BarActions/BarActions";
import { BarForm } from "@/components/admin/BarForm/BarForm";
import { lireAdmin } from "@/server/auth/guard";
import { getBars } from "@/server/db/queries/events";
import styles from "@/styles/admin-page.module.css";

// Les bars du roulement (Story 6.3, FR2) — Server Component pur, garde en PREMIÈRE
// INSTRUCTION (défaut mesuré en 6.1).
//
// ⚠️ Un bar n'a PAS d'état « publié » : c'est l'ÉVÉNEMENT qui est publié (`schema.ts`).
// Ne pas en ajouter un ici par symétrie avec l'agenda.

export const metadata: Metadata = {
  title: "Bars du roulement",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminBarsPage() {
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  const bars = await getBars();

  return (
    <>
      <h1 className={styles.titre}>Bars du roulement</h1>
      <p className={styles.chapo}>
        Les bars rémois qui accueillent les jeudis. Un accord pas encore signé s&rsquo;écrit
        tel quel — « Bar partenaire #2 » est un nom valable.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/agenda">
          Retour à l&rsquo;agenda
        </Link>
      </div>

      <section className={styles.section} aria-labelledby="bars-liste">
        <h2 className={styles.sectionTitre} id="bars-liste">
          Les bars enregistrés
        </h2>
        {bars.length > 0 ? (
          <ul className={styles.liste}>
            {bars.map((etablissement) => (
              <li key={etablissement.id} className={styles.ligne}>
                <div className={styles.ligneCorps}>
                  <p className={styles.ligneTitre}>{etablissement.name}</p>
                  <p className={styles.ligneLieu}>
                    {etablissement.address} — {etablissement.district}, {etablissement.city}
                  </p>
                </div>
                <div className={styles.ligneActions}>
                  <Link className={styles.lien} href={`/admin/agenda/bars/${etablissement.id}`}>
                    Modifier
                  </Link>
                  <BarActions id={etablissement.id} nom={etablissement.name} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.vide}>
            Aucun bar enregistré. Ajoutez-en un ci-dessous : c&rsquo;est ce qui permettra de
            rattacher un jeudi à un lieu.
          </p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="bars-ajout">
        <h2 className={styles.sectionTitre} id="bars-ajout">
          Ajouter un bar
        </h2>
        <div className={styles.liste}>
          <BarForm />
        </div>
      </section>
    </>
  );
}
