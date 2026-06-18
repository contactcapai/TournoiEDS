import { SiteHeader } from "@/components/layout/SiteHeader/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter/SiteFooter";

// Layout du groupe (public) : monte l'en-tête + le pied de page persistants sur
// TOUTES les pages publiques (les groupes `(…)` n'affectent pas l'URL). Le
// back-office `app/admin/*` (Epic 6) n'hérite pas de ce layout → ni header ni
// footer public côté admin.
//
// Frontière (Garde-fous 1 & 2 de la story) :
//  - Header + footer vivent ICI, pas dans le root `app/layout.tsx` (laissé intact).
//  - <SiteFooter /> est rendu APRÈS {children} (Story 1.5).
//  - skip-link / <main id> sémantique / coquille SEO-a11y = Story 1.6.
//    La home démo conserve son propre <main> provisoire pour l'instant.
//
// Contrainte Next : un layout doit être un default export.
export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
