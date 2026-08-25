import Link from "next/link";
import { redirect } from "next/navigation";

import { jourLisible, jourParis } from "@/lib/date-paris";
import {
  FENETRE_JOURS,
  composerAttentes,
  type LecturesTableauDeBord,
} from "@/lib/tableau-de-bord";
import { lireCompte } from "@/server/auth/guard";
import { getUpcomingEventsForAdmin } from "@/server/db/queries/events";
import { getGalerieDuDernierEvenement } from "@/server/db/queries/photos";
import { compterSollicitations } from "@/server/db/queries/solicitations";
import {
  getTournoisQuiSeJouent,
  getUpcomingTournamentsForAdmin,
} from "@/server/db/queries/tournaments";
import { sectionsPour } from "../_sections";
import { IconeSection } from "./_menu/IconeSection";
import styles from "./page.module.css";

// Tableau de bord du back-office (Story 6.1, refondu par la Story 13.3).
//
// Server Component pur : aucune interactivité, donc aucun 'use client'.
//
// 🔴 CETTE PAGE PORTE SA PROPRE GARDE, ET CE N'EST PAS UNE REDONDANCE — DÉFAUT MESURÉ.
// Une garde placée dans un `layout` N'EMPÊCHE PAS la `page` enfant de s'exécuter : Next rend
// l'arbre de segments EN PARALLÈLE, et le `redirect()` du layout n'arrête pas un rendu déjà
// commencé ailleurs. Mesuré le 2026-08-02 en débranchant volontairement le matcher du proxy :
// la réponse était bien un `307 → /admin/login`, **et son corps contenait tout le tableau de
// bord** sérialisé dans la charge RSC, le marqueur `NEXT_REDIRECT` n'arrivant qu'à la fin. Le
// contenu avait donc déjà quitté le serveur.
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE QUE LA 13.3 CHANGE, ET POURQUOI L'ANNUAIRE DES NEUF CARTES A DISPARU
// ══════════════════════════════════════════════════════════════════════════════════════
//
// Cette page rendait les NEUF sections en cartes identiques : libellé + phrase. La Story
// 13.2 a livré la veille une colonne latérale qui porte ces mêmes neuf entrées, avec leur
// dessin, leur famille, le marquage de l'entrée courante et la phrase sous l'entrée active.
// L'annuaire était donc devenu **une seconde navigation**, moins bonne que la première.
//
// ⚠️ ET LE CRITÈRE DE CE QUI RESTE N'EST PAS LA « FRÉQUENCE D'USAGE ». Le cadrage proposait
// de ranger les sections sur trois tailles selon leur fréquence — une hypothèse assumée,
// **non mesurable dans le code**. Ce qui EST mesurable, c'est qu'une section ait un chiffre
// à montrer. Quatre en ont un ; les cinq autres n'auraient rendu qu'une carte vide, c'est-
// à-dire un lien de plus vers ce que la colonne dit déjà mieux. ⇒ Le tableau de bord montre
// exactement les sections dont la base porte une nouvelle, et rien d'autre.
export const dynamic = "force-dynamic";

// 🔴 LES SECTIONS QUI ONT UN CHIFFRE À MONTRER — LES `href` SERVENT À LES RETROUVER DANS LE
// REGISTRE, JAMAIS À REDÉCLARER LEUR LIBELLÉ NI LEUR DESSIN. Si une section disparaît du
// registre, ou se ferme pour ce compte, sa carte disparaît avec elle : une carte ne peut
// donc pas mener à une porte close (piège `garde-sur-une-copie`).
const AGENDA = "/admin/agenda";
const GALERIE = "/admin/galerie";
const TOURNOIS = "/admin/tournois";
const SOLLICITATIONS = "/admin/sollicitations";

