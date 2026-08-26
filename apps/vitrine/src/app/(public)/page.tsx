import { DoubleDoor } from "@/components/home/DoubleDoor/DoubleDoor";
import { Gallery } from "@/components/gallery/Gallery/Gallery";
import { EventHub } from "@/components/home/EventHub/EventHub";
import { identifiantsDEvenements } from "@/lib/venues";
import { lireCompte } from "@/server/auth/guard";
import { mesVenues as mesVenuesQuery } from "@/server/db/queries/venues";
import { Hero } from "@/components/home/Hero/Hero";
import { QuoteBand } from "@/components/home/QuoteBand/QuoteBand";
import { ThreeAxes } from "@/components/home/ThreeAxes/ThreeAxes";
import { TournamentBridge } from "@/components/home/TournamentBridge/TournamentBridge";
import { ProofBand } from "@/components/proof/ProofBand/ProofBand";
import { HOME_PHOTO_COUNT } from "@/lib/galerie";
import { getUpcomingRendezVous } from "@/server/db/queries/rendez-vous";
import { getPartnersWithLogo } from "@/server/db/queries/partners";
import { getPublishedPhotos } from "@/server/db/queries/photos";
import { lireReglages } from "@/server/db/queries/settings";

// Accueil (long-scroll). Les blocs s'empilent ici dans l'ordre figé par UX-DR19 :
// Hero (2.1) → hub événementiel (3.2) → trois axes (2.2) → citation (2.3) →
// tournoi (5.4) → preuve & réseau (4.1) → galerie (4.3) → double porte (2.5).
//
// ⚠️ LE BLOC « TEASER ANIMATIONS » A ÉTÉ RETIRÉ PAR LA STORY 4.1, ET C'EST DÉFINITIF.
// Motif mesuré au cadrage de l'Epic 4 : son CTA or « Nous solliciter » et le CTA outline
// « Nous contacter » de la porte partenaires de DoubleDoor pointaient TOUS DEUX vers
// /partenaires, à deux blocs d'écart, pour le même public. Son seul apport propre — le
// lien « Toutes nos animations » — a migré dans la carte partenaires de DoubleDoor.
// Le long-scroll compte donc 10 blocs et non 11 : FR7, UX-DR12, UX-DR19 et EXPERIENCE.md
// ont été corrigés à la source dans le même commit (`pieges/cadrage-perime.md`).
// Ne pas le réintroduire « pour équilibrer » : ce serait rouvrir la redondance.
//
// ✅ L'ENCHAÎNEMENT EST COMPLET DEPUIS LA STORY 5.4 : la galerie scrapbook (4.3) est
// entre Preuve & réseau et la double porte, et le bloc Tournoi (5.4) s'est inséré
// entre la citation et Preuve & réseau, sans modifier ni l'un ni l'autre.
// Les 10 blocs sont là — aucun bloc ne reste à insérer dans la home.
//
// La double porte est le 10ᵉ et DERNIER bloc, juste avant le footer : elle est
// donc déjà à sa place définitive. Aucun bloc ne s'ajoutera après elle.
//
// Le <main id="content"> est fourni par (public)/layout.tsx → pas de <main> ici,
// et le <h1> unique du document est celui porté par le Hero.

/**
 * 🔴 LA HOME EST DYNAMIQUE DEPUIS CETTE STORY, ET C'EST UN CHOIX, PAS UN EFFET DE BORD.
 *
 * Elle lit l'agenda en base : son symbole de build passe de `○ (Static)` à `ƒ (Dynamic)`.
 * `/l-asso` et `/animations`, purement éditoriales, restent `○ (Static)`.
 *
 * `force-dynamic` est le SEUL réglage qui satisfait simultanément les deux contraintes
 * du projet :
 *   1. « le build reste sûr sans `DATABASE_URL` » — garde-fou n°2 de la Story 1.7,
 *      vérifié en 1.7 puis en 3.1, et STRUCTUREL à la CI (« aucun secret requis »,
 *      en tête de .github/workflows/ci.yml). Next n'exécute jamais cette page au build,
 *      donc aucune tentative de connexion pendant `next build` ;
 *   2. « la donnée est fraîche à chaque requête » — un jeudi passé doit disparaître
 *      du hub sans redéploiement.
 *
 * ⚠️ NE PAS « corriger » ce point en repassant la page en ISR (`export const revalidate`)
 * : sans `force-dynamic`, Next PRÉRENDRAIT la page au build, exécuterait la requête
 * Drizzle pendant le build, et la CI tomberait. `architecture.md` décrit l'agenda comme
 * « SSG/ISR », mais ce texte est ANTÉRIEUR au garde-fou de la 1.7.
 *
 * ⚠️ Pas de cache applicatif (`unstable_cache` / `revalidateTag('events')`) ici : aucune
 * mutation n'existe encore pour l'invalider (elles arrivent en Story 6.3), et la Story
 * 3.3 porte sa PROPRE décision sur l'ISR. Le poser ici par anticipation serait un cache
 * que personne ne saurait purger.
 */
export const dynamic = "force-dynamic";

/**
 * 5 = la carte du prochain rendez-vous + jusqu'à 4 lignes de roulement — exactement ce
 * que montre la maquette (3 hebdo + 1 temps fort). La home donne un APERÇU, pas
 * l'exhaustivité (EXPERIENCE.md l.119) : la liste complète est la page /agenda (3.3).
 *
 * ⚠️ **DEPUIS LA 9.5, CETTE BORNE PORTE SUR LA LISTE FUSIONNÉE**, pas sur les seuls
 * événements — et c'est bien 5 **au total**, pas 5 + 5. `getUpcomingRendezVous` lit chaque
 * source à la borne **pleine** puis tronque **après** la fusion : les 5 retenus sont donc
 * exactement les 5 plus proches, quelle que soit leur répartition entre les deux natures.
 */
