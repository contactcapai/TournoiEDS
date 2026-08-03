import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { EventList, EventRow } from "@/components/agenda/EventList/EventList";
import { NextEventCard } from "@/components/agenda/NextEventCard/NextEventCard";
import { lireAdmin } from "@/server/auth/guard";
import { getEventById } from "@/server/db/queries/events";
import agenda from "../../agenda.module.css";
import styles from "./page.module.css";

// ══════════════════════════════════════════════════════════════════════════════════════
// PRÉVISUALISATION DU RENDU PUBLIC (Story 6.3, FR25 — ex-Story 6.6, absorbée)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 CE SONT LES COMPOSANTS PUBLICS RÉELS, PAS UNE MAQUETTE DU FORMULAIRE. `NextEventCard`
// et `EventRow` sont importés depuis `components/agenda/` — les MÊMES modules que rendent
// `/` (Story 3.2) et `/agenda` (Story 3.3), avec leurs garde-fous : lignes masquées quand
// un fait manque, `cleanText`, troncatures. Une reproduction « fidèle » écrite ici
// divergerait au premier changement du rendu public, et mentirait exactement au moment où
// on lui demande de dire la vérité.
//
// 🔴 CETTE ROUTE REND DES LIGNES NON PUBLIÉES — c'est une FUITE DE DONNÉES si elle est
// atteignable sans session. D'où la garde en PREMIÈRE INSTRUCTION (une garde de `layout`
// n'arrête pas le rendu de la page enfant : défaut mesuré en Story 6.1, la charge RSC
// portait le tableau de bord entier dans le corps d'une redirection 307). `gate:agenda`
// en fait sa garde n°1, et vérifie le HTML SERVI, pas le code de statut.
//
// 🔴 BORNE DÉCLARÉE — LE RENDU « DÉJÀ PASSÉ » N'EST PAS PRÉVISUALISÉ (dette R34 → Story
// 6.4). `PastEvent` n'est pas un composant extrait : il vit dans le fichier de page de
// `/agenda` et consomme `carousel.vignette`, une classe LUE par `gate:carousel`. L'extraire
// ici remettrait le rendu d'une story MERGÉE sous porte à l'intérieur d'une story au risque
// différent (précédent 2.7 → 2.10, raison ② de R27). Le trou est écrit À L'ÉCRAN ci-dessous
// et déclaré en sortie de `gate:agenda` — une borne tue serait un cul-de-sac.
//
// ⚠️ Le fond de la scène est `--navy`, celui de la section « À venir » de `/agenda`
// (`page.module.css` l.22-25). Ce n'est pas décoratif : le contraste des textes dépend du
// fond effectif, et prévisualiser sur un autre fond montrerait un rendu qui n'existe pas.

export const metadata: Metadata = {
  title: "Aperçu",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ApercuEvenementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  const { id } = await params;
  // Format validé AVANT la base : un identifiant malformé doit rendre 404, pas 500.
  if (!z.uuid().safeParse(id).success) notFound();

  const evenement = await getEventById(id);
  if (!evenement) notFound();

  return (
    <>
      <h1 className={agenda.titre}>Aperçu</h1>
      <p className={agenda.chapo}>
        Voici l&rsquo;événement tel qu&rsquo;il apparaîtra sur le site.{" "}
        {evenement.isPublished
          ? "Il est déjà publié."
          : "Il n'est pas publié : personne d'autre que vous ne le voit."}
      </p>

      <div className={agenda.barreActions}>
        <Link className={agenda.lien} href={`/admin/agenda/${evenement.id}`}>
          Modifier
        </Link>
        <Link className={agenda.lien} href="/admin/agenda">
          Retour à la liste
        </Link>
      </div>

      {evenement.estPasse ? (
        /* 🔴 LA BORNE EST DITE, PAS TUE. Un aperçu muet sur ce qu'il ne montre pas se
           ferait lire comme exhaustif — c'est le corollaire de `pieges/garde-nominale.md`
           appliqué à un écran plutôt qu'à une porte. */
        <p className={styles.borne} role="note">
          Cet événement est passé. Sa vignette du carrousel « Déjà passé », avec sa photo et
          son compte-rendu, n&rsquo;est <strong>pas encore prévisualisable</strong> — elle
          arrivera avec la gestion de la galerie. Ce que vous voyez ci-dessous est le rendu
          qu&rsquo;il avait quand il était à venir.
        </p>
      ) : null}

      <section className={styles.scene} aria-labelledby="apercu-carte">
        <h2 className={styles.sceneTitre} id="apercu-carte">
          Sur la carte du prochain rendez-vous
        </h2>
        <div className={styles.plateau}>
          {/* Pas de `cta` : sur `/agenda` la carte n'en porte aucun (elle EST la
              destination). Reproduire ici un CTA que le public ne voit pas ferait mentir
              l'aperçu. */}
          <NextEventCard event={evenement} />
        </div>
      </section>

      <section className={styles.scene} aria-labelledby="apercu-ligne">
        <h2 className={styles.sceneTitre} id="apercu-ligne">
          Dans la liste de l&rsquo;agenda
        </h2>
        <div className={styles.plateau}>
          <EventList>
            <EventRow event={evenement} variant="detailed" />
          </EventList>
        </div>
      </section>
    </>
  );
}
