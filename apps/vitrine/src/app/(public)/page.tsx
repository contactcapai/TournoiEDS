import { AnimationsTeaser } from "@/components/home/AnimationsTeaser/AnimationsTeaser";
import { DoubleDoor } from "@/components/home/DoubleDoor/DoubleDoor";
import { EventHub } from "@/components/home/EventHub/EventHub";
import { Hero } from "@/components/home/Hero/Hero";
import { QuoteBand } from "@/components/home/QuoteBand/QuoteBand";
import { ThreeAxes } from "@/components/home/ThreeAxes/ThreeAxes";
import { getUpcomingEvents } from "@/server/db/queries/events";

// Accueil (long-scroll). Les blocs s'empilent ici dans l'ordre figé par UX-DR19 :
// Hero (2.1) → hub événementiel (3.2) → trois axes (2.2) → citation (2.3) →
// teaser Animations (2.4) → tournoi (5.4) → preuve & réseau (Epic 4) →
// galerie (4.5) → double porte (2.5).
//
// Le hub événementiel est livré (Story 3.2) et INSÉRÉ entre le hero et les trois
// axes — il ne s'ajoute pas à la suite. Restent à insérer AVANT la double porte :
// le bloc Tournoi (5.4), Preuve & réseau (Epic 4) et la galerie (4.5).
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

export default async function Home() {
  // 🔴 UNE SEULE LECTURE, distribuée en props (AC1). Le macaron « CE JEUDI » du hero et
  // la carte du hub doivent désigner la MÊME date : deux requêtes indépendantes
  // pourraient diverger, et surtout dériveraient au premier changement de filtre d'un
  // seul côté. Aucun composant enfant ne requête la base.
  const upcoming = await getUpcomingEvents(HOME_EVENT_COUNT);
  const next = upcoming[0] ?? null;
  const rest = upcoming.slice(1);

  return (
    <>
      <Hero hasUpcomingEvent={next !== null} />
      <EventHub next={next} rest={rest} />
      <ThreeAxes />
      <QuoteBand />
      <AnimationsTeaser />
      <DoubleDoor />
    </>
  );
}
