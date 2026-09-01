import Image from "next/image";
import Link from "next/link";
import { ExternalIcon } from "@repo/ui";
import { TOURNOI_URL, NEW_TAB_SR, classerDestination } from "@/lib/links";
import { Wrap } from "@/components/common/Wrap/Wrap";
import type { Reglages } from "@/server/db/queries/settings";
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
//   - ""       → AUCUNE destination : rendu NON INTERACTIF (ni lien, ni focus, ni annonce)
interface FooterLink {
  label: string;
  href: string;
}

// Colonne « Naviguer » : mêmes cibles que le header.
// 🔴 PLUS AUCUNE N'EST SORTANTE — STORY 9.4. Cette ligne disait « (Tournois = sortant) » : la
// valeur de `TOURNOI_URL` est passée à `/tournois`, donc `classerDestination` classe les quatre
// entrées en `interne` et `FooterColumnLink` les rend toutes par `next/link`. Aucune ligne de
// ce fichier n'a eu à changer — c'est le classificateur de la Story 5.5 qui a payé.
const NAV_LINKS: FooterLink[] = [
  { label: "Agenda", href: "/agenda" },
  { label: "L'asso", href: "/l-asso" },
  { label: "Animations", href: "/animations" },
  { label: "Tournois", href: TOURNOI_URL },
];

// Colonne « Participer » : adhésion + porte partenaires + plateforme tournoi.
// ⚠️ FABRIQUÉE À CHAQUE RENDU depuis les réglages (Story 6.13) et non plus constante : seule
// « Adhérer » en dépend, mais l'ordre des trois entrées appartient à la colonne, pas au réglage.
// ⚠️ « Plateforme tournoi » DÉSIGNE DÉSORMAIS UNE PAGE DE CE SITE (Story 9.4), et fait donc
// doublon de destination avec « Tournois » de la colonne voisine. Le libellé n'est PAS réécrit
// ici : les libellés de ce site sont contractuels (UX-DR18), et le point est porté au gate
// visuel de la 9.4. ⇒ Ne pas le « corriger » au passage d'une autre story.
const participerLinks = (helloassoUrl: string): FooterLink[] => [
  { label: "Adhérer (HelloAsso)", href: helloassoUrl },
  { label: "Devenir partenaire", href: "/partenaires" },
  { label: "Plateforme tournoi", href: TOURNOI_URL },
];

// Réseaux sociaux : icône (aria-hidden) + nom accessible via aria-label.
// ⚠️ Les QUATRE destinations sont ABSENTES TANT QUE PERSONNE NE LES A SAISIES (dette R29) :
// les tuiles sont alors rendues NON INTERACTIVES. Le jour où les comptes existent, il suffit
// de les renseigner dans `/admin/reglages` — rien à changer ici.
// 🔴 MISE À JOUR 6.13 : ce commentaire disait « il suffit de renseigner `lib/links.ts` ». Ce
// fichier n'est plus la source de vérité — les valeurs vivent dans `site_setting` et arrivent
// en props. Une consigne qui envoie éditer un fichier qui ne décide plus rien est exactement
// la dette que `pieges/cadrage-perime.md` recense.
// 🔴 Le commentaire d'origine annonçait « tuile inerte (pas d'onglet) » alors que la
// tuile rendait `<a href="#">`, donc un lien focalisable qui remontait en haut de page.
// Il décrivait le défaut R2 comme si c'était une garde : un avertissement faux est CRU.
type SocialIconName = "discord" | "instagram" | "x" | "linkedin";
const socials = (r: Reglages): { name: string; href: string; icon: SocialIconName }[] => [
  { name: "Discord", href: r.discordUrl, icon: "discord" },
  { name: "Instagram", href: r.instagramUrl, icon: "instagram" },
  { name: "X", href: r.xUrl, icon: "x" },
  { name: "LinkedIn", href: r.linkedinUrl, icon: "linkedin" },
];

// ══════════════════════════════════════════════════════════════════════════════════════
// ✅ LES DEUX LIENS LÉGAUX SONT VIVANTS DEPUIS LA STORY 12.5
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 ILS ONT ÉTÉ INERTES DE LA STORY 1.5 AU 2026-09-01 — douze epics. Le TODO disait
// « pages légales à rédiger (hors périmètre — RGPD bloquant) », et c'est resté vrai pendant
// que le site se mettait à collecter des adresses e-mail (6.11), des comptes (8.1), des
// pseudos de jeu (12.1) et des inscriptions nominatives (12.3). Un pied de page qui NOMME
// deux pages et ne mène nulle part est une promesse non tenue, rendue sur TOUTES les pages.
//
// ⚠️ CE QUI A DÉCLENCHÉ LEUR ÉCRITURE N'EST PAS CE QUI LES RENDAIT OBLIGATOIRES : la console
// Google Cloud a refusé de publier l'application OAuth sans ces deux liens (mesuré le
// 2026-09-01, l'état « Test » ne peut pas être quitté). Elle a servi de révélateur — la
// dette, elle, courait depuis la LCEN et le RGPD.
const LEGAL_LINKS: FooterLink[] = [
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Confidentialité (RGPD)", href: "/confidentialite" },
];

// ⚠️ `ExternalIcon` vivait ICI, dupliqué sciemment du header (Story 1.5, Garde-fou n°3).
// La Story 5.5 fond les deux copies dans `@repo/ui` : elles étaient identiques au tracé
// ET au CSS, et l'absence d'un composant partagé avait laissé les CTA `Button` sortants
// sans indication visible pendant quatre stories (dette R12).

