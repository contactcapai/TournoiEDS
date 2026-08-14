import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { FicheTournoi } from "@/components/tournois/FicheTournoi/FicheTournoi";
import { lireAdmin } from "@/server/auth/guard";
import { getTournamentApercuById } from "@/server/db/queries/tournaments";
import admin from "@/styles/admin-page.module.css";
import styles from "./page.module.css";

// ══════════════════════════════════════════════════════════════════════════════════════
// PRÉVISUALISATION DE LA FICHE PUBLIQUE (Story 9.3, FR25)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 CETTE ROUTE ÉTAIT **DUE ET NOMMÉMENT ROUTÉE ICI** — et elle ne l'était nulle part
// ailleurs que dans le code. `app/admin/_sections.ts` l'écrit depuis la Story 9.2 : *« La
// phrase reste due — mais pas encore payable […] Ce qui n'existe toujours pas, c'est ce que la
// phrase promet précisément : une route `apercu/` permettant de voir le rendu AVANT de publier
// […] ⇒ La route `apercu/` et la phrase arrivent toujours avec la Story 9.3. »*
// ⇒ Elle arrive, et la description de la 8ᵉ section gagne « Voir le rendu avant de publier. »
// dans le MÊME commit. Poser la phrase sans la route serait « une porte sans pièce », le
// défaut que ce fichier-là existe pour empêcher et qui s'est déjà produit DEUX fois.
//
// 🔴 C'EST LE COMPOSANT PUBLIC RÉEL, PAS UNE REPRODUCTION. `FicheTournoi` est le MÊME module
// que rend `/tournois/<slug>`, avec ses garde-fous : lignes masquées quand un fait manque,
// `cleanText`, podium réservé au passé, visuel décidé, événement non publié tu. Une
// reproduction « fidèle » écrite ici divergerait au premier changement du rendu public, et
// mentirait exactement au moment où on lui demande de dire la vérité (doctrine 6.3).
//
// 🔴 CETTE ROUTE REND DES LIGNES NON PUBLIÉES — c'est une FUITE DE DONNÉES si elle est
// atteignable sans session. D'où la garde en PREMIÈRE INSTRUCTION : une garde de `layout`
// n'arrête PAS le rendu de la page enfant (défaut mesuré en Story 6.1 — la charge RSC portait
// le tableau de bord entier dans le corps d'une redirection 307).

export const metadata: Metadata = {
  title: "Aperçu",
  // `noindex, nofollow` : cette route sert des brouillons. Même valeur que l'aperçu d'agenda.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ApercuTournoiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await lireAdmin();
  if (session === null) redirect("/admin/login");

  const { id } = await params;
  // Format validé AVANT la base : un identifiant malformé doit rendre 404, pas 500 (un `uuid`
  // invalide fait lever Postgres). L'existence, elle, est le `notFound()` qui suit.
  if (!z.uuid().safeParse(id).success) notFound();

  const tournoi = await getTournamentApercuById(id);
  if (!tournoi) notFound();

  return (
    <>
      <h1 className={admin.titre}>Aperçu</h1>
      <p className={admin.chapo}>
        Voici le tournoi tel qu&rsquo;il apparaîtra sur le site.{" "}
        {tournoi.isPublished
          ? "Il est déjà publié."
          : "Il n'est pas publié : personne d'autre que vous ne le voit."}
      </p>

      <div className={admin.barreActions}>
        <Link className={admin.lien} href={`/admin/tournois/${tournoi.id}`}>
          Modifier
        </Link>
        <Link className={admin.lien} href="/admin/tournois">
          Retour à la liste
        </Link>
      </div>

      {/* ⚠️ CE QUE L'APERÇU NE MONTRE PAS, ET POURQUOI IL LE DIT. Deux faits peuvent
          surprendre un bénévole qui compare son formulaire à cet écran, et les taire coûte un
          ticket là où les dire coûte une phrase :
            · un VISUEL choisi puis DÉPUBLIÉ depuis la galerie n'apparaît pas — la route
              `/medias/[filename]` ne sert que les photos publiées (garde 6.4), donc c'est bien
              le rendu réel ;
            · un ÉVÉNEMENT de rattachement non publié n'est pas nommé — le public ne doit pas
              lire le titre d'un brouillon d'agenda. */}
      <p className={admin.mention} role="note">
        Deux choses n&rsquo;apparaissent pas ici, <strong>pas plus que sur le site</strong>
        &nbsp;: un visuel dont la photo a été dépubliée, et un événement de rattachement encore
        en brouillon.
      </p>

      {/* 🔴 LE PLATEAU NE POSE **AUCUN FOND**, contrairement à celui de l'aperçu d'agenda —
          et c'est la même raison qui commande les deux. Là-bas, on prévisualise une CARTE, qui
          n'existe que posée sur le fond `--navy` de sa section : le plateau devait donc le
          reproduire, sans quoi le contraste montré n'aurait existé nulle part (leçon 4.2 — un
          fond effectif n'est pas un token). Ici, on prévisualise une PAGE ENTIÈRE, qui pose
          elle-même ses deux fonds (`--navy-deep` par défaut, `--navy` sur la section
          « S'inscrire »). Lui en imposer un troisième montrerait un rendu qui n'existe pas.
          ⚠️ Le plateau ne fait donc que MARQUER LA FRONTIÈRE entre l'écran d'admin et le rendu
          public : filet pointillé, et rien d'autre. */}
      <div className={styles.plateau}>
        {/* `headingLevel={2}` : cet écran porte déjà son `<h1>Aperçu</h1>`. Sans ça, la page
            aurait DEUX `<h1>` — un vrai défaut d'accessibilité, et pas une subtilité de
            validateur. Les sections de la fiche descendent avec lui (voir le composant). */}
        <FicheTournoi tournoi={tournoi} headingLevel={2} />
      </div>
    </>
  );
}
