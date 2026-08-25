import { SiteHeader } from "@/components/layout/SiteHeader/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter/SiteFooter";
import { lireCompte } from "@/server/auth/guard";
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

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * 🔴 LE CHROME CONNAÎT LA SESSION DEPUIS LA STORY 12.1 — ET CE N'EST PAS GRATUIT
   * ══════════════════════════════════════════════════════════════════════════════════════
   *
   * Sans ça, deux personnes n'avaient aucun chemin : un **participant** vers son profil depuis
   * une page publique, et un **administrateur** vers le back-office autrement qu'en tapant
   * l'URL. Demande de Brice, 2026-08-25.
   *
   * ⚠️ **LE COÛT NE TOMBE QUE SUR LES VISITEURS CONNECTÉS** : `lireCompte()` rend `null` **avant
   * toute requête** quand il n'y a pas de session. Un visiteur anonyme — le cas de loin le plus
   * fréquent sur une vitrine — ne paie donc rien de plus qu'avant.
   *
   * ⚠️ **AUCUNE RÉGRESSION DE RÉGIME DE RENDU** : ce layout lit DÉJÀ la base (`lireReglages`,
   * 6.13) et les pages publiques sont déjà `force-dynamic`. Le seul `○` du build reste
   * `/_not-found`, qui rend le root layout et **pas** celui-ci — le `build` sans `DATABASE_URL`
   * n'est pas menacé (garde-fou 1.7).
   *
   * 🔴 **LE RÔLE SE RELIT EN BASE, JAMAIS DEPUIS LA SESSION** — c'est `lireCompte()` qui s'en
   * charge, et c'est la règle de la 6.1 réaffirmée en 8.1 : un droit retiré doit prendre effet à
   * la requête suivante, pas à l'expiration du cookie. On ne la contourne pas pour un lien.
   */
  const compte = await lireCompte();

  return (
    <>
      {/* skip-link : compose `.sr-only` (masquage, source unique) + `.skip-link`
          (révélation au focus). href="#content" doit rester synchronisé avec
          l'id du <main> ci-dessous et le sélecteur `main#content` de globals.css. */}
      <a className="sr-only skip-link" href="#content">
        Aller au contenu
      </a>
      {/* ⚠️ DES DONNÉES PLATES, JAMAIS L'OBJET DE COMPTE : `SiteHeader` les passe à
          `MobileMenu`, qui porte `'use client'`. Transmettre `roles` ferait traverser la
          frontière client une notion d'AUTORISATION — le composant n'a pas à connaître les
          rôles, seulement s'il existe une porte à montrer. */}
      <SiteHeader
        discordUrl={reglages.discordUrl}
        helloassoUrl={reglages.helloassoUrl}
        session={{ connecte: compte !== null, aDesRoles: (compte?.roles.length ?? 0) > 0 }}
      />
      <main id="content">{children}</main>
      <SiteFooter reglages={reglages} />
    </>
  );
}
