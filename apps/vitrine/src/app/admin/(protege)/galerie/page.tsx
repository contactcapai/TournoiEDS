import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PhotoActions } from "@/components/admin/PhotoActions/PhotoActions";
import { formatLongDate } from "@/lib/date-paris";
import { HOME_PHOTO_COUNT } from "@/lib/galerie";
import { cleanText } from "@/lib/text";
import { exigerRolePage } from "@/server/auth/guard";
import {
  getEmploisDesImages,
  getPhotosForAdmin,
  type AdminPhoto,
} from "@/server/db/queries/photos";
import styles from "@/styles/admin-page.module.css";
import propre from "./galerie.module.css";

// Liste de la galerie du back-office (Story 6.4) — Server Component pur.
//
// 🔴 CETTE PAGE PORTE SA PROPRE GARDE, ET CE N'EST PAS UNE REDONDANCE — DÉFAUT MESURÉ EN
// STORY 6.1. Une garde placée dans un `layout` N'EMPÊCHE PAS la `page` enfant de s'exécuter :
// Next rend l'arbre de segments EN PARALLÈLE, et le `redirect()` du layout n'arrête pas un
// rendu déjà commencé ailleurs. La réponse était bien un `307`, et son corps portait le
// tableau de bord ENTIER dans la charge RSC.
//
// ⚠️ Comme l'écran d'agenda, cette page rend des lignes NON PUBLIÉES — et en plus elle en
// SERT LES IMAGES (via `/admin/medias/[filename]`, gardée elle aussi). Une fuite n'exposerait
// pas un écran vide, mais des photos que personne n'a décidé de rendre publiques.

