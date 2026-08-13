import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TournoiForm } from "@/components/admin/TournoiForm/TournoiForm";
import { lireAdmin } from "@/server/auth/guard";
import { getEventsPourRattachement } from "@/server/db/queries/tournaments";
import styles from "@/styles/admin-page.module.css";

// Création d'un tournoi (Story 9.1).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION (défaut mesuré en 6.1 : une garde de `layout` n'arrête pas
// le rendu de la `page` enfant).
//
// ⚠️ Comme pour les ateliers, cet écran suffit à lui seul : un tournoi n'a aucun fichier à
// téléverser, donc rien n'oblige à une création en deux temps. C'est aussi pour cela que la
// création renvoie à la LISTE et non à la fiche — sur la fiche il n'y aurait rien de plus à
// faire, et le geste suivant (« publier ») vit sur la ligne de la liste.

export const metadata: Metadata = {
  title: "Ajouter un tournoi",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Borne EXPLICITE sur la liste des événements proposables. 200 couvre plusieurs années
 * d'agenda ; « généreux » n'est pas « non borné ».
 */
const EVENEMENTS_MAX = 200;

export default async function NouveauTournoiPage() {
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  const evenements = await getEventsPourRattachement(EVENEMENTS_MAX);

  return (
    <>
      <h1 className={styles.titre}>Ajouter un tournoi</h1>
      <p className={styles.chapo}>
        Le tournoi est créé en <strong>brouillon</strong>. Il doit être rattaché à un
        événement de l&rsquo;agenda — c&rsquo;est cet événement qui porte le lieu et
        l&rsquo;occasion.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/tournois">
          Retour aux tournois
        </Link>
      </div>

      <div className={styles.section}>
        <TournoiForm evenements={evenements} />
      </div>
    </>
  );
}
