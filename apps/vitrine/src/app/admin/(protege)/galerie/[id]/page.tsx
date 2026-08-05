import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { PhotoForm } from "@/components/admin/PhotoForm/PhotoForm";
import { formatLongDate } from "@/lib/date-paris";
import { lireAdmin } from "@/server/auth/guard";
import {
  getEventById,
  getPastEventsForAdmin,
  getUpcomingEventsForAdmin,
} from "@/server/db/queries/events";
import { getPhotoByIdForAdmin } from "@/server/db/queries/photos";
import styles from "@/styles/admin-page.module.css";
import propre from "../galerie.module.css";

// Modification d'une photo (Story 6.4).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION (défaut mesuré en 6.1 : une garde de `layout` n'arrête pas
// le rendu de la `page` enfant).
//
// 🔴 `params` EST UNE PROMESSE depuis Next 15 — précédent mesuré du projet :
// `app/medias/[filename]/route.ts`.
//
// 🔴 L'IDENTIFIANT EST VALIDÉ AVANT D'ATTEINDRE LA BASE. Un `/admin/galerie/pas-un-uuid`
// remis tel quel à une colonne `uuid` fait lever Postgres (`invalid input syntax for type
// uuid`) → une erreur 500, là où la réponse juste est un 404. Zod valide ici un FORMAT ;
// l'existence, elle, est le `notFound()` qui suit.

export const metadata: Metadata = {
  title: "Modifier une photo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PASSES_MAX = 50;
const A_VENIR_MAX = 20;

export default async function ModifierPhotoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [photo, passes, aVenir] = await Promise.all([
    getPhotoByIdForAdmin(id),
    getPastEventsForAdmin(PASSES_MAX),
    getUpcomingEventsForAdmin(A_VENIR_MAX),
  ]);
  if (!photo) notFound();

  const evenements = [...passes, ...aVenir].map((evenement) => ({
    id: evenement.id,
    titre: `${formatLongDate(evenement.startsAt)} — ${evenement.title}`,
  }));

  // ══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 L'ÉVÉNEMENT RATTACHÉ DOIT TOUJOURS FIGURER DANS LA LISTE — DÉFAUT RÉEL, TROUVÉ EN REVUE
  // ══════════════════════════════════════════════════════════════════════════════════════
  //
  // Les listes sont BORNÉES (50 passés, 20 à venir), et c'est voulu. Mais une photo peut être
  // rattachée à un événement PLUS ANCIEN que les 50 derniers — au rythme d'un jeudi par
  // semaine, cela arrive au bout d'un an. Son identifiant n'aurait alors correspondu à AUCUNE
  // `<option>`.
  //
  // 🔴 ET LA CONSÉQUENCE EST UNE PERTE DE DONNÉE SILENCIEUSE : `enregistrerPhoto` lit
  // `formData.get("eventId")`, c'est-à-dire la valeur du DOM — pas l'état React. Un `<select>`
  // dont la valeur ne correspond à aucune option ne peut pas la porter. Corriger une simple
  // faute dans la description aurait donc **détaché la photo de son événement**, sans message,
  // sans confirmation, et la vignette « Déjà passé » de cet événement aurait perdu sa photo.
  //
  // ⚠️ Le correctif ne dépend PAS de savoir si le DOM retombe sur `""` ou sur la première
  // option : dans les deux cas la valeur juste est INATTEIGNABLE. On garantit donc qu'elle est
  // toujours dans la liste, ce qui referme le cas quel que soit le comportement du navigateur.
  if (photo.eventId !== null && !evenements.some((e) => e.id === photo.eventId)) {
    const rattache = await getEventById(photo.eventId);
    if (rattache) {
      evenements.unshift({
        id: rattache.id,
        titre: `${formatLongDate(rattache.startsAt)} — ${rattache.title}`,
      });
    }
    // Si l'événement a disparu entre-temps, `photo.eventId` pointe sur une ligne supprimée —
    // impossible en pratique (`ON DELETE SET NULL` le remet à `null`), mais on ne fabrique
    // pas d'option fantôme pour un identifiant qu'on n'a pas su relire.
  }

  return (
    <>
      <h1 className={styles.titre}>Modifier une photo</h1>
      <p className={styles.chapo}>
        {photo.isPublished
          ? "Cette photo est publiée : vos modifications sont visibles au rechargement suivant."
          : "Cette photo est un brouillon : elle n'apparaît nulle part sur le site public."}
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/galerie/apercu">
          Voir le rendu de la galerie
        </Link>
        <Link className={styles.lien} href="/admin/galerie">
          Retour à la galerie
        </Link>
      </div>

      <div className={styles.section}>
        {/* La photo elle-même, servie par la route d'ADMIN (elle peut être un brouillon).
            ⚠️ On la montre PARCE QUE la description est ce qu'on vient corriger : écrire un
            texte alternatif sans voir l'image est le meilleur moyen d'écrire une légende à
            la place. */}
        {/* 🔴 `unoptimized` — MESURÉ AU GATE VISUEL, ET SANS LUI AUCUNE VIGNETTE NE S'AFFICHE.
        L'optimiseur `/_next/image` fait sa requête **depuis le serveur, sans cookie de
        session** : il reçoit le `307 → /admin/login` de la garde, pas une image, et rend
        `400 The requested resource isn't a valid image`. Une ressource protégée par une
        session ne peut donc PAS transiter par lui, par construction.
        ⚠️ Et c'est aussi ce qu'on veut : une variante optimisée serait écrite dans
        `.next/cache/images`, ce qui y déposerait un BROUILLON. */}
        <div className={propre.vignette}>
          <Image
            src={`/admin/medias/${photo.filename}`}
            alt=""
            fill
            sizes="120px"
            className={propre.vignetteImage}
            unoptimized
          />
        </div>
        <p className={propre.fichier}>{photo.filename}</p>

        {/* ⚠️ CE QUE CET ÉCRAN NE FAIT PAS, DIT PLUTÔT QUE LAISSÉ CHERCHER. Remplacer
            l'image d'une photo existante reviendrait à écrire un second fichier et à retirer
            le premier : c'est un téléversement, pas une modification. */}
        <p className={styles.mention} role="note">
          Le fichier image ne se remplace pas ici. Pour changer la photo elle-même,
          supprimez celle-ci et téléversez la nouvelle.
        </p>
      </div>

      <div className={styles.section}>
        <PhotoForm photo={photo} evenements={evenements} />
      </div>
    </>
  );
}
