import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { FicheTournoi } from "@/components/tournois/FicheTournoi/FicheTournoi";
import { exigerRolePage } from "@/server/auth/guard";
import { jourParis } from "@/lib/date-paris";
import { classementPubliable } from "@/lib/tournoi/classement";
import { finalePubliable } from "@/lib/tournoi/finale";
import { etatDuJour } from "@/lib/tournoi/en-cours";
import { getEtatInscription } from "@/server/db/queries/inscription";
import { getPhasesForTournament } from "@/server/db/queries/phases";
import {
  getClassement,
  getFinale,
  getRencontresPubliques,
} from "@/server/db/queries/rencontres";
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
  await exigerRolePage("admin_tournoi");

  const { id } = await params;
  // Format validé AVANT la base : un identifiant malformé doit rendre 404, pas 500 (un `uuid`
  // invalide fait lever Postgres). L'existence, elle, est le `notFound()` qui suit.
  if (!z.uuid().safeParse(id).success) notFound();

  const tournoi = await getTournamentApercuById(id);
  if (!tournoi) notFound();

  // 🔴 LA LECTURE D'ADMIN, PAS LA PUBLIQUE — ET C'EST TOUT LE SENS DE CET ÉCRAN. `getDeroulePublic`
  // filtre `is_published` : sur un tournoi en BROUILLON, elle ne rendrait rien, et l'aperçu
  // montrerait une fiche sans déroulé au moment précis où le bénévole vérifie son déroulé
  // avant de publier. Les deux lectures rendent un sur-ensemble du même type structurel, donc
  // aucune conversion à écrire. ⚠️ Ce n'est pas une garde relâchée : la page est derrière
  // `exigerRolePage("admin_tournoi")`, en première instruction.
  const phases = await getPhasesForTournament(tournoi.id);

  // 🔴 MÊME RAISON POUR LE CLASSEMENT (14.2) : `getClassementPublic` filtre `is_published`,
  // donc sur un BROUILLON elle ne rendrait rien — l'aperçu montrerait une fiche sans
  // classement au moment précis où le bénévole vérifie ce que le public verra.
  // ⚠️ EN REVANCHE `classementPubliable` S'APPLIQUE ICI AUSSI, et c'est tout l'intérêt : sans
  // lui, l'aperçu nommerait les engagés à 0 point que le site, lui, ne nommera pas — un aperçu
  // qui montre autre chose que le rendu ment au moment où on lui demande la vérité (6.3).
  const classement = classementPubliable(
    await getClassement(tournoi.id, { espace: "qualification" }),
  );

  // 🔴 SANS `exigerPublie`, POUR LA MÊME RAISON QUE LES PHASES : sur un BROUILLON, la lecture
  // publique ne rendrait rien et l'aperçu montrerait une fiche sans finale au moment précis où
  // le bénévole la vérifie. ⚠️ `finalePubliable`, lui, S'APPLIQUE — c'est ce qui fait que
  // l'aperçu montre le rendu réel et pas un sur-ensemble.
  const finaleLue = await getFinale(tournoi.id);
  const finale = finaleLue ? finalePubliable(finaleLue) : null;

  // ⚠️ `exigerPublie: false` POUR LA MÊME RAISON QUE LES PHASES ET LA FINALE : sur un BROUILLON,
  // la garde publique ne rendrait rien et l'aperçu serait vide au moment précis où le bénévole
  // vérifie ce que le public verra. La règle de NOMMAGE, elle, s'applique — elle est dans la
  // lecture, pas dans la garde.
  const rencontres = await getRencontresPubliques(tournoi.id, false);

  // 🔴 L'HORLOGE SE LIT ICI, UNE FOIS — jamais pendant le rendu (`react-hooks/purity`), et
  // désormais dans une CONSTANTE : depuis la 14.3 elle a deux consommateurs (l'état du jour et
  // la journée qui s'ouvre d'emblée). Deux `new Date()` répondraient la même chose 364 jours
  // sur 365, et se contrediraient la nuit du changement de jour — au pire endroit possible.
  const aujourdHui = jourParis(new Date());

  /**
   * 🔴 L'APERÇU REGARDE L'INSCRIPTION **EN ANONYME** (Story 12.3), et c'est un choix, pas un
   * raccourci. Le bénévole vérifie *« ce que le public verra »* : un visiteur qui n'a pas de
   * compte, donc le bouton qui mène à la connexion. Lui passer SON compte lui montrerait un
   * formulaire qu'il pourrait soumettre — et l'action refuserait, le tournoi étant en brouillon,
   * avec un message qui parlerait d'un tournoi inexistant. Un aperçu ne doit rien pouvoir écrire.
   * ⚠️ **LE DÉCOMPTE, LUI, EST RÉEL** : il vient de la base, comme le classement et les phases.
   * Passer un zéro de complaisance ferait afficher « il reste 24 places » sur un tournoi plein,
   * dans l'écran dont le métier est de dire la vérité sur le rendu (doctrine 6.3).
   * ⚠️ Le lien « Je m'inscris » y pointe vers `/tournois/<slug>`, inatteignable tant que le
   * tournoi est en brouillon — c'est le rendu public exact, et on ne le clique pas depuis ici.
   */
  const inscription = { ...(await getEtatInscription(tournoi.id, null)), connecte: false };

  const suivi = {
    etat: etatDuJour(phases, jourParis(tournoi.startsAt), aujourdHui),
    phases,
    classement,
    finale,
    rencontres,
    aujourdHui,
  };

  return (
    <>
      {/* 🔴 CET ÉCRAN N'A PAS DE TITRE PROPRE, ET C'EST DÉLIBÉRÉ (10.9). Le `<h1>` est le nom
          du tournoi (layout de l'espace) et la fiche rendue porte le sien en `<h2>` — lui en
          ajouter un troisième forcerait `FicheTournoi` au niveau 3, donc élargirait le type
          d'un composant PUBLIC pour un besoin d'aperçu. Le menu dit déjà où l'on est. */}
      <p className={admin.chapo}>
        Voici le tournoi tel qu&rsquo;il apparaîtra sur le site.{" "}
        {tournoi.isPublished
          ? "Il est déjà publié."
          : "Il n'est pas publié : personne d'autre que vous ne le voit."}
      </p>

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
        <FicheTournoi
          tournoi={tournoi}
          headingLevel={2}
          suivi={suivi}
          inscription={inscription}
        />
      </div>
    </>
  );
}
