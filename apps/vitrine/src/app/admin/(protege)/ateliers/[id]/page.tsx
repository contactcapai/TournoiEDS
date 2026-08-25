import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AtelierForm } from "@/components/admin/AtelierForm/AtelierForm";
import { LIBELLES_FAMILLE } from "@/lib/familles-ateliers";
import { exigerRolePage } from "@/server/auth/guard";
import { getWorkshopById } from "@/server/db/queries/workshops";
import styles from "@/styles/admin-page.module.css";

// Modification d'un atelier (Story 6.9).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION (défaut mesuré en 6.1 : une garde de `layout` n'arrête pas
// le rendu de la `page` enfant).
//
// 🔴 `params` EST UNE PROMESSE depuis Next 15 — précédent mesuré du projet :
// `app/medias/[filename]/route.ts`.
//
// 🔴 L'IDENTIFIANT EST VALIDÉ AVANT D'ATTEINDRE LA BASE. Un `/admin/ateliers/pas-un-uuid`
// remis tel quel à une colonne `uuid` fait lever Postgres (`invalid input syntax for type
// uuid`) → une erreur 500, là où la réponse juste est un 404. Zod valide ici un FORMAT ;
// l'existence, elle, est le `notFound()` qui suit.

export const metadata: Metadata = {
  title: "Modifier un atelier",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ModifierAtelierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerRolePage("admin_site");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const atelier = await getWorkshopById(id);
  if (!atelier) notFound();

  return (
    <>
      <h1 className={styles.titre}>Modifier un atelier</h1>
      {/* ⚠️ L'état de publication n'est PAS modifiable ici : il vit sur la ligne de la liste,
          et c'est ce découpage qui empêche ce formulaire d'écraser une bascule faite ailleurs
          pendant qu'il était ouvert (dette R35 rendue sans objet). L'écran le DIT quand même,
          parce qu'on ne modifie pas de la même façon un texte en ligne et un brouillon. */}
      <p className={styles.chapo}>
        Cet atelier appartient à la famille <strong>{LIBELLES_FAMILLE[atelier.family]}</strong>.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/ateliers/apercu">
          Voir le rendu du catalogue
        </Link>
        <Link className={styles.lien} href="/admin/ateliers">
          Retour aux ateliers
        </Link>
      </div>

      <div className={styles.section}>
        <AtelierForm
          atelier={{
            id: atelier.id,
            title: atelier.title,
            family: atelier.family,
            summary: atelier.summary,
            audience: atelier.audience,
          }}
        />
      </div>
    </>
  );
}