const HOME_EVENT_COUNT = 5;

/**
 * ⚠️ `HOME_PHOTO_COUNT` A QUITTÉ CE FICHIER (Story 6.4) : il vit dans `lib/galerie.ts`.
 * Il est né ici, seul consommateur, puis la 6.4 lui en a donné deux autres — l'écran de
 * galerie du back-office, qui marque les photos entrant réellement dans les 8, et son
 * aperçu, qui borne sa prévisualisation exactement comme cette page. Trois consommateurs, et
 * surtout une divergence qui serait SILENCIEUSE : le back-office dirait « sur l'accueil » à
 * propos d'une photo qui n'y serait pas.
 * Ce que le commentaire d'origine annonçait est arrivé : la borne existe pour que la galerie
 * ne grossisse pas sans limite au fil des téléversements du back-office.
 */

export default async function Home() {
  // 🔴 LES LECTURES VIVENT ICI ET SE DISTRIBUENT EN PROPS (AC1 de la 3.2). Le macaron
  // « CE JEUDI » du hero et la carte du hub doivent désigner la MÊME date : deux requêtes
  // indépendantes pourraient diverger, et surtout dériveraient au premier changement de
  // filtre d'un seul côté. Aucun composant enfant ne requête la base.
  //
  // ⚠️ Les lectures sont PARALLÉLISÉES : agenda, partenaires et photos sont
  // indépendants, les enchaîner en `await` successifs ajouterait autant d'allers-retours
  // de base de données à chaque requête pour rien (la page est `force-dynamic`, donc ce
  // coût est payé à CHAQUE visite, pas une fois au build). La Story 4.3 en ajoute une
  // troisième sans changer le nombre de tours d'horloge.
  //
  // 🔴 LA QUATRIÈME LECTURE (Story 6.13) — les réglages du site. Elle rejoint le
  // `Promise.all` pour la raison exacte des trois autres : elle est indépendante, et
  // l'enchaîner ajouterait un aller-retour par visite.
  // ⚠️ `lireReglages()` est enveloppée de `cache()` : le `(public)/layout.tsx` l'appelle
  // AUSSI, pour le header et le footer, et les deux appels ne font qu'UNE requête SQL le
  // temps de cette requête HTTP. Ce n'est PAS un cache applicatif — rien à invalider.
  // 🔴 DEPUIS LA STORY 9.5, LA PREMIÈRE LECTURE N'EST PLUS « LES ÉVÉNEMENTS » MAIS « LES
  // RENDEZ-VOUS » : les événements publiés **et** les tournois publiés SANS événement, dans
  // un seul ordre chronologique. Un tournoi rattaché n'y figure pas — c'est son événement que
  // l'agenda montre, jamais ses animations (sans quoi la Game'in Reims paraîtrait onze fois).
  const [upcoming, partners, photos, reglages] = await Promise.all([
    getUpcomingRendezVous(HOME_EVENT_COUNT),
    getPartnersWithLogo(),
    getPublishedPhotos(HOME_PHOTO_COUNT),
    lireReglages(),
  ]);
  const next = upcoming[0] ?? null;
  const rest = upcoming.slice(1);

  /**
   * 🔴 LA SESSION ET MES VENUES SE LISENT ICI, UNE FOIS (Story 12.2). `EventHub` et `EventRow`
   * restent des Server Components PURS : leur faire lire la session par ligne ferait une requête
   * par rendez-vous.
   * ⚠️ `lireCompte()` rend `null` AVANT toute requête sans session, et `mesVenues` s'arrête sur
   * une liste vide : un visiteur anonyme ne paie donc rien de plus qu'avant.
   */
  const compte = await lireCompte();
  const mesVenues = compte
    ? await mesVenuesQuery(compte.utilisateurId, identifiantsDEvenements([...(next ? [next] : []), ...rest]))
    : new Set<string>();

  return (
    <>
      <Hero hasUpcomingEvent={next !== null} />
      <EventHub
        next={next}
        rest={rest}
        discordUrl={reglages.discordUrl}
        venue={{ connecte: compte !== null, mesVenues }}
      />
      <ThreeAxes />
      <QuoteBand />
      {/* Passerelle Tournoi (5.4) — position FIXÉE PAR FR7 : entre la citation et le
          bloc de preuve. 100 % statique : il ne lit rien, il n'est donc pas dans le
          `Promise.all` ci-dessus et n'ajoute aucun aller-retour de base à la page. */}
      <TournamentBridge />
      {/* Se rend `null` si aucun partenaire n'a de logo — pas de tête de section
          orpheline ni de cadre vide (AC6). C'est le composant qui décide, pas cette
          page : la règle appartient au bloc de preuve, pas à l'ordre des blocs. */}
      <ProofBand partners={partners} />
      {/* La galerie NE se rend PAS `null` quand elle est vide — contrairement à
          `ProofBand` juste au-dessus, et la différence est assumée : un bloc de PREUVE
          sans preuve est un aveu, une galerie qui RACONTE peut dire « ça arrive ».
          `EXPERIENCE.md` É7 et UX-DR20 nomment explicitement ce cas pour la galerie
          (« placeholders maîtrisés, jamais une grille cassée »). La décision de rendre
          l'un ou l'autre appartient au composant, pas à l'ordre des blocs. */}
      <Gallery photos={photos} />
      <DoubleDoor
        helloassoUrl={reglages.helloassoUrl}
        contactEmail={reglages.contactEmail}
      />
    </>
  );
}
