"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ExternalIcon } from "@repo/ui";
import { NEW_TAB_SR, classerDestination } from "@/lib/links";
import styles from "./MobileMenu.module.css";

// Lien de navigation sérialisable (données définies côté RSC dans SiteHeader).
export interface NavLink {
  label: string;
  href: string;
  /** true ⇒ lien sortant (nouvel onglet sûr + indication SR/visuelle). */
  external?: boolean;
}

// Frontière client MINIMALE (Garde-fou n°4) : ce composant existe pour deux
// raisons qui exigent le client — (1) toggle du hamburger (useState) et
// (2) détection du lien actif (usePathname). Il rend AUSSI la nav desktop pour
// partager `usePathname`. Le SiteHeader parent reste un Server Component.

// ⚠️ `DISCORD_URL` et `REJOINDRE_URL` ONT DISPARU DE `@/lib/links` (Story 6.13) : elles sont
// devenues `site_setting.discord_url` / `site_setting.helloasso_url`, et arrivent en props.
// `NEW_TAB_SR` et `isExternalUrl` sont désormais partagés depuis `@/lib/links`
// (promus en Story 1.5 pour que header ET footer les consomment — Garde-fou n°3).
// `ExternalIcon` l'est aussi depuis la Story 5.5 : il vivait ICI en copie locale,
// à l'identique de celle du footer — les deux sont fondues dans `@repo/ui`.

/**
 * 🔴 LES DEUX DESTINATIONS ARRIVENT EN PROPS — STORY 6.13, ET C'EST STRUCTUREL.
 *
 * Ce composant porte `'use client'`. Les six réglages du site vivent en base
 * (`site_setting`) et se lisent par `server/db/queries/settings.ts`, qui est **`server-only`** :
 * l'importer d'ici casserait le build. `SiteHeader` (RSC) lit via le layout et transmet.
 *
 * ⚠️ Ce sont des chaînes SÉRIALISABLES, comme `links` — la frontière client reste exactement
 * celle de la Story 1.4, aucun `'use client'` n'a été ajouté ni déplacé par la 6.13.
 */
