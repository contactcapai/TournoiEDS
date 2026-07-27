import { AnimationsTeaser } from "@/components/home/AnimationsTeaser/AnimationsTeaser";
import { Hero } from "@/components/home/Hero/Hero";
import { QuoteBand } from "@/components/home/QuoteBand/QuoteBand";
import { ThreeAxes } from "@/components/home/ThreeAxes/ThreeAxes";

// Accueil (long-scroll). Les blocs s'empilent ici dans l'ordre figé par UX-DR19 :
// Hero (2.1) → hub événementiel (Epic 3) → trois axes (2.2) → citation (2.3) →
// teaser Animations (2.4) → tournoi (5.4) → preuve & réseau (Epic 4) →
// galerie (4.5) → double porte (2.5).
//
// ⚠️ Le hub événementiel n'est pas encore livré : les trois axes suivent donc
// directement le hero pour l'instant. L'Epic 3 s'INSÈRE ENTRE les deux, il ne
// s'ajoute pas à la suite. La citation puis le teaser Animations, eux, sont à
// leur rang définitif.
//
// Server Component : la page reste prérendue Static (acquis Story 1.6). Le
// <main id="content"> est fourni par (public)/layout.tsx → pas de <main> ici,
// et le <h1> unique du document est celui porté par le Hero.
export default function Home() {
  return (
    <>
      <Hero />
      <ThreeAxes />
      <QuoteBand />
      <AnimationsTeaser />
    </>
  );
}
