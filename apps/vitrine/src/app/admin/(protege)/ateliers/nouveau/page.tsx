import type { Metadata } from "next";
import Link from "next/link";

import { AtelierForm } from "@/components/admin/AtelierForm/AtelierForm";
import { exigerRolePage } from "@/server/auth/guard";
import styles from "@/styles/admin-page.module.css";

// Création d'un atelier (Story 6.9).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION (défaut mesuré en 6.1 : une garde de `layout` n'arrête pas
// le rendu de la `page` enfant).
//
// ⚠️ Contrairement aux partenaires et à la galerie, cet écran suffit à lui seul : un atelier
// n'a aucun fichier à téléverser, donc rien n'oblige à une création en deux temps. C'est aussi
// pour cela que la création renvoie ici à la LISTE et non à la fiche — sur la fiche il n'y
// aurait rien de plus à faire, et le geste suivant (« publier ») vit sur la ligne de la liste.

export const metadata: Metadata = {
  title: "Ajouter un atelier",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NouvelAtelierPage() {
  await exigerRolePage("admin_site");

  return (
    <>
      <h1 className={styles.titre}>Ajouter un atelier</h1>
      <p className={styles.chapo}>
        L&rsquo;atelier est créé en <strong>brouillon</strong> : rien n&rsquo;apparaît sur la
        page Animations tant que vous ne l&rsquo;avez pas publié.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/ateliers">
          Retour aux ateliers
        </Link>
      </div>

      <div className={styles.section}>
        <AtelierForm />
      </div>
    </>
  );
}
