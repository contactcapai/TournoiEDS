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
//  - Le skip-link « Aller au contenu » est le TOUT PREMIER élément focusable du
//    document (le (public) layout est l'unique enfant du root pour une page
//    publique) ; il cible #content. Variance assumée vs « root layout » : le
//    landmark <main> est colocalisé avec sa cible et l'admin (Epic 6, autre
//    layout) n'hérite donc pas d'un skip-link orphelin (Story 1.6, Garde-fou n°1).
//  - <main id="content"> est fourni ICI : aucune page publique ne déclare son
//    propre <main> (un seul <main>/<h1> dans le DOM → anti-duplication Zyro).
//
// Contrainte Next : un layout doit être un default export. Reste un Server
// Component : le skip-link est une simple ancre <a href="#content"> (pas de JS).
export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {/* skip-link : compose `.sr-only` (masquage, source unique) + `.skip-link`
          (révélation au focus). href="#content" doit rester synchronisé avec
          l'id du <main> ci-dessous et le sélecteur `main#content` de globals.css. */}
      <a className="sr-only skip-link" href="#content">
        Aller au contenu
      </a>
      <SiteHeader />
      <main id="content">{children}</main>
      <SiteFooter />
    </>
  );
}
