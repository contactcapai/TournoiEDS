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
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 PLUS AUCUN LIEN DE CETTE BARRE N'EST SORTANT — STORY 9.4
// ══════════════════════════════════════════════════════════════════════════════════════
//
// « Tournois » portait `external: true` **en littéral**, et c'était le seul. Depuis que
// `TOURNOI_URL` vaut `/tournois` (Story 9.4), ce drapeau devait partir AVEC la valeur, et pas
// après : c'est LUI, et non l'URL, qui choisit la branche de rendu de `renderNavLink`.
//
// 🔴 CE QUE SON OUBLI AURAIT PRODUIT, ET POURQUOI ÇA SERAIT PASSÉ INAPERÇU : les trois
// attributs de lien sortant (onglet, icône, mention SR) se DÉRIVENT de `classerDestination`,
// donc ils auraient bien disparu — le témoin annoncé par `epics.md` serait passé au vert. Mais
// le lien serait resté un `<a>` NU : rechargement complet de la page à chaque clic, sur les
// 7 pages, et JAMAIS d'`aria-current="page"`. ⚠️ Aucune porte ne voyait ça — `gate:links` ne
// distingue pas un `<a>` d'un `next/link`, `gate` ne mesure que des largeurs, et Lighthouse ne
// l'exige pas. Le témoin annoncé passait donc au vert EN MÊME TEMPS que le défaut naissait.
// ⇒ La garde ⑧ de `gate:links` existe exactement pour ça, et elle est GÉNÉRIQUE : tout lien de
// cette liste dont l'`href` commence par `/` doit être géré par le routeur client.
//
// ⚠️ LE CHAMP `external?` RESTE DANS `NavLink`, ET C'EST DÉLIBÉRÉ : il est la seule chose qui
// distingue les deux branches de `renderNavLink`, et un lien de nav pourra redevenir sortant.
// Le supprimer « puisque plus personne ne s'en sert » retirerait la branche, donc obligerait à
// la réécrire — c'est le patron de l'exemption qu'on ne retire pas (garde ② de `gate:links`).
//
// Discord et le CTA « Nous rejoindre », eux, restent sortants : ils sont rendus à part dans
// MobileMenu, depuis les réglages du site (Story 6.13).
const NAV_LINKS: NavLink[] = [
  { label: "Accueil", href: "/" },
  { label: "Agenda", href: "/agenda" },
  { label: "Animations", href: "/animations" },
  { label: "Tournois", href: TOURNOI_URL },
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
  /**
   * Ce que le chrome sait de la session (Story 12.1) — **deux booléens, et rien d'autre**.
   *
   * 🔴 PAS DE `roles`, PAS D'IDENTIFIANT, PAS DE NOM. Ces props traversent jusqu'à `MobileMenu`,
   * qui porte `'use client'` : tout ce qu'on y met part dans le bundle du navigateur. Le menu
   * n'a pas à connaître une notion d'autorisation, seulement **s'il existe une porte à
   * montrer** — la décision, elle, se prend côté serveur où les rôles se relisent en base.
   */
  session: { connecte: boolean; aDesRoles: boolean };
}

export function SiteHeader({ discordUrl, helloassoUrl, session }: SiteHeaderProps) {
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

        <MobileMenu
          links={NAV_LINKS}
          discordUrl={discordUrl}
          helloassoUrl={helloassoUrl}
          session={session}
        />
      </Wrap>
    </header>
  );
}
