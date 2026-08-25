import type { Metadata } from "next";
import Link from "next/link";

import { PartenaireForm } from "@/components/admin/PartenaireForm/PartenaireForm";
import { exigerRolePage } from "@/server/auth/guard";
import styles from "@/styles/admin-page.module.css";

// Création d'un partenaire (Story 6.5).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION (défaut mesuré en 6.1 : une garde de `layout` n'arrête pas
// le rendu de la `page` enfant).
//
// 🔴 LE LOGO N'EST PAS SUR CET ÉCRAN, ET C'EST UNE GARDE, PAS UN OUBLI. Téléverser avant que
// la fiche existe écrirait un fichier sur le volume qu'AUCUNE ligne ne référencerait — un
// octet que plus aucun écran ne pourrait atteindre, invisible et croissant. C'est très
// exactement ce que `ecrireMedia` documente et que la 6.4 a mis en ordre. La création est donc
// en deux temps, et le formulaire le DIT avant de laisser chercher un bouton qui n'existe pas.

export const metadata: Metadata = {
  title: "Ajouter un partenaire",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NouveauPartenairePage() {
  await exigerRolePage("admin_site");

  return (
    <>
      <h1 className={styles.titre}>Ajouter un partenaire</h1>
      <p className={styles.chapo}>
        La fiche est créée en <strong>brouillon</strong> : rien n&rsquo;apparaît sur le site
        tant que vous ne l&rsquo;avez pas publiée.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/partenaires">
          Retour aux partenaires
        </Link>
      </div>

      <div className={styles.section}>
        <PartenaireForm />
      </div>
    </>
  );
}
