import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { TournoiForm } from "@/components/admin/TournoiForm/TournoiForm";
import { formatLongDate } from "@/lib/date-paris";
import { lireAdmin } from "@/server/auth/guard";
import {
  getEventsPourRattachement,
  getPhotosPourVisuel,
  getTournamentById,
} from "@/server/db/queries/tournaments";
import styles from "@/styles/admin-page.module.css";

// Modification d'un tournoi (Story 9.1).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION (défaut mesuré en 6.1 : une garde de `layout` n'arrête pas
// le rendu de la `page` enfant).
//
// 🔴 `params` EST UNE PROMESSE depuis Next 15 — précédent mesuré du projet :
// `app/medias/[filename]/route.ts`.
//
// 🔴 L'IDENTIFIANT EST VALIDÉ AVANT D'ATTEINDRE LA BASE. Un `/admin/tournois/pas-un-uuid`
// remis tel quel à une colonne `uuid` fait lever Postgres (`invalid input syntax for type
// uuid`) → une erreur 500, là où la réponse juste est un 404. Zod valide ici un FORMAT ;
// l'existence, elle, est le `notFound()` qui suit.

export const metadata: Metadata = {
  title: "Modifier un tournoi",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Même borne que l'écran de création, et pour la même raison. */
const EVENEMENTS_MAX = 200;

/** Même doctrine pour les photos proposables en visuel (A2). */
const PHOTOS_MAX = 200;

export default async function ModifierTournoiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [tournoi, evenements, photos] = await Promise.all([
    getTournamentById(id),
    getEventsPourRattachement(EVENEMENTS_MAX),
    getPhotosPourVisuel(PHOTOS_MAX),
  ]);
  if (!tournoi) notFound();

  return (
    <>
      <h1 className={styles.titre}>Modifier un tournoi</h1>
      {/* ⚠️ L'état de publication n'est PAS modifiable ici : il vit sur la ligne de la liste,
          et c'est ce découpage qui empêche ce formulaire d'écraser une bascule faite ailleurs
          pendant qu'il était ouvert (dette R35 rendue sans objet). L'écran le DIT quand même,
          parce qu'on ne modifie pas de la même façon une page en ligne et un brouillon — et
          parce que c'est l'état de publication qui décide si l'adresse est encore modifiable. */}
      <p className={styles.chapo}>
        Rattaché à <strong>{tournoi.event.title}</strong> (
        {formatLongDate(tournoi.event.startsAt)}).{" "}
        {tournoi.isPublished ? (
          <>
            Ce tournoi est <strong>publié</strong> : son adresse est figée tant qu&rsquo;il
            n&rsquo;est pas retiré du site.
          </>
        ) : (
          <>
            Ce tournoi est un <strong>brouillon</strong> : tout est encore modifiable, adresse
            comprise.
          </>
        )}
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/tournois">
          Retour aux tournois
        </Link>
      </div>

      <div className={styles.section}>
        <TournoiForm tournoi={tournoi} evenements={evenements} photos={photos} />
      </div>
    </>
  );
}
