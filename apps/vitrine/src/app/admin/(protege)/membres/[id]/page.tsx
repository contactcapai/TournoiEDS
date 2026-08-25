import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { MembreForm } from "@/components/admin/MembreForm/MembreForm";
import { PortraitUploader } from "@/components/admin/PortraitUploader/PortraitUploader";
import { sourcePortrait } from "@/lib/portraits";
import { exigerRolePage } from "@/server/auth/guard";
import { getMemberById } from "@/server/db/queries/members";
import styles from "@/styles/admin-page.module.css";
import propre from "../membres.module.css";

// Modification d'un membre (Story 6.10).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION (défaut mesuré en 6.1 : une garde de `layout` n'arrête pas
// le rendu de la `page` enfant).
//
// 🔴 `params` EST UNE PROMESSE depuis Next 15 — précédent mesuré du projet :
// `app/medias/[filename]/route.ts`.
//
// 🔴 L'IDENTIFIANT EST VALIDÉ AVANT D'ATTEINDRE LA BASE. Un `/admin/membres/pas-un-uuid` remis
// tel quel à une colonne `uuid` fait lever Postgres (`invalid input syntax for type uuid`) →
// une erreur 500, là où la réponse juste est un 404. Zod valide ici un FORMAT ; l'existence,
// elle, est le `notFound()` qui suit.

export const metadata: Metadata = {
  title: "Modifier un membre",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ModifierMembrePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerRolePage("admin_site");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const membre = await getMemberById(id);
  if (!membre) notFound();

  const aUnPortrait = membre.portrait !== null;

  return (
    <>
      <h1 className={styles.titre}>Modifier une fiche</h1>
      <p className={styles.chapo}>
        {membre.isPublished
          ? "Cette fiche est publiée : vos modifications sont visibles au rechargement suivant."
          : "Cette fiche est un brouillon : elle n'apparaît nulle part sur le site public."}
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/membres/apercu">
          Voir le rendu de l&rsquo;équipe
        </Link>
        <Link className={styles.lien} href="/admin/membres">
          Retour aux membres
        </Link>
      </div>

      {/* ── Le portrait ────────────────────────────────────────────────────────────────
          🔴 EN PREMIER, ET DANS SON CADRE RÉEL. La vignette reproduit le cadre public :
          carrée, fond sombre, `object-fit: cover`. C'est la seule façon de voir AVANT
          publication ce que le recadrage carré va couper — un aperçu en `contain`
          montrerait toute la photo et cacherait précisément ce qui disparaît. */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>Portrait</h2>

        <span className={propre.vignette}>
          {membre.portrait !== null ? (
            /* 🔴 `unoptimized` — l'optimiseur `/_next/image` requête depuis le serveur, SANS
               cookie de session : il reçoit le `307` de la garde, pas une image (mesuré au
               gate visuel de la 6.4). `sourcePortrait(..., true)` porte les deux faits
               ensemble, et l'appelant ne peut pas les dissocier. */
            <Image
              src={sourcePortrait(membre.portrait, true)}
              alt=""
              fill
              sizes="120px"
              className={propre.vignetteImage}
              unoptimized
            />
          ) : (
            <span className={propre.sansPortrait}>Pas de portrait</span>
          )}
        </span>
        {membre.portrait !== null ? (
          <p className={propre.fichier}>{membre.portrait}</p>
        ) : null}

        {/* 🔴 LA CONSÉQUENCE, DITE AVANT LE GESTE. Contrairement au logo d'un partenaire —
            dont le retrait faisait DISPARAÎTRE l'entrée du bandeau de l'accueil —, retirer un
            portrait ne change rien à la place de la carte. Le dire évite qu'on hésite à
            publier une fiche sans photo, ou qu'on croie casser la mise en page. */}
        <p className={styles.mention} role="note">
          {aUnPortrait ? (
            <>
              Cette photo est <strong>recadrée en carré</strong> à l&rsquo;affichage, à partir
              du haut — c&rsquo;est ce que montre la vignette ci-dessus. Le fichier
              d&rsquo;origine, lui, garde ses proportions. Retirer le portrait ne déplacerait
              rien sur le site : la carte resterait à sa place, avec une silhouette.
            </>
          ) : (
            <>
              Cette fiche n&rsquo;a <strong>pas de portrait</strong>, et c&rsquo;est un état
              tout à fait normal : sur la page « L&rsquo;asso », sa carte affiche une
              silhouette, à la même place et à la même taille que les autres. Ajouter une photo
              plus tard ne déplacera rien.
            </>
          )}
        </p>

        <PortraitUploader
          membreId={membre.id}
          prenom={membre.firstName}
          aUnPortrait={aUnPortrait}
        />
      </div>

      {/* ── Le reste de la fiche ───────────────────────────────────────────────────────
          ⚠️ FORMULAIRE SÉPARÉ DU PORTRAIT, ET C'EST VOULU : le portrait n'est pas un champ de
          formulaire (il n'a pas de valeur textuelle à soumettre), et le mêler ici ferait
          qu'enregistrer une faute de frappe re-téléverserait un fichier. */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>Fiche</h2>
        <MembreForm
          membre={{ id: membre.id, firstName: membre.firstName, role: membre.role }}
        />
      </div>
    </>
  );
}
