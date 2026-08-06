import { SiteHeader } from "@/components/layout/SiteHeader/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter/SiteFooter";
import { lireReglages } from "@/server/db/queries/settings";

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
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE LAYOUT LIT LA BASE DEPUIS LA STORY 6.13 — ET C'EST LE POINT UNIQUE DE LECTURE
//    DES RÉGLAGES POUR LE CHROME DES 5 PAGES
// ══════════════════════════════════════════════════════════════════════════════════════
//
// Les six destinations du header et du footer viennent de `site_setting` et se saisissent au
// back-office. Elles sont lues ICI, une fois, et distribuées EN PROPS — les composants ne
// requêtent jamais eux-mêmes (patron AC1 de la 3.2).
//
// ⚠️ `MobileMenu` (rendu par `SiteHeader`) porte `'use client'` : il ne PEUT PAS importer un
// module `server-only`. Les props ne sont donc pas un choix de style, c'est la seule voie —
// voir l'en-tête de `lib/links.ts`, scindé pour cette raison.
//
// ⚠️ AUCUNE RÉGRESSION DE RÉGIME DE RENDU : les 5 pages publiques sont DÉJÀ `force-dynamic`
// (Stories 3.2, 3.3, 4.2, 6.9, 6.10). Ce layout n'en fait basculer aucune — `epics.md`
// annonçait le contraire, et cette affirmation était périmée de deux stories (corrigée à la
// source par la 6.13). Le seul `○` du build reste `/_not-found`, qui rend le root layout et
// **pas** celui-ci : c'est ce qui garde le `build` sûr sans `DATABASE_URL` (garde-fou 1.7).
export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const reglages = await lireReglages();

  return (
    <>
      {/* skip-link : compose `.sr-only` (masquage, source unique) + `.skip-link`
          (révélation au focus). href="#content" doit rester synchronisé avec
          l'id du <main> ci-dessous et le sélecteur `main#content` de globals.css. */}
      <a className="sr-only skip-link" href="#content">
        Aller au contenu
      </a>
      <SiteHeader discordUrl={reglages.discordUrl} helloassoUrl={reglages.helloassoUrl} />
      <main id="content">{children}</main>
      <SiteFooter reglages={reglages} />
    </>
  );
}
