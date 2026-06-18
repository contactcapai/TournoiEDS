import { SiteHeader } from "@/components/layout/SiteHeader/SiteHeader";

// Layout du groupe (public) : monte l'en-tête persistant sur TOUTES les pages
// publiques (les groupes `(…)` n'affectent pas l'URL). Le back-office `app/admin/*`
// (Epic 6) n'hérite pas de ce layout → pas de header public côté admin.
//
// Frontière (Garde-fous 1 & 2 de la story) :
//  - Le header vit ICI, pas dans le root `app/layout.tsx` (laissé intact).
//  - <SiteFooter /> s'ajoutera après {children} en Story 1.5.
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
    </>
  );
}