// Icônes sociales (toutes décoratives → aria-hidden ; nom porté par aria-label).
function SocialIcon({ icon }: { icon: SocialIconName }) {
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
  // Les trois cas viennent désormais du classificateur partagé (Story 5.5) et non
  // d'une re-dérivation locale : `lib/links.ts` est le SEUL endroit qui décide.
  switch (classerDestination(link.href)) {
    // Cas 1 — vraie URL http(s) : lien sortant sûr + annonce SR (review 1.4).
    case "externe":
      return (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.link} ${styles.linkActif}`}
        >
          {link.label}
          <ExternalIcon />
          <span className="sr-only">{NEW_TAB_SR}</span>
        </a>
      );
    // Cas 2 — route interne « /… » : navigation client next/link.
    case "interne":
      return (
        <Link href={link.href} className={`${styles.link} ${styles.linkActif}`}>
          {link.label}
        </Link>
      );
    // Cas 3 — AUCUNE destination ⇒ AUCUN lien (Story 5.5, dette R2).
    //
    // 🔴 Il rendait `<a href="#">` : un lien ACTIF, focalisable, qui REMONTE EN HAUT DE
    // PAGE au clic — mesuré par `gate:links` sur les 5 pages (« Mentions légales »,
    // 2327px → 0px). Le commentaire de `SOCIALS` l'appelait pourtant « tuile inerte » :
    // l'avertissement décrivait le défaut comme une garde, ce qui est pire qu'absent.
    //
    // Doctrine `PartnerWall` (Story 4.2) : ni `<a>` sans href, ni `role="link"` — pas
    // interactif du tout. Le libellé reste VISIBLE : les pages légales existeront, et
    // les faire disparaître aujourd'hui masquerait qu'elles restent à écrire.
    case "absente":
      return (
        <span className={styles.link} data-inerte="">
          {link.label}
        </span>
      );
  }
}

/**
 * 🔴 LES SIX RÉGLAGES ARRIVENT EN PROPS DEPUIS `(public)/layout.tsx` — STORY 6.13.
 *
 * Ce composant est un RSC et pourrait lire la base lui-même. Il ne le fait pas, pour la même
 * raison que partout ailleurs sur ce projet : **la page (ou le layout) requête, les composants
 * reçoivent** (patron AC1 de la 3.2). Le layout lit une fois pour le header ET le footer.
 */
export function SiteFooter({ reglages }: { reglages: Reglages }) {
  const PARTICIPER_LINKS = participerLinks(reglages.helloassoUrl);
  const SOCIALS = socials(reglages);

  return (
    <footer className={styles.footer}>
      <Wrap>
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
              // Largeur d'affichage réelle ≈ 53px (height 62px × ratio 339/393) →
              // évite que srcset serve un candidat pleine largeur (review 1.5 #3).
              sizes="54px"
              className={styles.logo}
            />
            <p className={styles.baseline}>
              Le jeu vidéo comme sport et comme lien social, à Reims et dans le Grand Est.
            </p>
          </div>

          {/* Colonne Naviguer.
              Titres de colonnes en <h2> (et non <h4>) : le footer est rendu sur
              toutes les pages publiques, dont le seul autre titre est le <h1> de
              la page → un <h4> créait un saut h1→h4 (audit Lighthouse
              `heading-order`, détecté en Story 1.6). Le niveau ne porte aucun
              style : la taille vient de `.colTitle`. */}
          <div className={styles.col}>
            <h2 className={styles.colTitle}>Naviguer</h2>
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
            <h2 className={styles.colTitle}>Participer</h2>
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
            <h2 className={styles.colTitle}>Suivez-nous</h2>
            <ul className={styles.socials}>
              {SOCIALS.map((social) => {
                const destination = classerDestination(social.href);

                // 🔴 AUCUNE destination ⇒ la tuile n'est plus un lien (Story 5.5, R2).
                // ⚠️ Et elle PERD son nom accessible, délibérément : un `aria-label` sur
                // un `<span>` sans `role` est ignoré par la plupart des lecteurs d'écran,
                // donc le garder fabriquerait une promesse muette. La tuile devient de la
                // DÉCORATION — elle n'annonce rien parce qu'elle ne fait rien.
                if (destination === "absente") {
                  return (
                    <li key={social.name}>
                      <span className={styles.social} data-inerte="" aria-hidden="true">
                        <SocialIcon icon={social.icon} />
                      </span>
                    </li>
                  );
                }

                const external = destination === "externe";
                return (
                  <li key={social.name}>
                    <a
                      href={social.href}
                      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className={`${styles.social} ${styles.socialActif}`}
                      aria-label={external ? `${social.name}${NEW_TAB_SR}` : social.name}
                    >
                      <SocialIcon icon={social.icon} />
                    </a>
                  </li>
                );
              })}
            </ul>
            {/* Email = mailto (pas « sortant » : pas de nouvel onglet ni annonce). */}
            <a href={`mailto:${reglages.contactEmail}`} className={styles.email}>
              {reglages.contactEmail}
            </a>
          </div>
        </div>

        {/* Bandeau bas : copyright + liens légaux (placeholders inertes). */}
        <div className={styles.copy}>
          {/* Année calculée au rendu (RSC) → pas de copyright périmé (review 1.5 #2). */}
          <span>© {new Date().getFullYear()} Esport des Sacres — association loi 1901, Reims</span>
          {/* Landmark dédié → navigation directe au lecteur d'écran (review 1.5 #5). */}
          <nav aria-label="Liens légaux" className={styles.legal}>
            {LEGAL_LINKS.map((link) => (
              <FooterColumnLink key={link.label} link={link} />
            ))}
          </nav>
        </div>
      </Wrap>
    </footer>
  );
}
