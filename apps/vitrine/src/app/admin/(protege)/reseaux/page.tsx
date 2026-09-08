import type { Metadata } from "next";

import { ComposeurReseaux } from "@/components/admin/ComposeurReseaux/ComposeurReseaux";
import { formatLongDate, formatTime } from "@/lib/date-paris";
import { RESEAUX_CABLES, listerReseaux } from "@/lib/reseaux";
import { cleanText } from "@/lib/text";
import { exigerRolePage } from "@/server/auth/guard";
import { getImagesPourChoix } from "@/server/db/queries/photos";
import { getUpcomingEventsForAdmin } from "@/server/db/queries/events";
import styles from "@/styles/admin-page.module.css";

/**
 * Composer une annonce pour les réseaux (Story 7.6) — Server Component.
 *
 * 🔴 CETTE PAGE PORTE SA PROPRE GARDE : une garde de `layout` n'empêche pas la `page` de
 * s'exécuter, Next rendant les segments en parallèle (défaut mesuré en 6.1).
 *
 * ⚠️ Elle liste des événements NON PUBLIÉS — l'envoi les refuse, mais les cacher ferait
 * chercher en vain une soirée qu'on vient de saisir. Ils sont montrés et marqués.
 */
export const metadata: Metadata = {
  title: "Réseaux",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Borne explicite : un écran dont le temps de rendu suit le remplissage de la base. */
const EVENEMENTS_MAX = 40;

// Borne EXPLICITE de la médiathèque, comme sur les écrans d'événement et de tournoi.
const IMAGES_MAX = 200;

export default async function AdminReseauxPage() {
  await exigerRolePage("admin_site");

  // ⚠️ Les deux lectures sont indépendantes : elles partent ensemble (15.1).
  const [lignes, images] = await Promise.all([
    getUpcomingEventsForAdmin(EVENEMENTS_MAX),
    getImagesPourChoix(IMAGES_MAX),
  ]);

  const evenements = lignes.map((evenement) => ({
    id: evenement.id,
    libelle: `${cleanText(evenement.title) ?? evenement.title} — ${formatLongDate(
      evenement.startsAt,
    )} à ${formatTime(evenement.startsAt)}`,
    publie: evenement.isPublished,
  }));

  return (
    <>
      <h1 className={styles.titre}>Réseaux</h1>
      <p className={styles.chapo}>
        Donnez une image et deux mots de contexte : les quatre textes vous sont proposés, un
        par réseau. Vous les relisez, vous corrigez, et vous envoyez. Rien ne part avant.
      </p>

      {RESEAUX_CABLES.length === 0 ? (
        <p className={styles.mention}>
          ⚠️ <strong>Aucun réseau n&rsquo;est encore raccordé à l&rsquo;outil de publication.</strong>{" "}
          Vous pouvez composer et copier les textes, mais un envoi ne fera paraître l&rsquo;annonce
          nulle part.
        </p>
      ) : (
        <p className={styles.mention}>
          Un envoi paraîtra sur <strong>{listerReseaux()}</strong>.
        </p>
      )}

      <ComposeurReseaux evenements={evenements} images={images} />
    </>
  );
}
