import Image from "next/image";
import Link from "next/link";
import {
  TOURNOI_URL,
  REJOINDRE_URL,
  DISCORD_URL,
  INSTAGRAM_URL,
  X_URL,
  LINKEDIN_URL,
  CONTACT_EMAIL,
  NEW_TAB_SR,
  isExternalUrl,
} from "@/lib/links";
import styles from "./SiteFooter.module.css";

// Pied de page persistant de la vitrine (Server Component — Garde-fou n°1/Conventions :
// purement présentationnel, aucun état/handler → jamais 'use client').
// Monté dans app/(public)/layout.tsx APRÈS {children} pour apparaître sous toutes
// les pages publiques (le back-office admin n'hérite pas de ce layout).
//
// Tokens-only : couleurs/police via var(--…) ; seuls les rgba de filets/overlays
// sans token dédié restent en littéral DOCUMENTÉ (Garde-fou n°7), comme en 1.4.

// Lien de colonne (donnée statique RSC). `href` détermine le rendu :
//   - http(s)  → lien sortant sûr (nouvel onglet + icône + annonce SR)
//   - "/…"     → route interne (next/link)
//   - "#"      → placeholder inerte documenté (ni onglet ni annonce — review 1.4 #1)
interface FooterLink {
  label: string;
  href: string;
}

// Colonne « Naviguer » : mêmes cibles que le header (Tournois = sortant).
const NAV_LINKS: FooterLink[] = [
  { label: "Agenda", href: "/agenda" },
  { label: "L'asso", href: "/l-asso" },
  { label: "Animations", href: "/animations" },
  { label: "Tournois", href: TOURNOI_URL },
];

// Colonne « Participer » : adhésion + porte partenaires + plateforme tournoi.
const PARTICIPER_LINKS: FooterLink[] = [
  { label: "Adhérer (HelloAsso)", href: REJOINDRE_URL },
  { label: "Devenir partenaire", href: "/partenaires" },
  { label: "Plateforme tournoi", href: TOURNOI_URL },
];

// Réseaux sociaux : icône (aria-hidden) + nom accessible via aria-label.
// `href` "#" tant que Story 5.5 n'a pas fourni l'URL → tuile inerte (pas d'onglet).
const SOCIALS: { name: string; href: string; icon: "discord" | "instagram" | "x" | "linkedin" }[] = [
  { name: "Discord", href: DISCORD_URL, icon: "discord" },
  { name: "Instagram", href: INSTAGRAM_URL, icon: "instagram" },
  { name: "X", href: X_URL, icon: "x" },
  { name: "LinkedIn", href: LINKEDIN_URL, icon: "linkedin" },
];

// Bandeau bas : pages légales non encore rédigées (Garde-fou n°6) → placeholders
// "#" inertes (PAS de route, PAS de nouvel onglet).
const LEGAL_LINKS: FooterLink[] = [
  // TODO : pages légales à rédiger (hors périmètre Story 1.5 — RGPD bloquant).
  { label: "Mentions légales", href: "#" },
  { label: "Confidentialité (RGPD)", href: "#" },
];

