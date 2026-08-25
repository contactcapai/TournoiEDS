import type { Metadata } from "next";
import Link from "next/link";

import { EventActions } from "@/components/admin/EventActions/EventActions";
import { formatLongDate, formatTime } from "@/lib/date-paris";
import { cleanText } from "@/lib/text";
import { exigerRolePage } from "@/server/auth/guard";
import {
  getPastEventsForAdmin,
  getUpcomingEventsForAdmin,
  type AgendaEvent,
} from "@/server/db/queries/events";
import styles from "@/styles/admin-page.module.css";

// Liste de l'agenda du back-office (Story 6.3) — Server Component pur.
//
// 🔴 CETTE PAGE PORTE SA PROPRE GARDE, ET CE N'EST PAS UNE REDONDANCE — DÉFAUT MESURÉ EN
// STORY 6.1. Une garde placée dans un `layout` N'EMPÊCHE PAS la `page` enfant de
// s'exécuter : Next rend l'arbre de segments EN PARALLÈLE, et le `redirect()` du layout
// n'arrête pas un rendu déjà commencé ailleurs. La réponse était bien un `307`, et son
// corps portait le tableau de bord ENTIER dans la charge RSC.
//
// ⚠️ Ici l'enjeu monte d'un cran par rapport à la 6.1 : cette page rend des événements NON
// PUBLIÉS. Une fuite n'exposerait pas un écran vide, mais de la donnée éditoriale que
// personne n'a décidé de rendre publique.

