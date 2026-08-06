import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ReglagesForm } from "@/components/admin/ReglagesForm/ReglagesForm";
import { lireAdmin } from "@/server/auth/guard";
import { lireReglagesPourSaisie } from "@/server/db/queries/settings";
import styles from "@/styles/admin-page.module.css";

// Réglages du site (Story 6.13, FR38).
//
// 🔴 Garde en PREMIÈRE INSTRUCTION (défaut mesuré en 6.1 : une garde de `layout` n'arrête pas
// le rendu de la `page` enfant — Next rend l'arbre de segments EN PARALLÈLE).
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA SEULE SECTION SANS LISTE, ET LA SEULE SANS APERÇU
// ══════════════════════════════════════════════════════════════════════════════════════
//
// Les six autres sections ont une liste, une route `[id]`, souvent un `nouveau/` et un
// `apercu/`. Celle-ci a **une page et un formulaire**, et rien d'autre :
//   · il n'y a qu'UNE ligne (`site_setting`, `CHECK (id = 1)`), elle existe toujours, elle ne
//     se crée ni ne se supprime — une liste d'un élément est une liste qui ment sur sa nature ;
//   · il n'y a **rien à prévisualiser** : le rendu de ces valeurs est **le site lui-même**,
//     immédiatement. Un `apercu/` serait une SECONDE implémentation du header et du footer,
//     donc une divergence garantie.
// ⚠️ C'est aussi pourquoi la description de cette section, dans `app/admin/_sections.ts`, ne
// finit PAS par « Voir le rendu avant de publier » : promettre une porte sans pièce est le
// défaut exact que ce registre existe pour empêcher, et il s'est produit DEUX fois.

export const metadata: Metadata = {
  title: "Réglages",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ReglagesPage() {
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  // 🔴 `lireReglagesPourSaisie` ET NON `lireReglages` : cet écran a besoin des `null` bruts,
  // pour que le champ soit VIDE et non rempli d'une chaîne vide déguisée. Le lecteur du rendu,
  // lui, convertit `null` en `DESTINATION_ABSENTE` — deux besoins, deux lecteurs.
  const reglages = await lireReglagesPourSaisie();

  return (
    <>
      <h1 className={styles.titre}>Réglages du site</h1>
      <p className={styles.chapo}>
        Les adresses de vos comptes et l&rsquo;e-mail de contact. Elles alimentent le pied de
        page, le menu et les boutons « Nous rejoindre » de{" "}
        <strong>toutes les pages du site</strong>.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin">
          Retour au tableau de bord
        </Link>
      </div>

      <div className={styles.section}>
        {reglages === null ? (
          /* ⚠️ ÉTAT ANORMAL, PAS UN ÉTAT VIDE — et la distinction compte. Les six autres
             sections ont un état vide CHALEUREUX parce que « aucune photo » est un état
             légitime. Ici, « aucune ligne » ne l'est pas : la migration `0012` en insère une et
             `site_setting_ligne_unique` interdit d'en avoir deux. Ce message décrit donc une
             base à moitié restaurée ou une migration non jouée, et il dit quoi faire.
             ⚠️ Le site public, lui, ne casse pas : `lireReglages()` retombe sur son repli
             (5 destinations absentes + l'e-mail réel) plutôt que de rendre les 5 pages en
             erreur. Le cas est déclaré, mesuré par la garde ⑤ de `gate:reglages`, et tracé
             côté serveur. */
          <p className={styles.vide}>
            La ligne de réglages est <strong>introuvable en base</strong>. Ce n&rsquo;est pas un
            réglage « vide » : cette table doit contenir exactement une ligne, créée par la
            migration <code>0012</code>. Le site public continue de fonctionner avec ses valeurs
            de repli (aucun lien de réseau social, e-mail de contact par défaut), mais rien ne
            peut être modifié depuis cet écran. Prévenez la personne qui s&rsquo;occupe du site.
          </p>
        ) : (
          <ReglagesForm reglages={reglages} />
        )}
      </div>
    </>
  );
}
