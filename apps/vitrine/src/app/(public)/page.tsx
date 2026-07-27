import { Hero } from "@/components/home/Hero/Hero";

// Accueil (long-scroll). Le Hero est livré en Story 2.1 ; les blocs suivants
// s'empileront ici dans l'ordre figé par UX-DR19 : hub événementiel (Epic 3),
// trois axes (2.2), citation (2.3), teaser Animations (2.4), tournoi (5.4),
// preuve & réseau (Epic 4), galerie (4.5), double porte (2.5).
//
// Server Component : la page reste prérendue Static (acquis Story 1.6). Le
// <main id="content"> est fourni par (public)/layout.tsx → pas de <main> ici,
// et le <h1> unique du document est celui porté par le Hero.
export default function Home() {
  return <Hero />;
}