export const metadata: Metadata = {
  title: "Agenda",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Bornes EXPLICITES, jamais de lecture non bornée — même doctrine que `/agenda` public :
 * une page dont le temps de rendu dépend du volume saisi est un défaut qui n'apparaîtrait
 * qu'une fois la base remplie par les bénévoles, c'est-à-dire en production.
 * Le back-office voit PLUS de passés que le public (qui n'en montre que 4, borne du
 * carrousel) : c'est ici qu'on vient écrire un compte-rendu après coup.
 */
const A_VENIR_MAX = 100;
const PASSES_MAX = 50;

function lieuDe(evenement: AgendaEvent): string | null {
  if (evenement.bar) {
    return `${evenement.bar.name} — ${evenement.bar.district}, ${evenement.bar.city}`;
  }
  return cleanText(evenement.venueName) ?? cleanText(evenement.venueAddress);
}

function LigneEvenement({ evenement }: { evenement: AgendaEvent }) {
  const lieu = lieuDe(evenement);

  return (
    <li className={styles.ligne}>
      <div className={styles.ligneCorps}>
        <p className={styles.ligneDate}>
          {formatLongDate(evenement.startsAt)} · {formatTime(evenement.startsAt)} ·{" "}
          {evenement.type === "special" ? "Temps fort" : "Hebdo"}
        </p>
        <p className={styles.ligneTitre}>{evenement.title}</p>
        {/* Le lieu disparaît plutôt que de s'afficher vide — même règle que le rendu
            public (NFR8). En pratique il ne peut pas manquer (`event_has_venue`), mais une
            ligne écrite avant cette contrainte le pourrait. */}
        {lieu ? <p className={styles.ligneLieu}>{lieu}</p> : null}
        <span
          className={`${styles.etat} ${evenement.isPublished ? styles.etatPublie : styles.etatBrouillon}`}
        >
          {evenement.isPublished ? "Publié" : "Brouillon"}
        </span>
      </div>

      <div className={styles.ligneActions}>
        <Link className={styles.lien} href={`/admin/agenda/${evenement.id}`}>
          Modifier
        </Link>
        <Link className={styles.lien} href={`/admin/agenda/${evenement.id}/apercu`}>
          Aperçu
        </Link>
        <EventActions
          id={evenement.id}
          isPublished={evenement.isPublished}
          titre={evenement.title}
          socialPostedAt={evenement.socialPostedAt}
        />
      </div>
    </li>
  );
}

export default async function AdminAgendaPage() {
  await exigerRolePage("admin_site");

  const [aVenir, passes] = await Promise.all([
    getUpcomingEventsForAdmin(A_VENIR_MAX),
    getPastEventsForAdmin(PASSES_MAX),
  ]);

  return (
    <>
      <h1 className={styles.titre}>Agenda</h1>
      <p className={styles.chapo}>
        Les jeudis, les temps forts et les bars du roulement. Rien n&rsquo;apparaît sur le site
        tant que ce n&rsquo;est pas publié — et le changement se voit au rechargement suivant.
      </p>
      {/* ══════════════════════════════════════════════════════════════════════════════════
          🔴 CETTE PHRASE EST LA CONTREPARTIE D'UN ARBITRAGE, PAS UNE AIDE DÉCORATIVE — A7
          ══════════════════════════════════════════════════════════════════════════════════

          Depuis la Story 9.5, un tournoi peut exister **sans événement** : il paraît alors
          lui-même sur l'agenda public et sur l'accueil. Cet écran-ci, lui, ne liste **que des
          événements**, et c'est un choix mesuré :
            · la paire `getUpcomingEventsForAdmin` / `getPastEventsForAdmin` a **trois
              appelants chacun**, dont DEUX qui ne sont pas des agendas — les sélecteurs
              « à quelle occasion ? » de `/admin/galerie/nouveau` et `/admin/galerie/[id]`. Y
              faire entrer des tournois écrirait un `tournament.id` dans `photo.event_id`, que
              la clé étrangère refuserait ;
            · le back-office a **déjà** sa section Tournois (8ᵉ, Story 9.1). Fusionner ouvrirait
              deux chemins d'édition pour un même objet, dont un « Modifier » qui ouvrirait le
              formulaire d'ÉVÉNEMENT.
          ⚠️ Sans cette phrase, un bénévole qui vient de créer un tournoi sans événement le
          chercherait ICI et le croirait perdu. L'arbitrage coûte une phrase ; le taire coûte
          un ticket — même raisonnement que la mention de l'écran d'aperçu. */}
      <p className={styles.chapo}>
        Les <strong>tournois</strong> ne sont pas listés ici, même ceux qui paraissent à
        l&rsquo;agenda&nbsp;: ils vivent dans leur propre section.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/agenda/nouveau">
          Créer un événement
        </Link>
        <Link className={styles.lien} href="/admin/agenda/bars">
          Les bars du roulement
        </Link>
        <Link className={styles.lien} href="/admin/tournois">
          Les tournois
        </Link>
      </div>

      <section className={styles.section} aria-labelledby="admin-a-venir">
        <h2 className={styles.sectionTitre} id="admin-a-venir">
          À venir
        </h2>
        {aVenir.length > 0 ? (
          <ul className={styles.liste}>
            {aVenir.map((evenement) => (
              <LigneEvenement key={evenement.id} evenement={evenement} />
            ))}
          </ul>
        ) : (
          /* ⚠️ Un état vide qui dirait « aucun événement » se lirait comme une panne. Celui-ci
             dit quoi faire — même doctrine que les états vides de la home (3.2), d'/agenda
             (3.3) et du tableau de bord (6.1). */
          <p className={styles.vide}>
            Aucune date à venir pour l&rsquo;instant. « Créer un événement » ouvre le
            formulaire — vous pourrez voir le rendu avant de publier.
          </p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="admin-passes">
        <h2 className={styles.sectionTitre} id="admin-passes">
          Déjà passé
        </h2>
        {passes.length > 0 ? (
          <ul className={styles.liste}>
            {passes.map((evenement) => (
              <LigneEvenement key={evenement.id} evenement={evenement} />
            ))}
          </ul>
        ) : (
          <p className={styles.vide}>
            Rien de passé pour le moment. C&rsquo;est ici que vous viendrez écrire les
            compte-rendus, une fois les soirées faites.
          </p>
        )}
      </section>
    </>
  );
}
