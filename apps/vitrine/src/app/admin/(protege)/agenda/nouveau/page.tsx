import type { Metadata } from "next";

import { EventForm } from "@/components/admin/EventForm/EventForm";
import { exigerRolePage } from "@/server/auth/guard";
import { getImagesPourChoix } from "@/server/db/queries/photos";
import { getBars } from "@/server/db/queries/events";
import styles from "@/styles/admin-page.module.css";

// Création d'un événement (Story 6.3).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION : une garde de `layout` n'arrête pas le rendu de la
// `page` enfant (défaut mesuré en Story 6.1). Patron des Stories 6.3 → 6.13.

export const metadata: Metadata = {
  title: "Nouvel événement",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";


// Borne EXPLICITE de la médiathèque, comme partout : une page dont le temps de rendu dépend du
// volume téléversé est un défaut qui n'apparaîtrait qu'une fois la base remplie, c'est-à-dire
// en production. Même valeur que l'écran de tournoi, pour que les deux proposent la même chose.
const IMAGES_MAX = 200;

export default async function NouvelEvenementPage() {
  await exigerRolePage("admin_site");

  // Les deux lectures sont indépendantes : elles partent ensemble.
  const [bars, images] = await Promise.all([getBars(), getImagesPourChoix(IMAGES_MAX)]);

  return (
    <>
      <h1 className={styles.titre}>Nouvel événement</h1>
      <p className={styles.chapo}>
        Un jeudi jeux ou un temps fort. Rien n&rsquo;est visible sur le site tant que la case
        « Publier » reste décochée.
      </p>

      <div className={styles.section}>
        <EventForm bars={bars} images={images} />
      </div>
    </>
  );
}
