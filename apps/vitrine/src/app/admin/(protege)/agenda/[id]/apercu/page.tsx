import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { EventList, EventRow } from "@/components/agenda/EventList/EventList";
import { NextEventCard } from "@/components/agenda/NextEventCard/NextEventCard";
import { PastCarousel } from "@/components/agenda/PastCarousel/PastCarousel";
import { PastEvent } from "@/components/agenda/PastEvent/PastEvent";
import { lireAdmin } from "@/server/auth/guard";
import { getEventById } from "@/server/db/queries/events";
import { getPhotosForEvents } from "@/server/db/queries/photos";
import type { RendezVous } from "@/server/db/queries/rendez-vous";
import { getTournoisParEvenement } from "@/server/db/queries/tournaments";
import agenda from "@/styles/admin-page.module.css";
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
// ✅ LE RENDU « DÉJÀ PASSÉ » EST PRÉVISUALISÉ DEPUIS LA STORY 6.4 — DETTE **R34 SOLDÉE**.
// La 6.3 s'en était tenue à une borne écrite à l'écran, au motif qu'extraire `PastEvent`
// toucherait une classe lue par `gate:carousel`. Le motif a été RE-MESURÉ et il était
// franchissable : la porte sélectionne `li[class*="__vignette"]`, une sous-chaîne du nom
// COMPILÉ, et le `<li>` extrait continue de porter `carousel.vignette` (voir
// `components/agenda/PastEvent/PastEvent.tsx`).
// 🔴 LE PARAGRAPHE DE BORNE ET L'EXEMPTION DE `gate:agenda` SONT PARTIS DANS LE MÊME COMMIT
// QUE LE CORRECTIF — leçon littérale de R33 ② : une borne annoncée qui n'existe plus est un
// mensonge exactement aussi coûteux qu'une borne tue.
//
// ⚠️ CE QUE LA VIGNETTE MONTRE, ET CE QU'ELLE NE MONTRE PAS : la PREMIÈRE PHOTO PUBLIÉE de
// l'événement (`getPhotosForEvents` filtre sur `is_published`). Un brouillon n'y apparaît
// donc pas — exactement comme sur le site public. Ce n'est pas une borne de l'aperçu, c'est
// le rendu réel ; l'écran le dit quand même, pour qu'un bénévole qui vient de téléverser ne
// croie pas à une panne.
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

  // Une seule lecture, et seulement pour un événement passé : la vignette « Déjà passé » est
  // le seul rendu qui consomme une photo. `getPhotosForEvents` rend une `Map` vide quand
  // l'événement n'a aucune photo publiée — l'appelant retombe alors sur le placeholder.
  const photos = evenement.estPasse ? await getPhotosForEvents([evenement.id]) : null;

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * 🔴 L'APERÇU EST LA **TROISIÈME** SURFACE DES COMPOSANTS D'AGENDA — LE CADRAGE 9.5 EN
   * ANNONÇAIT DEUX, LE TYPECHECK EN A TROUVÉ TROIS
   * ══════════════════════════════════════════════════════════════════════════════════════
   *
   * `NextEventCard` et `EventRow` prennent un `RendezVous` depuis la 9.5. Cet écran leur
   * passait un `AgendaEvent` — et c'est **le typecheck qui l'a dit**, exactement le mode de
   * défaillance qu'on voulait (bruyant, pas silencieux).
   *
   * 🔴 ON LIT LES VRAIS TOURNOIS, ON N'ÉCRIT PAS `tournois: []`. La branche est vide dans le
   * cas courant, et il aurait été tentant de la coder en dur : l'aperçu ne passe aucun `cta`,
   * donc rien ne la consomme **aujourd'hui**. Ce serait affirmer « cet événement ne porte
   * aucun tournoi » sans l'avoir regardé — c'est-à-dire la mécanique même de la dette **R48**,
   * réintroduite dans l'écran dont le métier est de **dire la vérité** sur le rendu public.
   * ⚠️ `getTournoisParEvenement` filtre sur `is_published`, et c'est le bon filtre ici : cet
   * écran montre ce que le **public** verra, pas ce que le back-office contient.
   */
  const tournoisParEvenement = await getTournoisParEvenement([evenement.id]);
  const rendezVous: RendezVous = {
    nature: "evenement",
    cle: evenement.id,
    startsAt: evenement.startsAt,
    libelle: evenement.title,
    evenement,
    tournois: tournoisParEvenement.get(evenement.id) ?? [],
  };

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

      {evenement.estPasse && photos ? (
        <section className={styles.scene} aria-labelledby="apercu-passe">
          <h2 className={styles.sceneTitre} id="apercu-passe">
            Dans le carrousel « Déjà passé »
          </h2>
          {/* ⚠️ CE QUI EST DIT, ET POURQUOI. La vignette montre la première photo PUBLIÉE :
              un bénévole qui vient de téléverser des brouillons pour cet événement verrait
              sinon un placeholder et conclurait à une panne. Dire ce que l'écran ne montre
              pas coûte une phrase ; le taire coûte un ticket. */}
          <p className={agenda.mention} role="note">
            La photo affichée est la <strong>première photo publiée</strong> de cet
            événement. Un brouillon n&rsquo;y apparaît pas — pas plus que sur le site : le
            cadre « photo à venir » est alors le rendu réel.
          </p>
          <div className={styles.plateau}>
            {/* Le carrousel RÉEL, avec une seule vignette : c'est ce que fait `/agenda`
                quand un seul passé existe, donc c'est le rendu honnête. Reproduire la
                vignette hors de sa piste montrerait une largeur qui n'existe nulle part —
                `carousel.vignette` porte justement la largeur et l'accrochage. */}
            <PastCarousel label="Aperçu de la vignette « Déjà passé »">
              <PastEvent event={evenement} photo={photos.get(evenement.id)} />
            </PastCarousel>
          </div>
        </section>
      ) : null}

      <section className={styles.scene} aria-labelledby="apercu-carte">
        <h2 className={styles.sceneTitre} id="apercu-carte">
          Sur la carte du prochain rendez-vous
        </h2>
        {/* ⚠️ Pour un événement PASSÉ, cette scène et la suivante ne sont plus ce que le
            public voit : elles montrent le rendu qu'il avait quand il était à venir. Le
            dire évite qu'on les prenne pour l'état courant du site. */}
        {evenement.estPasse ? (
          <p className={agenda.mention} role="note">
            Cet événement est passé : cette scène et la suivante montrent le rendu
            qu&rsquo;il <strong>avait quand il était à venir</strong>. Ce que le public voit
            aujourd&rsquo;hui, c&rsquo;est la vignette ci-dessus.
          </p>
        ) : null}
        <div className={styles.plateau}>
          {/* Pas de `cta` : sur `/agenda` la carte n'en porte aucun (elle EST la
              destination). Reproduire ici un CTA que le public ne voit pas ferait mentir
              l'aperçu. */}
          <NextEventCard rendezVous={rendezVous} />
        </div>
      </section>

      <section className={styles.scene} aria-labelledby="apercu-ligne">
        <h2 className={styles.sceneTitre} id="apercu-ligne">
          Dans la liste de l&rsquo;agenda
        </h2>
        <div className={styles.plateau}>
          <EventList>
            <EventRow rendezVous={rendezVous} variant="detailed" />
          </EventList>
        </div>
      </section>
    </>
  );
}