export default async function AdminDashboardPage() {
  // ⚠️ AUCUN RÔLE EXIGÉ : le tableau de bord doit rester atteignable par un compte qui n'en
  // porte aucun — c'est le seul endroit qui peut lui DIRE pourquoi il ne voit rien.
  const compte = await lireCompte();
  if (compte === null) redirect("/admin/login");

  const sections = sectionsPour(compte.roles);
  const ouvre = (href: string) => sections.some((section) => section.href === href);

  // 🔴 UNE SEULE LECTURE D'HORLOGE POUR TOUTE LA PAGE (patron R49). Si chaque lecture lisait
  // la sienne, deux instants pourraient encadrer une même date et un tournoi se compter deux
  // fois. Et l'heure se lit ICI, jamais pendant le rendu d'un composant : `react-hooks/purity`
  // refuse l'impureté, et deux rendus du même arbre pourraient répondre différemment.
  const maintenant = new Date();
  const aujourdHui = jourParis(maintenant);

  // 🔴 ON NE LIT QUE CE QUE LE COMPTE PEUT OUVRIR. Ce n'est pas une optimisation : lire puis
  // masquer laisserait le chiffre passer un jour dans un rendu. Un `null` ici veut dire
  // « section fermée », et `composerAttentes` en tient compte.
  const [sollicitations, prochainsEvenements, quiSeJouent, prochainsTournois, galerie] =
    await Promise.all([
      ouvre(SOLLICITATIONS) ? compterSollicitations() : null,
      ouvre(AGENDA) ? getUpcomingEventsForAdmin(1) : null,
      ouvre(TOURNOIS) ? getTournoisQuiSeJouent(maintenant, FENETRE_JOURS, 3) : null,
      ouvre(TOURNOIS) ? getUpcomingTournamentsForAdmin(1) : null,
      ouvre(GALERIE) ? getGalerieDuDernierEvenement(maintenant) : null,
    ]);

  const prochainEvenement = prochainsEvenements?.[0] ?? null;
  const prochainTournoi = prochainsTournois?.[0] ?? null;

  const lectures: LecturesTableauDeBord = {
    sollicitations: sollicitations && { aTraiter: sollicitations.aTraiter },
    agenda: prochainsEvenements && {
      prochain: prochainEvenement && {
        titre: prochainEvenement.title,
        jour: jourParis(prochainEvenement.startsAt),
      },
    },
    tournois: quiSeJouent && { quiSeJouent },
    // ⚠️ Deux niveaux, et ils ne disent pas la même chose : `null` dehors = « la galerie
    // n'est pas ouverte à ce compte », `null` dedans = « aucun événement passé ».
    galerie: ouvre(GALERIE) ? { dernierEvenement: galerie } : null,
  };

  const attentes = composerAttentes(lectures, aujourdHui);

  // Ce qu'une carte annonce. `null` = section fermée à ce compte, donc pas de carte.
  const chiffres: Record<string, string | null> = {
    [AGENDA]: !prochainsEvenements
      ? null
      : prochainEvenement
        ? `Prochain : ${jourLisible(jourParis(prochainEvenement.startsAt))} — ${prochainEvenement.title}`
        : "Aucun rendez-vous programmé",
    [GALERIE]: !ouvre(GALERIE)
      ? null
      : galerie === null
        ? "Aucun événement passé"
        : galerie.photos === 0
          ? `Aucune photo pour « ${galerie.titre} »`
          : `${galerie.photos} photo${galerie.photos > 1 ? "s" : ""} pour « ${galerie.titre} »`,
    [TOURNOIS]: !prochainsTournois
      ? null
      : prochainTournoi
        ? `Prochain : ${jourLisible(jourParis(prochainTournoi.startsAt))} — ${prochainTournoi.name}`
        : "Aucun tournoi programmé",
    [SOLLICITATIONS]: !sollicitations
      ? null
      : sollicitations.aTraiter === 0
        ? `Aucune en attente — ${sollicitations.traitees} traitée${sollicitations.traitees > 1 ? "s" : ""}`
        : `${sollicitations.aTraiter} à traiter`,
  };

  const cartes = sections.filter((section) => chiffres[section.href] != null);

  return (
    <>
      <h1 className={styles.titre}>Back-office</h1>
      <p className={styles.chapo}>
        Bonjour {compte.nom ?? "et bienvenue"}. C&rsquo;est ici que se gère tout ce qui vit
        sur le site, sans passer par un développeur.
      </p>

      {sections.length === 0 ? (
        /* ══════════════════════════════════════════════════════════════════════════════
           🔴 ÉTAT VIDE RÉÉCRIT PAR LA STORY 8.1 — IL NE PARLE PLUS DE LA MÊME CHOSE
           ══════════════════════════════════════════════════════════════════════════════
           Il disait « les sections arrivent une par une », ce qui était vrai au merge de la
           6.1 quand le registre était vide. Le registre en compte neuf : cette phrase serait
           désormais FAUSSE, et vue par la seule personne à qui elle serait servie — un
           compte connecté SANS AUCUN RÔLE. C'est le motif « une phrase devenue fausse en
           silence » déjà payé en 10.9.
           ⚠️ Il dit ce qui s'est passé ET quoi faire. Un écran vide qui n'explique rien se
           lit comme une panne, et la personne réessaie au lieu de demander un accès. */
        <div className={styles.vide}>
          <p className={styles.videTitre}>
            Votre compte n&rsquo;ouvre aucune section du back-office.
          </p>
          {/* 🔴 « AUCUNE SECTION » ÉTAIT DEVENU FAUX AVEC LA STORY 12.1, et c'est le motif
              « une phrase devenue fausse en silence » que ce bloc porte déjà écrit au-dessus :
              un compte sans rôle ouvre désormais QUELQUE CHOSE — son profil. Le titre précise
              donc « du back-office », et l'écran nomme la destination qui existe.
              ⚠️ ET C'EST LA SEULE PORTE VERS `/profil` AUJOURD'HUI : la page n'est dans aucun
              menu, et tout compte connecté est passé par ici ou par `/admin/refus`. */}
          <p className={styles.videTexte}>
            Vous êtes bien connecté — c&rsquo;est l&rsquo;essentiel, et c&rsquo;est ce qui
            permet qu&rsquo;on vous attribue un accès. Demandez à un responsable de
            l&rsquo;association d&rsquo;ouvrir les droits dont vous avez besoin&nbsp;: il le
            fait depuis le back-office, et cela prend effet immédiatement.
          </p>
          <p className={styles.videTexte}>
            En attendant, <Link href="/profil">votre profil</Link> vous appartient déjà&nbsp;:
            vous pouvez y déclarer vos pseudos de jeu, pour qu&rsquo;on vous retrouve et
            qu&rsquo;on vous invite en lobby un jour de tournoi.
          </p>
        </div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════════════════════
              CE QUI ATTEND — LA BANDE QUI PASSE AVANT TOUTE LISTE
              ══════════════════════════════════════════════════════════════════════════
              ⚠️ JAMAIS DE PAGE BLANCHE (principe ④ de l'exercice Stitch) : quand rien
              n'attend, on l'ÉCRIT. Un emplacement qui disparaît laisse croire à une panne
              ou à un chargement, et personne ne sait s'il a été regardé. */}
          <section className={styles.attentes} aria-labelledby="ce-qui-attend">
            <h2 className={styles.attentesTitre} id="ce-qui-attend">
              Ce qui attend
            </h2>

            {attentes.length === 0 ? (
              <p className={styles.calme}>
                Rien n&rsquo;attend de réponse. Les sections ci-dessous disent où en sont
                l&rsquo;agenda, la galerie et les demandes reçues.
              </p>
            ) : (
              <ul className={styles.attentesListe}>
                {attentes.map((attente) => (
                  <li key={attente.cle}>
                    <Link
                      className={attente.urgent ? styles.attenteUrgente : styles.attente}
                      href={attente.href}
                    >
                      {/* ⚠️ La pastille est DÉCORATIVE et le texte se suffit : la couleur ne
                          porte jamais l'information seule (AA). */}
                      <span aria-hidden="true" className={styles.pastille} />
                      {attente.texte}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Les sections qui ont une nouvelle à annoncer. Les autres vivent dans la colonne
              de gauche, qui les range déjà par famille (Story 13.2). */}
          <ul className={styles.grille}>
            {cartes.map((section) => (
              <li key={section.href}>
                <Link className={styles.carte} href={section.href}>
                  <span className={styles.carteTitre}>
                    <IconeSection nom={section.icone} />
                    {section.libelle}
                  </span>
                  <span className={styles.carteTexte}>{chiffres[section.href]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