export function MobileMenu({
  links,
  discordUrl,
  helloassoUrl,
  session,
}: {
  links: NavLink[];
  /** Invitation Discord, ou `DESTINATION_ABSENTE`. */
  discordUrl: string;
  /** Page d'adhésion HelloAsso, ou `DESTINATION_ABSENTE`. */
  helloassoUrl: string;
  /** Deux booléens, et rien d'autre — voir `SiteHeaderProps` (Story 12.1). */
  session: { connecte: boolean; aDesRoles: boolean };
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // `close` reste un pur setter d'état (aucune lecture de ref pendant le rendu —
  // règle react-hooks/refs). Le focus rendu au déclencheur se fait dans le
  // gestionnaire d'événement Échap ci-dessous (lecture de ref autorisée hors rendu).
  const close = useCallback(() => setOpen(false), []);

  // Fermeture clavier (Échap) + piège de focus tant que le panneau est ouvert.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        // Focus rendu au déclencheur (AC2) — dans un event handler.
        hamburgerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    // À l'ouverture, déplacer le focus dans le panneau (premier lien).
    panelRef.current
      ?.querySelector<HTMLElement>('a[href], button:not([disabled])')
      ?.focus();

    return () => document.removeEventListener("keydown", onKeyDown);
    // `close` n'est pas utilisé dans l'effect (le retour focus est inline dans
    // onKeyDown) → hors deps pour ne pas masquer de futures deps manquantes.
  }, [open]);

  // Rend un lien de nav (interne via next/link, externe via <a> sûr).
  // `onNavigate` ferme le panneau mobile après un clic.
  function renderNavLink(link: NavLink, onNavigate?: () => void) {
    const isActive = !link.external && pathname === link.href;
    const className = isActive
      ? `${styles.navLink} ${styles.navLinkActive}`
      : styles.navLink;

    if (link.external) {
      const external = classerDestination(link.href) === "externe";
      return (
        <a
          key={link.href}
          href={link.href}
          {...(external
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
          className={className}
          onClick={onNavigate}
        >
          {link.label}
          {external && <ExternalIcon />}
          {external && <span className="sr-only">{NEW_TAB_SR}</span>}
        </a>
      );
    }

    return (
      <Link
        key={link.href}
        href={link.href}
        className={className}
        aria-current={isActive ? "page" : undefined}
        onClick={onNavigate}
      >
        {link.label}
      </Link>
    );
  }

  // Lien Discord (icône seule → nom accessible explicite + indication SR).
  function renderDiscord(onNavigate?: () => void) {
    const destination = classerDestination(discordUrl);
    const external = destination === "externe";

    // 🔴 SANS DESTINATION, CE N'EST PLUS UN LIEN — Story 5.5 (dette R2). Il rendait
    // jusqu'ici `<a href="#">` : focalisable au clavier et remontant en haut de page au
    // clic, sur les CINQ pages et DEUX fois par page (barre desktop + panneau mobile).
    // Ces deux occurrences n'avaient JAMAIS été comptées par R2 (« 4 tuiles sociales +
    // 2 liens légaux »), alors qu'elles existent depuis la Story 1.4.
    //
    // ⚠️ ET IL PERD SON NOM ACCESSIBLE, DÉLIBÉRÉMENT : un `aria-label` sur un `<span>`
    // sans `role` est ignoré par la plupart des lecteurs d'écran — le laisser
    // fabriquerait une promesse muette. L'élément devient de la DÉCORATION, et son
    // contenu reste `aria-hidden`. C'est cohérent avec l'inertie : il n'annonce rien
    // parce qu'il ne fait rien.
    const Balise = destination === "absente" ? "span" : "a";
    const attributsLien =
      destination === "absente"
        ? { "data-inerte": "" }
        : {
            href: discordUrl,
            ...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}),
            "aria-label": external
              ? "Discord — rejoindre la communauté (nouvel onglet)"
              : "Discord — rejoindre la communauté",
            onClick: onNavigate,
          };

    return (
      <Balise
        {...attributsLien}
        className={
          destination === "absente"
            ? styles.discord
            : `${styles.discord} ${styles.discordActif}`
        }
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M19.27 5.33A16.5 16.5 0 0 0 15.1 4l-.2.4a13 13 0 0 1 3.7 1.9 13.6 13.6 0 0 0-11.2 0A13 13 0 0 1 11.1 4.4L10.9 4a16.5 16.5 0 0 0-4.17 1.33A17.6 17.6 0 0 0 3.7 18.2a16.7 16.7 0 0 0 5.05 2.55l.4-.66a10.8 10.8 0 0 1-1.7-.82l.42-.32a11.9 11.9 0 0 0 10.26 0l.42.32c-.54.32-1.11.6-1.7.82l.4.66a16.6 16.6 0 0 0 5.05-2.55 17.6 17.6 0 0 0-3.03-12.87ZM9.55 15.5c-.99 0-1.8-.91-1.8-2.02 0-1.12.79-2.03 1.8-2.03 1.02 0 1.83.92 1.81 2.03 0 1.11-.8 2.02-1.81 2.02Zm4.9 0c-.99 0-1.8-.91-1.8-2.02 0-1.12.79-2.03 1.8-2.03 1.02 0 1.83.92 1.81 2.03 0 1.11-.79 2.02-1.81 2.02Z"
          />
        </svg>
      </Balise>
    );
  }

  // CTA « Nous rejoindre » (primitive Button gold, sortant sûr).
  function renderCta(onNavigate?: () => void) {
    const destination = classerDestination(helloassoUrl);

    // 🔴 SANS DESTINATION, LE CTA RESTE VISIBLE MAIS NE CLIQUE PLUS — arbitrage de Brice
    // du 2026-08-01 (Story 5.5). `REJOINDRE_URL` valait la page d'accueil GÉNÉRIQUE de
    // HelloAsso : une vraie URL https, donc classée sortante, donc ce bouton ouvrait un
    // nouvel onglet et l'annonçait au lecteur d'écran — vers un site tiers sans rapport
    // avec l'association. Un placeholder est inerte ; cela était ACTIF ET FAUX.
    //
    // ⚠️ ET C'EST LE RAPPEL : rien n'est en ligne, et ce bouton mort est le SEUL signal
    // visuel qui rappellera la dette R29 au moment du go-live. La dette R15 documente
    // exactement l'inverse — le hero a cessé d'afficher son placeholder, et plus rien
    // ne rappelle le travail restant. Le jour où l'URL arrive, UNE ligne de `lib/links.ts`
    // rallume les quatre rendus de ce CTA, avec icône et annonce.
    // 🔴 MISE À JOUR 6.13 : ce n'est plus « UNE ligne de `lib/links.ts` » — la valeur se SAISIT
    // désormais dans `/admin/reglages` et arrive ici en prop. Le comportement, lui, est
    // strictement inchangé : c'est toujours `classerDestination` qui décide.
    if (destination === "absente") {
      return <Button variant="gold" inactive>Nous rejoindre</Button>;
    }

    const external = destination === "externe";
    return (
      <Button
        variant="gold"
        href={helloassoUrl}
        icon={external ? <ExternalIcon /> : undefined}
        {...(external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
        onClick={onNavigate}
      >
        Nous rejoindre
        {external && <span className="sr-only">{NEW_TAB_SR}</span>}
      </Button>
    );
  }

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * 🔴 LES PORTES DU COMPTE — DANS LES ACTIONS, JAMAIS DANS LA NAVIGATION (Story 12.1)
   * ══════════════════════════════════════════════════════════════════════════════════════
   *
   * `links` est la navigation DU SITE : six destinations éditoriales que tout le monde voit. Y
   * glisser « Mon profil » en ferait une septième entrée de même rang, et la 13.3 a payé
   * exactement ça — un annuaire posé à côté d'une navigation vaut moins que la navigation qu'il
   * double. Ces deux liens vivent donc avec les CTA, où sont déjà les destinations qui ne sont
   * pas des pages du récit.
   *
   * ⚠️ **RIEN POUR UN VISITEUR ANONYME**, et surtout pas un « Se connecter » : le site public ne
   * demande de compte à personne aujourd'hui (aucune inscription en ligne avant la 12.3).
   * Annoncer une porte dont personne n'a besoin, c'est promettre une fonction absente — le
   * défaut que les planches Stitch ont écarté nommément.
   * ⚠️ **« Back-office » N'APPARAÎT QUE S'IL Y A UN RÔLE** : le montrer à un participant lui
   * offrirait une porte qui se refermerait sur `/admin/refus`.
   */
  const renderCompte = (onNavigate?: () => void) => {
    if (!session.connecte) return null;
    return (
      <>
        <Link className={styles.lienCompte} href="/profil" onClick={onNavigate}>
          Mon profil
        </Link>
        {session.aDesRoles ? (
          <Link className={styles.lienCompte} href="/admin" onClick={onNavigate}>
            Back-office
          </Link>
        ) : null}
      </>
    );
  };

  return (
    <nav aria-label="Navigation principale" className={styles.nav}>
      {/* Nav desktop (≥ 880px) */}
      <ul className={styles.desktopMenu}>
        {links.map((link) => (
          <li key={link.href}>{renderNavLink(link)}</li>
        ))}
      </ul>
      <div className={styles.desktopActions}>
        {renderCompte()}
        {renderDiscord()}
        {renderCta()}
      </div>

      {/* Hamburger (< 880px) */}
      <button
        ref={hamburgerRef}
        type="button"
        className={styles.hamburger}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          {open ? (
            <path
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M4 7h16M4 12h16M4 17h16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>

      {/* Panneau mobile : TOUJOURS monté, masqué via [hidden] quand fermé.
          → l'id reste stable pour aria-controls (review 1.4 #2) et aucun
          remount à chaque toggle (review 1.4 #8). [hidden] retire le panneau
          de l'ordre de tabulation ET de l'arbre d'accessibilité. */}
      <div id="mobile-menu" ref={panelRef} className={styles.panel} hidden={!open}>
        <ul className={styles.panelMenu}>
          {links.map((link) => (
            <li key={link.href}>{renderNavLink(link, close)}</li>
          ))}
        </ul>
        <div className={styles.panelActions}>
          {renderCompte(close)}
          {renderDiscord(close)}
          {renderCta(close)}
        </div>
      </div>
    </nav>
  );
}
