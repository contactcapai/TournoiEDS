import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { TournoiActions } from "@/components/admin/TournoiActions/TournoiActions";
import { formatLongDate, formatTime } from "@/lib/date-paris";
import {
  LIBELLES_ETAT_INSCRIPTION,
  LIBELLES_MODE_INSCRIPTION,
} from "@/lib/libelles-tournoi";
import { cleanText } from "@/lib/text";
import { lireAdmin } from "@/server/auth/guard";
import {
  getPastTournamentsForAdmin,
  getUpcomingTournamentsForAdmin,
  type AdminTournament,
} from "@/server/db/queries/tournaments";
import styles from "@/styles/admin-page.module.css";
import propre from "./tournois.module.css";

// Liste des tournois du back-office (Story 9.1, A21/A22) — Server Component pur.
//
// 🔴 CETTE PAGE PORTE SA PROPRE GARDE, ET CE N'EST PAS UNE REDONDANCE — DÉFAUT MESURÉ EN
// STORY 6.1. Une garde placée dans un `layout` N'EMPÊCHE PAS la `page` enfant de s'exécuter :
// Next rend l'arbre de segments EN PARALLÈLE, et le `redirect()` du layout n'arrête pas un
// rendu déjà commencé ailleurs.
//
// ⚠️ Cette page rend des lignes NON PUBLIÉES.