// Indication visuelle « lien externe » (décorative → aria-hidden ; le sens est
// porté par le <span> SR « (nouvel onglet) »). Dupliquée sciemment du header
// (MobileMenu) : la story sanctionne la duplication consciente des icônes pour
// garder le header strictement iso-comportement (Garde-fou n°3 / Tâche 3).
function ExternalIcon() {
  return (
    <svg className={styles.extIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
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

// Icônes sociales (toutes décoratives → aria-hidden ; nom porté par aria-label).
function SocialIcon({ icon }: { icon: (typeof SOCIALS)[number]["icon"] }) {
  switch (icon) {
    case "discord":
      // Réutilise le tracé Discord du header (duplication consciente — Garde-fou n°3).
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M19.27 5.33A16.5 16.5 0 0 0 15.1 4l-.2.4a13 13 0 0 1 3.7 1.9 13.6 13.6 0 0 0-11.2 0A13 13 0 0 1 11.1 4.4L10.9 4a16.5 16.5 0 0 0-4.17 1.33A17.6 17.6 0 0 0 3.7 18.2a16.7 16.7 0 0 0 5.05 2.55l.4-.66a10.8 10.8 0 0 1-1.7-.82l.42-.32a11.9 11.9 0 0 0 10.26 0l.42.32c-.54.32-1.11.6-1.7.82l.4.66a16.6 16.6 0 0 0 5.05-2.55 17.6 17.6 0 0 0-3.03-12.87ZM9.55 15.5c-.99 0-1.8-.91-1.8-2.02 0-1.12.79-2.03 1.8-2.03 1.02 0 1.83.92 1.81 2.03 0 1.11-.8 2.02-1.81 2.02Zm4.9 0c-.99 0-1.8-.91-1.8-2.02 0-1.12.79-2.03 1.8-2.03 1.02 0 1.83.92 1.81 2.03 0 1.11-.79 2.02-1.81 2.02Z"
          />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect
            x="3.5"
            y="3.5"
            width="17"
            height="17"
            rx="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="17" cy="7" r="1.3" fill="currentColor" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M17.53 3h3.04l-6.64 7.59L21.75 21h-6.11l-4.79-6.26L5.37 21H2.33l7.1-8.12L2.25 3h6.26l4.33 5.72L17.53 3Zm-1.07 16.17h1.68L7.62 4.74H5.82l10.64 14.43Z"
          />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M6.94 5.5a1.94 1.94 0 1 1-3.88 0 1.94 1.94 0 0 1 3.88 0ZM3.4 8.4h3.1V21H3.4V8.4Zm5.09 0h2.97v1.72h.04c.41-.78 1.42-1.6 2.93-1.6 3.13 0 3.71 2.06 3.71 4.74V21h-3.1v-5.55c0-1.32-.02-3.02-1.84-3.02-1.84 0-2.12 1.44-2.12 2.93V21h-3.1V8.4Z"
          />
        </svg>
      );
  }
}

// Rend un lien de colonne selon la nature de sa cible (3 cas, cf. FooterLink).
function FooterColumnLink({ link }: { link: FooterLink }) {
  // Cas 1 — vraie URL http(s) : lien sortant sûr + annonce SR (review 1.4).
  if (isExternalUrl(link.href)) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={styles.link}>
        {link.label}
        <ExternalIcon />
        <span className="sr-only">{NEW_TAB_SR}</span>
      </a>
    );
  }
  // Cas 2 — route interne « /… » : navigation client next/link.
  if (link.href.startsWith("/")) {
    return (
      <Link href={link.href} className={styles.link}>
        {link.label}
      </Link>
    );
  }
  // Cas 3 — placeholder « # » : ancre inerte, AUCUN attribut sortant ni annonce.
  return (
    <a href={link.href} className={styles.link}>
      {link.label}
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.wrap}>
        <div className={styles.columns}>
          {/* Colonne Marque */}
          <div className={styles.brand}>
            {/* Dimensions intrinsèques (339×393) pour l'aspect-ratio anti-CLS ;
                la hauteur d'affichage (~62px maquette) est imposée en CSS. */}
            <Image
              src="/logo-eds-blanc.png"
              alt="Esport des Sacres"
              width={339}
              height={393}
              className={styles.logo}
            />
            <p className={styles.baseline}>
              Le jeu vidéo comme sport et comme lien social, à Reims et dans le Grand Est.
            </p>
          </div>

          {/* Colonne Naviguer */}
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Naviguer</h4>
            <ul className={styles.colList}>
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <FooterColumnLink link={link} />
                </li>
              ))}
            </ul>
          </div>

          {/* Colonne Participer */}
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Participer</h4>
            <ul className={styles.colList}>
              {PARTICIPER_LINKS.map((link) => (
                <li key={link.label}>
                  <FooterColumnLink link={link} />
                </li>
              ))}
            </ul>
          </div>

          {/* Colonne Suivez-nous (sociaux + email) */}
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Suivez-nous</h4>
            <ul className={styles.socials}>
              {SOCIALS.map((social) => {
                const external = isExternalUrl(social.href);
                return (
                  <li key={social.name}>
                    <a
                      href={social.href}
                      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className={styles.social}
                      aria-label={external ? `${social.name}${NEW_TAB_SR}` : social.name}
                    >
                      <SocialIcon icon={social.icon} />
                    </a>
                  </li>
                );
              })}
            </ul>
            {/* Email = mailto (pas « sortant » : pas de nouvel onglet ni annonce). */}
            <a href={`mailto:${CONTACT_EMAIL}`} className={styles.email}>
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>

        {/* Bandeau bas : copyright + liens légaux (placeholders inertes). */}
        <div className={styles.copy}>
          <span>© 2026 Esport des Sacres — association loi 1901, Reims</span>
          <span className={styles.legal}>
            {LEGAL_LINKS.map((link) => (
              <FooterColumnLink key={link.label} link={link} />
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}
