import type { Metadata } from "next";
import Link from "next/link";

import { TeamGrid } from "@/components/asso/TeamGrid/TeamGrid";
import { exigerRolePage } from "@/server/auth/guard";
import { getMembersForAdmin, MEMBRES_MAX } from "@/server/db/queries/members";
import editorial from "@/styles/editorial.module.css";
import styles from "@/styles/admin-page.module.css";
import propre from "../membres.module.css";

// ══════════════════════════════════════════════════════════════════════════════════════
// PRÉVISUALISATION DE L'ÉQUIPE (Story 6.10, FR25 — 5ᵉ consommateur du mécanisme)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 C'EST LE COMPOSANT PUBLIC RÉEL, PAS UNE MAQUETTE DE L'ÉCRAN. `TeamGrid` est importé depuis
// `components/asso/`, le MÊME module que rend `/l-asso`, avec ses garde-fous : `cleanText` sur
// les champs, `overflow-wrap: anywhere`, cadre toujours rendu, retour `null` quand la liste est
// vide. Une reproduction « fidèle » écrite ici divergerait au premier changement du rendu
// public, et mentirait exactement au moment où on lui demande de dire la vérité.
//
// 🔴 IL EST MONTÉ DANS SON VOCABULAIRE RÉEL, sur `background: var(--navy)` — le fond de la page
// publique. Le contraste d'un texte dépend de son fond EFFECTIF (leçon 4.2 — « un fond effectif
// n'est pas un token ») : prévisualiser sur le fond du back-office montrerait un rendu qui
// n'existe nulle part.
//
// 🔴 CETTE ROUTE REND DES MEMBRES NON PUBLIÉS — DONC DES DONNÉES PERSONNELLES que l'association
// n'a pas choisi de rendre publiques, portraits compris. C'est une FUITE si elle est
// atteignable sans session. D'où la garde en PREMIÈRE INSTRUCTION (une garde de `layout`
// n'arrête pas le rendu de la page enfant : défaut mesuré en Story 6.1). `gate:membres` en fait
// sa garde n°1, et vérifie le HTML SERVI, pas le code de statut.
//
// ⚠️ `sourceAdmin` : les portraits passent par la route GARDÉE et sont rendus `unoptimized` —
// l'optimiseur requête sans cookie et recevrait le `307` (leçon 6.4). Sans cela, aucune
// vignette ne s'afficherait ici.
//
// ⚠️ CE QUE CET APERÇU MONTRE DE PLUS QUE LE SITE EST DIT À L'ÉCRAN, pas laissé à deviner : il
// inclut les brouillons.
// ⚠️ CE QU'IL NE MONTRE PAS EST DIT AUSSI : la prose sur le bénévolat (Story 2.6) reste sur la
// page publique et n'est pas reproduite ici. Un aperçu qui ferait croire que la grille remplace
// cette prose induirait en erreur sur ce que voit réellement le visiteur.

export const metadata: Metadata = {
  title: "Aperçu de l'équipe",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Même borne que l'écran de liste — importée, pas recopiée.

export default async function ApercuMembresPage() {
  await exigerRolePage("admin_site");

  const membres = await getMembersForAdmin(MEMBRES_MAX);
  const brouillons = membres.filter((m) => !m.isPublished).length;
  const sansPortrait = membres.filter((m) => m.portrait === null).length;

  return (
    <>
      <h1 className={styles.titre}>Aperçu de l&rsquo;équipe</h1>
      <p className={styles.chapo}>
        Le rendu réel des fiches telles qu&rsquo;elles apparaissent sur la page{" "}
        <strong>L&rsquo;asso</strong>, sur son fond réel.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/membres">
          Retour aux membres
        </Link>
      </div>

      {/* 🔴 CE QUE L'APERÇU MONTRE DE PLUS QUE LE PUBLIC, ÉCRIT EN TOUTES LETTRES. */}
      <p className={styles.mention} role="note">
        {brouillons > 0 ? (
          <>
            Cet aperçu inclut les <strong>brouillons</strong> ({brouillons} sur{" "}
            {membres.length}) : ce que vous voyez ici n&rsquo;est donc <strong>pas</strong> ce
            que voit le visiteur. Publiez une fiche depuis la liste pour qu&rsquo;elle
            apparaisse réellement.
          </>
        ) : (
          <>
            Toutes les fiches sont publiées : cet aperçu montre donc exactement ce que voit le
            visiteur.
          </>
        )}
      </p>

      {/* ⚠️ LE TROU DE L'APERÇU, DÉCLARÉ. Il montre les fiches, pas la section entière : le
          titre « Une équipe de bénévoles » et les deux paragraphes sur le bénévolat vivent sur
          /l-asso et ne sont pas reproduits ici. Ne pas déclarer ce qu'une porte ou un aperçu NE
          couvre pas, c'est laisser croire qu'il couvre tout (doctrine des exemptions
          déclarées). */}
      <p className={styles.mention} role="note">
        Seules les <strong>fiches</strong> sont prévisualisées. Sur le site, elles sont
        précédées du titre « Une équipe de bénévoles » et du texte qui explique comment
        l&rsquo;association fonctionne — ce texte reste affiché, même quand aucune fiche
        n&rsquo;est publiée.
      </p>

      {/* ⚠️ FAIT UTILE ET NON DEVINABLE : une équipe MIXTE (certains avec photo, d'autres sans)
          est le cas nominal, et c'est le seul endroit où l'on voit que la silhouette et la
          photo occupent bien la même boîte. */}
      {sansPortrait > 0 && sansPortrait < membres.length ? (
        <p className={styles.mention} role="note">
          {sansPortrait} fiche{sansPortrait > 1 ? "s" : ""} sans portrait :{" "}
          {sansPortrait > 1 ? "elles affichent" : "elle affiche"} une silhouette, dans le même
          cadre et à la même taille que les photos. La grille reste régulière.
        </p>
      ) : null}

      {/* Le fond RÉEL de la section publique. `.prose` porte la mesure de lecture (680px), donc
          le nombre de colonnes de la grille est celui du site — un aperçu pleine largeur
          montrerait une grille qui n'existe nulle part. */}
      <div className={`${editorial.band} ${propre.apercu}`}>
        <div className={editorial.prose}>
          {membres.length > 0 ? (
            <TeamGrid membres={membres} sourceAdmin />
          ) : (
            /* ⚠️ Cette phrase n'existe QUE dans l'aperçu — sur le site, une équipe vide ne rend
               rien du tout (le composant retourne `null`). La montrer ici évite de croire à un
               bug d'affichage ; l'écrire dans le composant la ferait apparaître sur la page
               publique. */
            <p className={styles.vide}>
              (Aucune fiche : sur le site, la section garde son titre et son texte sur le
              bénévolat, et n&rsquo;affiche aucune grille.)
            </p>
          )}
        </div>
      </div>
    </>
  );
}
