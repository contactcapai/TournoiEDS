import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { MembreActions } from "@/components/admin/MembreActions/MembreActions";
import { sourcePortrait } from "@/lib/portraits";
import { cleanText } from "@/lib/text";
import { exigerRolePage } from "@/server/auth/guard";
import {
  getMembersForAdmin,
  MEMBRES_MAX,
  type AdminMember,
} from "@/server/db/queries/members";
import styles from "@/styles/admin-page.module.css";
import propre from "./membres.module.css";

// Liste des membres du back-office (Story 6.10) — Server Component pur.
//
// 🔴 CETTE PAGE PORTE SA PROPRE GARDE, ET CE N'EST PAS UNE REDONDANCE — DÉFAUT MESURÉ EN
// STORY 6.1. Une garde placée dans un `layout` N'EMPÊCHE PAS la `page` enfant de s'exécuter :
// Next rend l'arbre de segments EN PARALLÈLE, et le `redirect()` du layout n'arrête pas un
// rendu déjà commencé ailleurs.
//
// ⚠️ Cette page rend des lignes NON PUBLIÉES, et il s'agit de DONNÉES PERSONNELLES : prénoms et
// portraits de personnes que l'association n'a pas encore choisi de publier.

export const metadata: Metadata = {
  title: "Membres",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// La borne vit dans `queries/members.ts`, avec la requête qu'elle borne — elle est PARTAGÉE
// avec `reordonnerMembres`, qui doit relire exactement ce que cet écran affiche.

function LigneMembre({
  membre,
  ordre,
  position,
}: {
  membre: AdminMember;
  ordre: readonly string[];
  position: number;
}) {
  // `cleanText` : filet du rendu contre une écriture qui contournerait Zod et les `CHECK`
  // (`UPDATE` direct, restauration). Jamais un fragment vide à l'écran.
  const prenom = cleanText(membre.firstName) ?? "(prénom manquant)";
  const role = cleanText(membre.role) ?? "(rôle manquant)";

  return (
    <li className={styles.ligne}>
      <div className={styles.ligneCorps}>
        <div className={propre.ligneAvecVignette}>
          {/* 🔴 LA VIGNETTE EST TOUJOURS RENDUE, comme le cadre public : c'est le même
              arbitrage, et c'est ce qui rend l'inventaire lisible en colonne. */}
          <span className={propre.vignette}>
            {membre.portrait !== null ? (
              /* 🔴 `unoptimized` — l'optimiseur `/_next/image` requête depuis le serveur,
                 SANS cookie de session : il reçoit le `307` de la garde, pas une image
                 (mesuré au gate visuel de la 6.4). `sourcePortrait(..., true)` porte les deux
                 faits ensemble. */
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

          <div>
            <p className={styles.ligneDate}>Position {position + 1}</p>
            <p className={styles.ligneTitre}>{prenom}</p>
            <p className={propre.role}>{role}</p>

            <span
              className={`${styles.etat} ${membre.isPublished ? styles.etatPublie : styles.etatBrouillon}`}
            >
              {membre.isPublished ? "Publié" : "Brouillon"}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.ligneActions}>
        <Link className={styles.lien} href={`/admin/membres/${membre.id}`}>
          Modifier
        </Link>
        <MembreActions
          id={membre.id}
          prenom={prenom}
          role={role}
          isPublished={membre.isPublished}
          aUnPortrait={membre.portrait !== null}
          ordre={ordre}
          position={position}
        />
      </div>
    </li>
  );
}

export default async function AdminMembresPage() {
  await exigerRolePage("admin_site");

  const membres = await getMembersForAdmin(MEMBRES_MAX);
  const ordre = membres.map((m) => m.id);
  const publies = membres.filter((m) => m.isPublished).length;

  return (
    <>
      <h1 className={styles.titre}>Membres</h1>
      <p className={styles.chapo}>
        L&rsquo;équipe présentée sur la page <strong>L&rsquo;asso</strong>. Rien
        n&rsquo;apparaît sur le site tant que ce n&rsquo;est pas publié — et le changement se
        voit au rechargement suivant.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/membres/nouveau">
          Ajouter un membre
        </Link>
        <Link className={styles.lien} href="/admin/membres/apercu">
          Voir le rendu de l&rsquo;équipe
        </Link>
      </div>

      {/* 🔴 CE QU'UN GESTE DÉCIDE AILLEURS, ÉCRIT EN TOUTES LETTRES. Personne ne devine que la
          page reste entièrement lisible sans aucun membre publié — et c'est justement l'état
          d'aujourd'hui. Sans cette phrase, une liste vide se lirait comme une page publique
          cassée. */}
      <p className={styles.mention} role="note">
        {publies === 0
          ? "Personne n'est publié pour l'instant : la page « L'asso » présente donc l'équipe COLLECTIVEMENT, avec son texte sur le bénévolat, sans aucun nom. Ce n'est pas une page cassée, c'est son état normal tant que rien n'est publié."
          : "Le texte sur le bénévolat reste affiché au-dessus des fiches : il explique comment l'association fonctionne, ce que des prénoms ne disent pas. Les fiches s'ajoutent en dessous."}
      </p>

      {/* ⚠️ FAIT À DIRE, PAS À TAIRE. Le portrait est facultatif, et son absence n'est pas une
          fiche incomplète : la carte publique garde exactement la même taille, avec une
          silhouette. Sans cette phrase, on croirait devoir trouver une photo pour tout le
          monde avant de publier. */}
      <p className={styles.mention} role="note">
        Le <strong>portrait est facultatif</strong>. Sans photo, la carte affiche une
        silhouette, à la même place et à la même taille — la page ne bouge pas quand vous en
        ajoutez une plus tard.
      </p>

      {membres.length > 0 ? (
        <ul className={styles.liste}>
          {membres.map((membre, position) => (
            <LigneMembre
              key={membre.id}
              membre={membre}
              ordre={ordre}
              position={position}
            />
          ))}
        </ul>
      ) : (
        /* ⚠️ Un état vide qui dirait « aucun membre » se lirait comme une panne. Celui-ci dit
           quoi faire — même doctrine que les états vides de la home (3.2), d'/agenda (3.3), du
           tableau de bord (6.1), de l'agenda (6.3), de la galerie (6.4), des partenaires (6.5)
           et des ateliers (6.9). */
        <p className={styles.vide}>
          Aucun membre pour l&rsquo;instant, et la page « L&rsquo;asso » fonctionne très bien
          ainsi : elle présente l&rsquo;équipe collectivement, sans nommer personne. Ajoutez
          une fiche quand vous voulez présenter quelqu&rsquo;un — demandez-lui son accord
          d&rsquo;abord, et vous pourrez voir le rendu avant de publier.
        </p>
      )}
    </>
  );
}
