import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { EventForm } from "@/components/admin/EventForm/EventForm";
import { exigerRolePage } from "@/server/auth/guard";
import { getBars, getEventById } from "@/server/db/queries/events";
import styles from "@/styles/admin-page.module.css";

// Édition d'un événement (Story 6.3).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION (défaut mesuré en 6.1 : une garde de `layout` n'arrête
// pas le rendu de la `page` enfant).
//
// 🔴 `params` EST UNE PROMESSE depuis Next 15 — précédent mesuré du projet :
// `app/medias/[filename]/route.ts`. L'oublier ne casse pas toujours la compilation, mais
// rend un objet inutilisable à l'exécution.
//
// 🔴 L'IDENTIFIANT EST VALIDÉ AVANT D'ATTEINDRE LA BASE. Un `/admin/agenda/pas-un-uuid`
// remis tel quel à une colonne `uuid` fait lever Postgres (`invalid input syntax for type
// uuid`) → une erreur 500, là où la réponse juste est un 404. Zod valide ici un FORMAT ;
// l'existence, elle, est le `notFound()` qui suit.

export const metadata: Metadata = {
  title: "Modifier un événement",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ModifierEvenementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerRolePage("admin_site");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [evenement, bars] = await Promise.all([getEventById(id), getBars()]);
  if (!evenement) notFound();

  return (
    <>
      <h1 className={styles.titre}>Modifier un événement</h1>
      <p className={styles.chapo}>
        {evenement.isPublished
          ? "Cet événement est publié : vos modifications sont visibles au rechargement suivant."
          : "Cet événement est un brouillon : il n'apparaît nulle part sur le site public."}
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href={`/admin/agenda/${evenement.id}/apercu`}>
          Voir le rendu public
        </Link>
        <Link className={styles.lien} href="/admin/agenda">
          Retour à la liste
        </Link>
      </div>

      <div className={styles.section}>
        <EventForm bars={bars} evenement={evenement} />
      </div>
    </>
  );
}
