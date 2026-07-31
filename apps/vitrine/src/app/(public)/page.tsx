import { DoubleDoor } from "@/components/home/DoubleDoor/DoubleDoor";
import { Gallery } from "@/components/gallery/Gallery/Gallery";
import { EventHub } from "@/components/home/EventHub/EventHub";
import { Hero } from "@/components/home/Hero/Hero";
import { QuoteBand } from "@/components/home/QuoteBand/QuoteBand";
import { ThreeAxes } from "@/components/home/ThreeAxes/ThreeAxes";
import { ProofBand } from "@/components/proof/ProofBand/ProofBand";
import { getUpcomingEvents } from "@/server/db/queries/events";
import { getPartnersWithLogo } from "@/server/db/queries/partners";
import { getPublishedPhotos } from "@/server/db/queries/photos";

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
// La galerie scrapbook (4.3) est en place, entre Preuve & réseau et la double porte.
// Reste à insérer AVANT la double porte : le bloc Tournoi (5.4), qui viendra AVANT
// Preuve & réseau sans le modifier.
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
 */
const HOME_EVENT_COUNT = 5;

/**
 * La home donne un APERÇU, pas l'exhaustivité (EXPERIENCE.md l.119) — même règle que pour
 * l'agenda ci-dessus. UX-DR13 dit « 5 à 10 photos suffisent pour démarrer » : 8 est le
 * milieu de cette fourchette et tient sur deux rangées de quatre en desktop.
 * ⚠️ Cette borne s'applique DÉJÀ alors qu'une seule photo est en base : elle existe pour
 * que la galerie ne se mette pas à grossir sans limite au fil des téléversements du
 * back-office (Story 6.4), pas pour un besoin d'aujourd'hui.
 */
const HOME_PHOTO_COUNT = 8;

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
  const [upcoming, partners, photos] = await Promise.all([
    getUpcomingEvents(HOME_EVENT_COUNT),
    getPartnersWithLogo(),
    getPublishedPhotos(HOME_PHOTO_COUNT),
  ]);
  const next = upcoming[0] ?? null;
  const rest = upcoming.slice(1);

  return (
    <>
      <Hero hasUpcomingEvent={next !== null} />
      <EventHub next={next} rest={rest} />
      <ThreeAxes />
      <QuoteBand />
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
      <DoubleDoor />
    </>
  );
}
