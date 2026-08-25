import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { LogoUploader } from "@/components/admin/LogoUploader/LogoUploader";
import { PartenaireForm } from "@/components/admin/PartenaireForm/PartenaireForm";
import { estLogoDuVolume, sourceLogo } from "@/lib/logos";
import { exigerRolePage } from "@/server/auth/guard";
import { getPartnerByIdForAdmin } from "@/server/db/queries/partners";
import styles from "@/styles/admin-page.module.css";
import propre from "../partenaires.module.css";

// Modification d'un partenaire (Story 6.5).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION (défaut mesuré en 6.1 : une garde de `layout` n'arrête pas
// le rendu de la `page` enfant).
//
// 🔴 `params` EST UNE PROMESSE depuis Next 15 — précédent mesuré du projet :
// `app/medias/[filename]/route.ts`.
//
// 🔴 L'IDENTIFIANT EST VALIDÉ AVANT D'ATTEINDRE LA BASE. Un `/admin/partenaires/pas-un-uuid`
// remis tel quel à une colonne `uuid` fait lever Postgres (`invalid input syntax for type
// uuid`) → une erreur 500, là où la réponse juste est un 404. Zod valide ici un FORMAT ;
// l'existence, elle, est le `notFound()` qui suit.

export const metadata: Metadata = {
  title: "Modifier un partenaire",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ModifierPartenairePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerRolePage("admin_site");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const partenaire = await getPartnerByIdForAdmin(id);
  if (!partenaire) notFound();

  const aUnLogo = partenaire.logo !== null;
  const surLeVolume = estLogoDuVolume(partenaire.logo);
  const dansLeBandeau = partenaire.isPublished && aUnLogo;

  return (
    <>
      <h1 className={styles.titre}>Modifier un partenaire</h1>
      <p className={styles.chapo}>
        {partenaire.isPublished
          ? "Ce partenaire est publié : vos modifications sont visibles au rechargement suivant."
          : "Ce partenaire est un brouillon : il n'apparaît nulle part sur le site public."}
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/partenaires/apercu">
          Voir le rendu des murs
        </Link>
        <Link className={styles.lien} href="/admin/partenaires">
          Retour aux partenaires
        </Link>
      </div>

      {/* ── Le logo ────────────────────────────────────────────────────────────────────
          🔴 EN PREMIER, ET SUR SON PROPRE FOND. Un logo blanc sur fond clair est INVISIBLE —
          le seed le documente (« il a fallu les composer sur --navy pour les identifier »).
          Montrer la vignette sur `--navy`, comme la tuile publique, est la seule façon que ce
          qu'on voit ici ressemble à ce que verra le visiteur. */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>Logo</h2>

        <div className={propre.vignette}>
          {partenaire.logo !== null ? (
            <span className={propre.vignetteZone}>
              {/* 🔴 `unoptimized` — l'optimiseur `/_next/image` requête depuis le serveur,
                  SANS cookie de session : il reçoit le `307` de la garde, pas une image
                  (mesuré au gate visuel de la 6.4). `sourceLogo(..., true)` porte les deux
                  faits ensemble. */}
              <Image
                src={sourceLogo(partenaire.logo, true)}
                alt=""
                fill
                sizes="150px"
                className={propre.vignetteImage}
                unoptimized
              />
            </span>
          ) : (
            <span className={`${propre.vignetteZone} ${propre.sansLogo}`}>Pas de logo</span>
          )}
        </div>
        {partenaire.logo !== null ? (
          <p className={propre.fichier}>{partenaire.logo}</p>
        ) : null}

        {/* 🔴 LA CONSÉQUENCE, DITE AVANT LE GESTE (AC7). Sans logo, l'entrée existe pleinement
            sur /partenaires — mais elle est ABSENTE du bandeau de l'accueil. Personne ne le
            devine : c'est une décision prise dans `queries/partners.ts` (`logo IS NOT NULL`),
            à trois fichiers d'ici. */}
        <p className={styles.mention} role="note">
          {dansLeBandeau ? (
            <>
              Ce partenaire est <strong>dans le bandeau de l&rsquo;accueil</strong> : il est
              publié et il a un logo. Retirer son logo l&rsquo;en ferait sortir — il resterait
              sur la page Partenaires, avec son nom à la place du logo.
            </>
          ) : aUnLogo ? (
            <>
              Ce partenaire a un logo mais n&rsquo;est <strong>pas publié</strong> : il
              n&rsquo;apparaît ni sur l&rsquo;accueil, ni sur la page Partenaires. Publiez-le
              depuis la liste pour qu&rsquo;il entre dans le bandeau.
            </>
          ) : (
            <>
              Ce partenaire n&rsquo;a <strong>pas de logo</strong> : il est donc absent du
              bandeau de l&rsquo;accueil, qui est un bandeau de logos. Sur la page Partenaires,
              sa tuile affiche son <strong>nom</strong> — ce n&rsquo;est pas un trou, c&rsquo;est
              le rendu prévu.
            </>
          )}
        </p>

        <LogoUploader
          partenaireId={partenaire.id}
          nom={partenaire.name}
          aUnLogo={aUnLogo}
          logoLivreAvecLeSite={aUnLogo && !surLeVolume}
        />
      </div>

      {/* ── Le reste de la fiche ───────────────────────────────────────────────────────
          ⚠️ FORMULAIRE SÉPARÉ DU LOGO, ET C'EST VOULU : le logo n'est pas un champ de
          formulaire (il n'a pas de valeur textuelle à soumettre), et le mêler ici ferait
          qu'enregistrer une faute de frappe re-téléverserait un fichier. */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>Fiche</h2>
        <PartenaireForm
          partenaire={{
            id: partenaire.id,
            name: partenaire.name,
            category: partenaire.category,
            description: partenaire.description,
            link: partenaire.link,
          }}
        />
      </div>
    </>
  );
}
