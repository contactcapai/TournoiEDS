"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@repo/ui";
import { DISCORD_URL, REJOINDRE_URL } from "@/lib/links";
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

// Indication visuelle « lien externe » (décorative → aria-hidden) ; le sens est
// porté par le <span> SR « (nouvelle fenêtre) ».
function ExternalIcon() {
  return (
    <svg
      className={styles.extIcon}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M14 5h5v5M19 5l-9 9M9 6H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Aligné sur la primitive LinkArrow (@repo/ui) qui annonce « (nouvel onglet) »
// → phrasé lecteur d'écran cohérent sur toute la vitrine.
const NEW_TAB_SR = " (nouvel onglet)";

// Un lien n'est « sortant » (nouvel onglet + annonce SR + icône) que si sa cible
// est une vraie URL http(s). Les placeholders (« # », finalisés Story 5.5) restent
// de simples ancres : pas d'onglet vide, pas d'annonce trompeuse (review 1.4 #1).
function isExternalUrl(href: string) {
  return /^https?:\/\//.test(href);
}

export function MobileMenu({ links }: { links: NavLink[] }) {
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
      const external = isExternalUrl(link.href);
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
    const external = isExternalUrl(DISCORD_URL);
    return (
      <a
        href={DISCORD_URL}
        {...(external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
        className={styles.discord}
        aria-label={
          external
            ? "Discord — rejoindre la communauté (nouvel onglet)"
            : "Discord — rejoindre la communauté"
        }
        onClick={onNavigate}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M19.27 5.33A16.5 16.5 0 0 0 15.1 4l-.2.4a13 13 0 0 1 3.7 1.9 13.6 13.6 0 0 0-11.2 0A13 13 0 0 1 11.1 4.4L10.9 4a16.5 16.5 0 0 0-4.17 1.33A17.6 17.6 0 0 0 3.7 18.2a16.7 16.7 0 0 0 5.05 2.55l.4-.66a10.8 10.8 0 0 1-1.7-.82l.42-.32a11.9 11.9 0 0 0 10.26 0l.42.32c-.54.32-1.11.6-1.7.82l.4.66a16.6 16.6 0 0 0 5.05-2.55 17.6 17.6 0 0 0-3.03-12.87ZM9.55 15.5c-.99 0-1.8-.91-1.8-2.02 0-1.12.79-2.03 1.8-2.03 1.02 0 1.83.92 1.81 2.03 0 1.11-.8 2.02-1.81 2.02Zm4.9 0c-.99 0-1.8-.91-1.8-2.02 0-1.12.79-2.03 1.8-2.03 1.02 0 1.83.92 1.81 2.03 0 1.11-.79 2.02-1.81 2.02Z"
          />
        </svg>
      </a>
    );
  }

  // CTA « Nous rejoindre » (primitive Button gold, sortant sûr).
  function renderCta(onNavigate?: () => void) {
    const external = isExternalUrl(REJOINDRE_URL);
    return (
      <Button
        variant="gold"
        href={REJOINDRE_URL}
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

  return (
    <nav aria-label="Navigation principale" className={styles.nav}>
      {/* Nav desktop (≥ 880px) */}
      <ul className={styles.desktopMenu}>
        {links.map((link) => (
          <li key={link.href}>{renderNavLink(link)}</li>
        ))}
      </ul>
      <div className={styles.desktopActions}>
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
          {renderDiscord(close)}
          {renderCta(close)}
        </div>
      </div>
    </nav>
  );
}
