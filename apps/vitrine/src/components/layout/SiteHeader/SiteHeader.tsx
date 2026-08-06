import Image from "next/image";
import Link from "next/link";
import { TOURNOI_URL } from "@/lib/links";
import { Wrap } from "@/components/common/Wrap/Wrap";
import { MobileMenu, type NavLink } from "../MobileMenu/MobileMenu";
import styles from "./SiteHeader.module.css";

// En-tête persistant de la vitrine (Server Component — Garde-fou n°4).
// Pose le landmark <header> sticky + le logo (retour Home). La nav, le menu
// mobile, le lien actif (usePathname) et le toggle hamburger vivent dans
// <MobileMenu> (frontière client minimale). Les liens sont des données statiques
// définies ICI (RSC) et passées en props sérialisables (chaînes).
//
// Ordre nav imposé (EXPERIENCE.md / AC, ≠ maquette qui omet « Accueil ») :
// Accueil · Agenda · Animations · Tournois · L'asso · Partenaires.
// Seul « Tournois » est sortant ici (Discord + CTA « Nous rejoindre » sont
// rendus à part dans MobileMenu, eux aussi sortants).
const NAV_LINKS: NavLink[] = [
  { label: "Accueil", href: "/" },
  { label: "Agenda", href: "/agenda" },
  { label: "Animations", href: "/animations" },
  { label: "Tournois", href: TOURNOI_URL, external: true },
  { label: "L'asso", href: "/l-asso" },
  { label: "Partenaires", href: "/partenaires" },
];

/**
 * 🔴 LES DEUX DESTINATIONS ARRIVENT EN PROPS DEPUIS LE LAYOUT — STORY 6.13.
 *
 * Ce composant ne les lit pas lui-même, et il ne le pourra jamais pour l'une des deux : c'est
 * `MobileMenu`, un composant CLIENT, qui les rend, et un module `server-only` ne peut pas y
 * être importé. Le layout lit une fois et distribue (patron AC1 de la 3.2).
 */
export interface SiteHeaderProps {
  /** Invitation Discord, ou `DESTINATION_ABSENTE` — voir `lireReglages()`. */
  discordUrl: string;
  /** Page d'adhésion HelloAsso, ou `DESTINATION_ABSENTE`. */
  helloassoUrl: string;
}

export function SiteHeader({ discordUrl, helloassoUrl }: SiteHeaderProps) {
  return (
    <header className={styles.header}>
      <Wrap className={styles.row}>
        <Link href="/" className={styles.logo} aria-label="Esport des Sacres — accueil">
          {/* Dimensions intrinsèques (339×393) pour l'aspect-ratio anti-CLS ;
              la hauteur d'affichage (~48px, maquette) est imposée en CSS. */}
          <Image
            src="/logo-eds-blanc.png"
            alt="Esport des Sacres"
            width={339}
            height={393}
            priority
            className={styles.logoImg}
          />
        </Link>

        <MobileMenu links={NAV_LINKS} discordUrl={discordUrl} helloassoUrl={helloassoUrl} />
      </Wrap>
    </header>
  );
}
