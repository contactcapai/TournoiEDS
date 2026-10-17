import type { Metadata } from "next";
import Link from "next/link";

import { TournoiActions } from "@/components/admin/TournoiActions/TournoiActions";
import { formatLongDate, formatTime, jourLisible } from "@/lib/date-paris";
import { groupesParJour } from "@/lib/tournoi/liste-par-jour";
import {
  etatInscriptionEnPhrase,
  LIBELLES_MODE_INSCRIPTION,
} from "@/lib/libelles-tournoi";
import { cleanText } from "@/lib/text";
import { exigerRolePage } from "@/server/auth/guard";
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

function LigneTournoi({
  tournoi,
  evenementCommun = false,
}: {
  tournoi: AdminTournament;
  /** Le titre du jour dit déjà l'événement : la ligne ne le répète pas. */
  evenementCommun?: boolean;
}) {
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

        {/* ⚠️ LE RATTACHEMENT EST AFFICHÉ, PAS SUPPOSÉ — et les DEUX cas le sont depuis la 9.5.
            Un tournoi rattaché au mauvais événement est invisible autrement : les deux dates
            peuvent différer légitimement (la GIR est UN événement sur deux jours qui porte DIX
            animations à des heures différentes).
            🔴 ET L'ABSENCE DE RATTACHEMENT SE DIT AUSSI, elle ne se rend pas par un blanc : sans
            événement, ce tournoi paraît LUI-MÊME à l'agenda, et c'est le fait le plus important
            de sa ligne — la seule chose qui explique pourquoi il apparaît sur la home. */}
        {evenementCommun ? null : (
        <p className={propre.rattachement}>
          {tournoi.event ? (
            <>
              Rattaché à l&rsquo;événement <strong>{tournoi.event.title}</strong>
            </>
          ) : (
            <>
              <strong>Sans événement</strong> — ce tournoi est le rendez-vous, il paraît
              lui-même à l&rsquo;agenda
            </>
          )}
        </p>
        )}

        <p className={propre.inscriptions}>
          Inscriptions : {LIBELLES_MODE_INSCRIPTION[tournoi.registrationMode]} —{" "}
          {etatInscriptionEnPhrase(tournoi.registrationState)}
        </p>

        {podium ? <p className={propre.podium}>🏆 {podium}</p> : null}

        <span
          className={`${styles.etat} ${tournoi.isPublished ? styles.etatPublie : styles.etatBrouillon}`}
        >
          {tournoi.isPublished ? "Publié" : "Brouillon"}
        </span>
      </div>

      <div className={styles.ligneActions}>
        <Link className={styles.lienPrincipal} href={`/admin/tournois/${tournoi.id}`}>
          Gérer le tournoi
        </Link>
        {/* « Aperçu » arrive avec la Story 9.3, en même temps que la fiche publique qu'il
            prévisualise et que la phrase « Voir le rendu avant de publier » de `_sections.ts`.
            Ordre et libellé repris de la liste d'agenda : deux listes du même back-office qui
            nommeraient différemment le même geste feraient hésiter au mauvais moment. */}
        {tournoi.isPublished ? (
          <Link className={styles.lien} href={`/tournois/${tournoi.slug}`}>
            Page publique
          </Link>
        ) : (
          <Link className={styles.lien} href={`/admin/tournois/${tournoi.id}/apercu`}>
            Aperçu
          </Link>
        )}
        {/* 🔴 Une entrée À PART, et non un lien niché dans « Modifier » (Story 10.4).
            « Modifier » annonce l'édition de l'ANNONCE — jeu, date, lieu, lots. Composer le
            déroulé est un autre geste, à un autre moment : on annonce des semaines avant, on
            compose quand on sait qui vient. Les fondre ferait chercher le second là où rien
            ne le laisse deviner. */}
        <Link className={styles.lien} href={`/admin/tournois/${tournoi.id}/phases`}>
          Déroulé
        </Link>
        {/* 🔴 UNE ENTRÉE À PART, POUR LA MÊME RAISON QUE « DÉROULÉ » (Story 10.5). Le défaut
            relevé par Brice le 2026-08-15 était un lien niché dans « Modifier » : on ne le
            refait pas. Et « Engagés » n'est pas non plus une sous-partie du « Déroulé » —
            c'est le geste du JOUR J, fait dans une salle, souvent par quelqu'un d'autre que
            celui qui a composé les phases des semaines plus tôt. */}
        <Link className={styles.lien} href={`/admin/tournois/${tournoi.id}/engages`}>
          Engagés
        </Link>
        {/* 🔴 ENCORE UNE ENTRÉE À PART (Story 10.8), et c'est la troisième fois qu'on tient la
            même règle : « Déroulé » se compose des semaines avant, « Engagés » se pointe à
            l'arrivée, « Jour J » se joue pendant. Trois moments, trois personnes possibles, trois
            entrées — les fondre ferait chercher la troisième là où rien ne la laisse deviner. */}
        <Link className={styles.lien} href={`/admin/tournois/${tournoi.id}/jour-j`}>
          Jour J
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

export default async function AdminTournoisPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  await exigerRolePage("admin_tournoi");

  const [tousAVenir, tousPasses] = await Promise.all([
    getUpcomingTournamentsForAdmin(TOURNOIS_MAX),
    getPastTournamentsForAdmin(TOURNOIS_MAX),
  ]);

  // Recherche et filtre portés par l'URL : un formulaire GET, aucun JavaScript (retour UX du
  // 2026-10-16 — onze tournois de la GIR rendaient la liste longue à parcourir).
  const { q, statut } = await searchParams;
  const recherche = (q ?? "").trim().toLocaleLowerCase("fr");
  const filtre = statut === "publies" || statut === "brouillons" ? statut : "tous";
  const retenu = (t: AdminTournament) =>
    (filtre === "tous" || t.isPublished === (filtre === "publies")) &&
    (recherche === "" || `${t.name} ${t.game}`.toLocaleLowerCase("fr").includes(recherche));
  const aVenir = tousAVenir.filter(retenu);
  const passes = tousPasses.filter(retenu);
  const filtrageActif = filtre !== "tous" || recherche !== "";
  const joursAVenir = groupesParJour(aVenir);

  const total = tousAVenir.length + tousPasses.length;
  const publies = [...tousAVenir, ...tousPasses].filter((t) => t.isPublished).length;

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
        <Link className={styles.lien} href="/admin/tournois/reglements">
          Modèles de règlement
        </Link>
        <Link className={styles.lien} href="/admin/agenda">
          Gérer l&rsquo;agenda
        </Link>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════════════
          CE QUE « PUBLIER » FAIT — 2ᵉ RÉÉCRITURE, PAR LA STORY 9.4
          ══════════════════════════════════════════════════════════════════════════════
          Cette phrase a porté DEUX avertissements successifs, chacun avec sa date de
          péremption ÉCRITE, et chacune est échue :
            · 9.1 → *« rien de visible sur le site, la page publique n'existe pas encore »*,
              périmé par la 9.2 qui a livré `/tournois` ;
            · 9.2 → *« le menu du site mène encore à l'ancienne plateforme, tapez l'adresse »*,
              périmé par la 9.4 : `TOURNOI_URL` vaut `/tournois`, les 29 ancres du chrome
              mènent ici, et l'ancien hôte redirige.
          ⇒ Il ne reste que le fait NU, sans avertissement — c'est le but : chaque report avait
          son mode de défaillance écrit sur l'écran de celui qui le subissait (règle ① de
          `00 référence/pieges/integration-tierce.md`), et il n'y a plus de report.
          ⚠️ NE PAS ré-ajouter d'avertissement « au cas où » : une mise en garde sans cause
          envoie un bénévole chercher une panne qui n'existe pas. */}
      <p className={styles.mention} role="note">
        <strong>Ce que « publier » fait :</strong> le tournoi apparaît aussitôt sur la{" "}
        <strong>page publique des tournois</strong>, à l&rsquo;adresse{" "}
        <code>/tournois</code> — celle vers laquelle mènent le menu et le pied de page du
        site.
      </p>

      {total > 0 ? (
        <p className={styles.mention} role="note">
          {publies === 0
            ? `${total} tournoi${total > 1 ? "s" : ""} en brouillon, aucun publié.`
            : `${publies} tournoi${publies > 1 ? "s" : ""} publié${publies > 1 ? "s" : ""} sur ${total}.`}
        </p>
      ) : null}

      {total > 0 ? (
        <form className={styles.filtres} method="get" role="search">
          <label className={styles.filtreLabel} htmlFor="tournois-q">
            Rechercher
          </label>
          <input
            id="tournois-q"
            className={styles.recherche}
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Nom ou jeu"
          />
          <select
            className={styles.recherche}
            name="statut"
            defaultValue={filtre}
            aria-label="Statut"
          >
            <option value="tous">Tous</option>
            <option value="publies">Publiés</option>
            <option value="brouillons">Brouillons</option>
          </select>
          <button className={styles.filtrer} type="submit">
            Filtrer
          </button>
          {filtrageActif ? (
            <Link className={styles.lien} href="/admin/tournois">
              Tout afficher
            </Link>
          ) : null}
        </form>
      ) : null}

      {total > 0 ? (
        <>
          <section className={styles.section} aria-labelledby="admin-tournois-a-venir">
            <h2 className={propre.groupe} id="admin-tournois-a-venir">
              À venir
            </h2>
            {aVenir.length > 0 ? (
              joursAVenir.map((jour) => {
                // L'événement commun à tous les tournois du jour se dit UNE fois, dans le titre.
                const titres = new Set(jour.tournois.map((t) => t.event?.title ?? null));
                const evenement = titres.size === 1 ? [...titres][0] : null;
                return (
                  <div key={jour.jour} className={propre.jour}>
                    <h3 className={propre.jourTitre}>
                      {jourLisible(jour.jour)}
                      {evenement ? ` — ${evenement}` : ""}
                    </h3>
                    <ul className={styles.liste}>
                      {jour.tournois.map((tournoi) => (
                        <LigneTournoi
                          key={tournoi.id}
                          tournoi={tournoi}
                          evenementCommun={evenement !== null}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })
            ) : filtrageActif ? (
              <p className={propre.groupeVide}>Aucun tournoi à venir ne correspond à ce filtre.</p>
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