export const metadata: Metadata = {
  title: "Médiathèque",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Borne EXPLICITE, jamais de lecture non bornée : une page dont le temps de rendu dépend du
 * volume téléversé est un défaut qui n'apparaîtrait qu'une fois la base remplie par les
 * bénévoles — c'est-à-dire en production, chez quelqu'un d'autre.
 * 200 : très au-delà de ce qu'une galerie associative accumule en une saison, tout en
 * restant borné. « Généreux » n'est pas « non borné ».
 */
const PHOTOS_MAX = 200;

function LignePhoto({
  photo,
  ordre,
  position,
  surAccueil,
  ordonnable = true,
  emplois,
}: {
  photo: AdminPhoto;
  ordre: readonly string[];
  position: number;
  surAccueil: boolean;
  /** `false` pour un visuel : il n'a pas d'ordre. Voir `PhotoActions`. */
  ordonnable?: boolean;
  /**
   * À quoi sert cette image (`getEmploisDesImages`). **Absent = aucun emploi connu**, et on
   * n'écrit alors RIEN : un « aucun emploi » se lirait comme une invitation à supprimer,
   * alors qu'une image peut parfaitement n'attendre que d'être utilisée.
   */
  emplois?: readonly string[];
}) {
  const legende = cleanText(photo.caption);

  return (
    <li className={styles.ligne}>
      {/* La vignette est servie par la route d'ADMIN : la route publique refuse les
          brouillons par conception (404), donc une vignette pointée sur `/medias/` afficherait
          un cadre cassé exactement sur les photos qu'on vient regarder avant de publier.
          ⚠️ `/admin/medias/**` est déclaré dans `next.config.ts` → `images.localPatterns`.
          Sans cette déclaration, `next/image` répondrait **400** — c'est la régression qui a
          fait disparaître le logo EDS des 5 pages en 4.3, avec sept portes vertes. */}
      {/* 🔴 `unoptimized` — MESURÉ AU GATE VISUEL, ET SANS LUI AUCUNE VIGNETTE NE S'AFFICHE.
      L'optimiseur `/_next/image` fait sa requête **depuis le serveur, sans cookie de
      session** : il reçoit le `307 → /connexion` de la garde, pas une image, et rend
      `400 The requested resource isn't a valid image`. Une ressource protégée par une
      session ne peut donc PAS transiter par lui, par construction.
      ⚠️ Et c'est aussi ce qu'on veut : une variante optimisée serait écrite dans
      `.next/cache/images`, ce qui y déposerait un BROUILLON. */}
      <div className={propre.vignette}>
        <Image
          src={`/admin/medias/${photo.filename}`}
          // `alt=""` : la description de la photo est écrite juste à côté, en toutes lettres.
          // La répéter ici ferait dire deux fois la même chose au lecteur d'écran.
          alt=""
          fill
          sizes="120px"
          className={propre.vignetteImage}
          unoptimized
        />
      </div>

      <div className={styles.ligneCorps}>
        {/* ⚠️ « Position N » N'A DE SENS QUE DANS LA GALERIE : hors d'elle, `sort_order` ne
            décide de rien (il ne gouverne que les huit de l'accueil), donc l'afficher
            annoncerait un classement qui n'existe pas. */}
        <p className={styles.ligneDate}>
          {ordonnable ? `Position ${position + 1}` : "Visuel"}
          {photo.event
            ? ` · ${photo.event.title} (${formatLongDate(photo.event.startsAt)})`
            : ordonnable
              ? " · Vie de l'asso"
              : ""}
        </p>
        {/* 🔴 C'EST LA DESCRIPTION QUI EST MISE EN AVANT, PAS LA LÉGENDE. L'écran est le
            dernier endroit où la distinction peut se perdre, et c'est la description qui
            porte l'accessibilité de la galerie publique. */}
        <p className={styles.ligneTitre}>{photo.alt}</p>
        {legende ? <p className={styles.ligneLieu}>Légende : « {legende} »</p> : null}
        {/* 🔴 CE QUE CETTE IMAGE SERT — ET C'EST CE QUI REND LA SUPPRESSION SÛRE. `alt` décrit
            ce qu'on VOIT, jamais où ça sert : sans cette ligne, supprimer un visuel utilisé
            retire l'image d'une page sans que rien ne l'ait annoncé (les `ON DELETE SET NULL`
            font que la perte est silencieuse — la page reste, l'image disparaît). */}
        {emplois && emplois.length > 0 ? (
          <p className={styles.ligneLieu}>Sert à : {emplois.join(" · ")}</p>
        ) : null}
        <p className={propre.fichier}>{photo.filename}</p>

        <span
          className={`${styles.etat} ${photo.isPublished ? styles.etatPublie : styles.etatBrouillon}`}
        >
          {photo.isPublished ? "Publiée" : "Brouillon"}
        </span>
        {surAccueil ? (
          <span className={propre.accueil}>Sur l&rsquo;accueil</span>
        ) : null}
      </div>

      <div className={styles.ligneActions}>
        <Link className={styles.lien} href={`/admin/galerie/${photo.id}`}>
          Modifier
        </Link>
        <PhotoActions
          id={photo.id}
          isPublished={photo.isPublished}
          description={photo.alt}
          filename={photo.filename}
          ordre={ordre}
          position={position}
          ordonnable={ordonnable}
        />
      </div>
    </li>
  );
}

export default async function AdminGaleriePage() {
  await exigerRolePage("admin_site");

  // ⚠️ DEUX LECTURES, EN PARALLÈLE : elles sont indépendantes. `getEmploisDesImages` ne dépend
  // pas des images affichées — elle lit les lignes qui POINTENT vers une image.
  const [photos, emplois] = await Promise.all([
    getPhotosForAdmin(PHOTOS_MAX),
    getEmploisDesImages(),
  ]);

  // ══════════════════════════════════════════════════════════════════════════════════════
  // 🔴 DEUX SECTIONS, ET LA COUPE SE FAIT ICI — PAS EN DEUX REQUÊTES (Story 15.1)
  // ══════════════════════════════════════════════════════════════════════════════════════
  //
  // La table est UNE médiathèque ; ce qui change d'une section à l'autre, c'est ce que
  // `sort_order` décide. Deux requêtes auraient produit deux ordres à tenir et deux bornes à
  // accorder, pour une lecture qui tient de toute façon en une passe.
  const galerie = photos.filter((photo) => photo.dansLaGalerie);
  const visuels = photos.filter((photo) => !photo.dansLaGalerie);

  // 🔴 L'ORDRE ENVOYÉ À `reordonnerPhotos` NE CONTIENT QUE LA GALERIE, et l'action pose
  // exactement le même filtre dans sa garde de concurrence. Les deux DOIVENT dire la même
  // chose : si l'un des deux comptait les visuels, la comparaison échouerait à chaque clic et
  // le bénévole lirait « la galerie a changé, rechargez » sur une page qui n'a pas changé.
  const ordre = galerie.map((photo) => photo.id);

  // Quelles photos entrent réellement dans les 8 de l'accueil : les 8 premières PUBLIÉES **de
  // la galerie**, dans l'ordre — pas les 8 premières lignes de cet écran.
  const surAccueil = new Set(
    galerie.filter((photo) => photo.isPublished).slice(0, HOME_PHOTO_COUNT).map((p) => p.id),
  );
  const publiees = galerie.filter((photo) => photo.isPublished).length;

  return (
    <>
      <h1 className={styles.titre}>Médiathèque</h1>
      {/* 🔴 LE CHAPÔ DIT LA NOUVELLE NATURE DE L'ÉCRAN (15.1). Il annonçait « les photos de la
          vie de l'asso » — vrai tant que la table ne portait que des souvenirs, faux depuis
          qu'elle porte aussi les visuels d'événement, de tournoi et les images de post. Une
          phrase qui décrit l'écran d'avant est un faux témoin, et ce dépôt les paie. */}
      <p className={styles.chapo}>
        Toutes les images du site&nbsp;: les photos de la vie de l&rsquo;asso, et les visuels
        qui annoncent un événement, un tournoi ou un post. Rien n&rsquo;apparaît sur le site
        tant que ce n&rsquo;est pas publié — et le changement se voit au rechargement suivant.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/galerie/nouveau">
          Téléverser des photos
        </Link>
        <Link className={styles.lien} href="/admin/galerie/apercu">
          Voir le rendu de la galerie
        </Link>
      </div>

      {/* 🔴 CE QUE L'ORDRE DÉCIDE, ÉCRIT EN TOUTES LETTRES (AC6). Sans cette phrase,
          « organiser la galerie » se lit comme un rangement sans conséquence. */}
      <p className={styles.mention} role="note">
        L&rsquo;accueil ne montre que les <strong>{HOME_PHOTO_COUNT} premières photos
        publiées</strong>, dans l&rsquo;ordre ci-dessous. Monter une photo, c&rsquo;est
        décider qu&rsquo;elle passe sur la page la plus vue du site.{" "}
        {publiees > HOME_PHOTO_COUNT
          ? `Vous avez ${publiees} photos publiées : ${publiees - HOME_PHOTO_COUNT} n'apparaissent donc pas sur l'accueil.`
          : `Vous avez ${publiees} photo${publiees > 1 ? "s" : ""} publiée${publiees > 1 ? "s" : ""} : elles apparaissent toutes sur l'accueil.`}
      </p>

      {/* ⚠️ FAIT À DIRE, PAS À TAIRE (AC6) : la contrainte `unique()` de la base protège le
          NOM du fichier, pas son CONTENU. Comme le nom est généré par le serveur, deux
          téléversements de la même image réussissent tous les deux — et la galerie
          l'afficherait deux fois. Ce n'est pas rattrapable par la base. */}
      <p className={styles.mention} role="note">
        Une même photo peut être téléversée <strong>deux fois</strong> sans que le site s&rsquo;en
        aperçoive : chaque envoi crée un fichier distinct. En cas de doublon, supprimez-en un.
      </p>

      <section className={styles.section} aria-labelledby="admin-galerie">
        <h2 className={styles.sectionTitre} id="admin-galerie">
          Galerie de l&rsquo;accueil
        </h2>

        {galerie.length > 0 ? (
          <ul className={styles.liste}>
            {galerie.map((photo, position) => (
              <LignePhoto
                key={photo.id}
                photo={photo}
                ordre={ordre}
                position={position}
                surAccueil={surAccueil.has(photo.id)}
                emplois={emplois.get(photo.id)}
              />
            ))}
          </ul>
        ) : (
          /* ⚠️ Un état vide qui dirait « aucune photo » se lirait comme une panne. Celui-ci
             dit quoi faire — même doctrine que les états vides de la home (3.2), d'/agenda
             (3.3), du tableau de bord (6.1) et de l'agenda d'admin (6.3). */
          <p className={styles.vide}>
            Aucune photo dans la galerie pour l&rsquo;instant. « Téléverser des photos » ouvre
            l&rsquo;écran d&rsquo;envoi — vous pourrez les décrire, les ordonner et voir le
            rendu avant de publier quoi que ce soit.
          </p>
        )}
      </section>

      {/* 🔴 LA SECTION DES VISUELS N'EXISTE QUE S'IL Y EN A, ET C'EST DÉLIBÉRÉ. Le premier jour
          il n'y en a aucun : afficher un bloc vide expliquerait au bénévole une mécanique
          interne (« les images hors galerie ») avant qu'elle ne le concerne. Elle apparaît au
          premier import depuis un formulaire, c'est-à-dire au moment où elle veut dire
          quelque chose. ⚠️ Même doctrine que la section « Résultats » de la fiche publique
          (14.2) : on ne rend pas une section pour dire qu'elle est vide. */}
      {visuels.length > 0 ? (
        <section className={styles.section} aria-labelledby="admin-visuels">
          <h2 className={styles.sectionTitre} id="admin-visuels">
            Visuels
          </h2>
          <p className={styles.mention} role="note">
            Ces images sont utilisables partout sur le site — visuel d&rsquo;un événement,
            d&rsquo;un tournoi, image d&rsquo;un post — mais <strong>n&rsquo;entrent pas</strong>{" "}
            dans la galerie de l&rsquo;accueil. Elles n&rsquo;ont donc pas d&rsquo;ordre.
            Pour en faire passer une sur l&rsquo;accueil, ouvrez-la et cochez «&nbsp;Montrer
            dans la galerie de l&rsquo;accueil&nbsp;».
          </p>

          <ul className={styles.liste}>
            {visuels.map((photo) => (
              <LignePhoto
                key={photo.id}
                photo={photo}
                ordre={ordre}
                position={0}
                surAccueil={false}
                ordonnable={false}
                emplois={emplois.get(photo.id)}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