export const metadata: Metadata = {
  title: "Tournois",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Borne EXPLICITE, jamais de lecture non bornée : une page dont le temps de rendu dépend du
 * nombre d'entrées est un défaut qui n'apparaîtrait qu'une fois la base remplie — c'est-à-dire
 * en production, chez quelqu'un d'autre. 200 est très au-delà du rythme d'une association
 * (la Game'in Reims, le plus gros événement de l'année, en porte **dix**) tout en restant
 * borné. « Généreux » n'est pas « non borné ».
 */
const TOURNOIS_MAX = 200;

function LigneTournoi({ tournoi }: { tournoi: AdminTournament }) {
  // `cleanText` : filet du rendu contre une écriture qui contournerait Zod et les `CHECK`
  // (`UPDATE` direct, restauration). Jamais un fragment vide à l'écran.
  const salle = cleanText(tournoi.venueName);
  const podium = cleanText(tournoi.podiumFirst);

  return (
    <li className={styles.ligne}>
      <div className={styles.ligneCorps}>
        <p className={styles.ligneDate}>
          {formatLongDate(tournoi.startsAt)} · {formatTime(tournoi.startsAt)}
        </p>
        <p className={styles.ligneTitre}>{tournoi.name}</p>
        <p className={styles.ligneLieu}>
          {tournoi.game}
          {salle ? ` — ${salle}` : null}
        </p>

        {/* ⚠️ L'ÉVÉNEMENT DE RATTACHEMENT EST AFFICHÉ, PAS SUPPOSÉ. Il est OBLIGATOIRE (A4)
            et un tournoi rattaché au mauvais événement est invisible autrement : les deux
            dates peuvent différer légitimement (la GIR est UN événement sur deux jours qui
            porte DIX animations à des heures différentes). */}
        <p className={propre.rattachement}>
          Rattaché à l&rsquo;événement <strong>{tournoi.event.title}</strong>
        </p>

        <p className={propre.inscriptions}>
          Inscriptions : {LIBELLES_MODE_INSCRIPTION[tournoi.registrationMode]} —{" "}
          {LIBELLES_ETAT_INSCRIPTION[tournoi.registrationState].toLowerCase()}
        </p>

        {podium ? <p className={propre.podium}>🏆 {podium}</p> : null}

        <span
          className={`${styles.etat} ${tournoi.isPublished ? styles.etatPublie : styles.etatBrouillon}`}
        >
          {tournoi.isPublished ? "Publié" : "Brouillon"}
        </span>
      </div>

      <div className={styles.ligneActions}>
        <Link className={styles.lien} href={`/admin/tournois/${tournoi.id}`}>
          Modifier
        </Link>
        <TournoiActions
          id={tournoi.id}
          nom={tournoi.name}
          isPublished={tournoi.isPublished}
        />
      </div>
    </li>
  );
}

export default async function AdminTournoisPage() {
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  // 🔴 « À VENIR » ET « PASSÉS » SE DÉRIVENT DES DATES, ET LA LECTURE DE L'HORLOGE VIT DANS LA
  // COUCHE DONNÉES — jamais dans le rendu (`react-hooks/purity`). Patron mesuré le 2026-08-13
  // dans `queries/events.ts`, repris et non réinventé (note d'architecture §6 ①).
  const [aVenir, passes] = await Promise.all([
    getUpcomingTournamentsForAdmin(TOURNOIS_MAX),
    getPastTournamentsForAdmin(TOURNOIS_MAX),
  ]);

  const total = aVenir.length + passes.length;
  const publies = [...aVenir, ...passes].filter((t) => t.isPublished).length;

  return (
    <>
      <h1 className={styles.titre}>Tournois</h1>
      <p className={styles.chapo}>
        Les tournois de l&rsquo;association : ce qu&rsquo;on y joue, quand, comment
        s&rsquo;inscrire, et qui a gagné. Chaque tournoi est rattaché à un{" "}
        <strong>événement de l&rsquo;agenda</strong> — un même événement peut en porter
        plusieurs.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/tournois/nouveau">
          Ajouter un tournoi
        </Link>
        <Link className={styles.lien} href="/admin/agenda">
          Gérer l&rsquo;agenda
        </Link>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════════════
          🔴 CE QUE « PUBLIER » FAIT AUJOURD'HUI : RIEN DE VISIBLE — ET ON LE DIT
          ══════════════════════════════════════════════════════════════════════════════
          Règle ① de `00 référence/pieges/integration-tierce.md` : *« un maillon jamais
          exercé est de statut inconnu, et il se consigne AVEC son mode de défaillance
          écrit »*. Ici le maillon manquant n'est pas une intégration, c'est la page
          publique : `/tournois` (Story 9.2) et `/tournois/<tournoi>` (Story 9.3) n'existent
          pas encore. Un bénévole qui publie et va vérifier sur le site ne trouverait rien,
          et chercherait la panne. Il n'y en a pas — la page n'est pas encore écrite.
          ⚠️ CETTE PHRASE A UNE DATE DE PÉREMPTION : elle doit disparaître avec la 9.2. */}
      <p className={styles.mention} role="note">
        <strong>Ce que « publier » fait pour l&rsquo;instant :</strong> ça marque le tournoi
        comme prêt à paraître, et <strong>rien de visible sur le site</strong> — la page
        publique des tournois n&rsquo;est pas encore en ligne. Vous pouvez saisir dès
        maintenant : tout ce qui est ici s&rsquo;affichera le jour où elle arrivera, sans
        rien re-saisir.
      </p>

      {total > 0 ? (
        <p className={styles.mention} role="note">
          {publies === 0
            ? `${total} tournoi${total > 1 ? "s" : ""} en brouillon, aucun publié.`
            : `${publies} tournoi${publies > 1 ? "s" : ""} publié${publies > 1 ? "s" : ""} sur ${total}.`}
        </p>
      ) : null}

      {total > 0 ? (
        <>
          <section className={styles.section} aria-labelledby="admin-tournois-a-venir">
            <h2 className={propre.groupe} id="admin-tournois-a-venir">
              À venir
            </h2>
            {aVenir.length > 0 ? (
              <ul className={styles.liste}>
                {aVenir.map((tournoi) => (
                  <LigneTournoi key={tournoi.id} tournoi={tournoi} />
                ))}
              </ul>
            ) : (
              <p className={propre.groupeVide}>
                Aucun tournoi à venir. Les tournois passés restent listés plus bas — on ne
                les supprime pas, c&rsquo;est l&rsquo;historique de l&rsquo;association.
              </p>
            )}
          </section>

          <section className={styles.section} aria-labelledby="admin-tournois-passes">
            <h2 className={propre.groupe} id="admin-tournois-passes">
              Déjà passés
            </h2>
            {passes.length > 0 ? (
              <ul className={styles.liste}>
                {passes.map((tournoi) => (
                  <LigneTournoi key={tournoi.id} tournoi={tournoi} />
                ))}
              </ul>
            ) : (
              /* ⚠️ « À venir » et « passés » se DÉRIVENT de la date : un tournoi bascule ici
                 tout seul, sans aucun geste. Le dire évite qu'on cherche le bouton. */
              <p className={propre.groupeVide}>
                Aucun tournoi passé pour l&rsquo;instant. Un tournoi descend ici{" "}
                <strong>tout seul</strong> une fois sa date franchie — il n&rsquo;y a rien à
                cliquer. C&rsquo;est là que vous viendrez saisir son podium.
              </p>
            )}
          </section>
        </>
      ) : (
        /* ⚠️ Un état vide qui dirait « aucun tournoi » se lirait comme une panne. Celui-ci dit
           quoi faire — même doctrine que les états vides de la home (3.2), d'/agenda (3.3),
           du tableau de bord (6.1), de l'agenda (6.3), de la galerie (6.4), des partenaires
           (6.5) et des ateliers (6.9). */
        <p className={styles.vide}>
          Aucun tournoi pour l&rsquo;instant. Commencez par créer l&rsquo;événement dans
          l&rsquo;<strong>agenda</strong> (la Game&rsquo;in Reims, un jeudi en bar…), puis
          ajoutez ici les tournois qui s&rsquo;y déroulent — un événement peut en porter
          autant qu&rsquo;il en faut, chacun avec sa propre heure.
        </p>
      )}
    </>
  );
}
