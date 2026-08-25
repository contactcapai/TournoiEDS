import type { Metadata } from "next";

import { PhotoUploader } from "@/components/admin/PhotoUploader/PhotoUploader";
import { formatLongDate } from "@/lib/date-paris";
import { exigerRolePage } from "@/server/auth/guard";
import { getPastEventsForAdmin, getUpcomingEventsForAdmin } from "@/server/db/queries/events";
import styles from "@/styles/admin-page.module.css";

// Téléversement de photos (Story 6.4).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION : une garde de `layout` n'arrête pas le rendu de la
// `page` enfant (défaut mesuré en Story 6.1). Patron des Stories 6.3 → 6.13.

export const metadata: Metadata = {
  title: "Téléverser des photos",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Bornes EXPLICITES sur les événements proposés au rattachement.
 * Les PASSÉS d'abord et en plus grand nombre : c'est après une soirée qu'on téléverse ses
 * photos, pas avant. Un événement à venir reste proposé — on peut préparer un visuel.
 */
const PASSES_MAX = 50;
const A_VENIR_MAX = 20;

export default async function NouvellesPhotosPage() {
  await exigerRolePage("admin_site");

  const [passes, aVenir] = await Promise.all([
    getPastEventsForAdmin(PASSES_MAX),
    getUpcomingEventsForAdmin(A_VENIR_MAX),
  ]);

  // Le libellé porte la DATE : deux « Jeudi jeux » sans date seraient indiscernables dans la
  // liste déroulante, et le bénévole rattacherait au hasard.
  const evenements = [...passes, ...aVenir].map((evenement) => ({
    id: evenement.id,
    titre: `${formatLongDate(evenement.startsAt)} — ${evenement.title}`,
  }));

  return (
    <>
      <h1 className={styles.titre}>Téléverser des photos</h1>
      <p className={styles.chapo}>
        Choisissez une ou plusieurs photos, décrivez-les, et envoyez. Elles arrivent en{" "}
        <strong>brouillon</strong> : rien n&rsquo;apparaît sur le site avant que vous ne les
        publiiez, une par une, depuis la galerie.
      </p>

      <div className={styles.section}>
        <PhotoUploader evenements={evenements} />
      </div>
    </>
  );
}
