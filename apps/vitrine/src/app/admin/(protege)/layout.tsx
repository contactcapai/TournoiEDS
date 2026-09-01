import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/server/auth/config";
import { lireCompte } from "@/server/auth/guard";
import { sectionsPour } from "../_sections";
import { MenuAdmin } from "./_menu/MenuAdmin";
import styles from "./layout.module.css";
import { CHEMIN_CONNEXION } from "@/lib/auth/chemins";

// ══════════════════════════════════════════════════════════════════════════════════════
// COUCHE ② DE LA GARDE — le RENDU (Story 6.1, FR27, NFR4)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// Ce layout vit HORS du groupe (public) : il n'hérite donc ni de SiteHeader, ni de
// SiteFooter, ni du skip-link — ce que le layout public annonce explicitement. Il monte
// donc son propre chrome, son propre skip-link et son propre <main>.
//
// 🔴 POURQUOI LE GROUPE `(protege)` PLUTÔT QU'UN `app/admin/layout.tsx` — DÉFAUT RÉEL,
// TROUVÉ À L'ÉCRITURE. Un layout posé directement sur `app/admin/` s'appliquerait AUSSI à
// `/connexion` : un visiteur non connecté y serait redirigé vers `/connexion`, dont le
// rendu déclencherait de nouveau la garde, qui redirigerait encore — `ERR_TOO_MANY_REDIRECTS`,
// c'est-à-dire une page de connexion INATTEIGNABLE, donc un back-office définitivement
// fermé. Les groupes `(…)` n'affectent pas l'URL : `(protege)/page.tsx` sert bien `/admin`,
// et `login/` reste hors de la garde. Ne pas « simplifier » en remontant ce layout d'un cran.
//
// 🔴 POURQUOI PAS LE HEADER PUBLIC : sa navigation est celle du VISITEUR (Agenda, L'asso,
// Animations, Partenaires) et son CTA doré s'adresse à qui n'a pas encore de compte
// (« Créer mon profil », Story 12.4 — c'était « Nous rejoindre » vers HelloAsso jusque-là).
// L'un comme l'autre est un contresens une fois connecté au back-office. Ce n'est pas une
// économie de code qu'on refuse, c'est un contresens qu'on évite.
//
// ⚠️ Le back-office reste Esport des Sacres : tokens et primitives @repo/ui uniquement,
// aucun hex de charte en dur (project-context.md §5).

export const metadata: Metadata = {
  title: "Back-office",
  // Le back-office ne doit jamais être indexé : il n'a rien de public, et une URL
  // d'administration référencée est une invitation à la chercher.
  robots: { index: false, follow: false },
};

// 🔴 Lit la session à chaque requête — jamais de prérendu. Sans ça, Next tenterait de
// prérendre `/admin` au build, c'est-à-dire d'appeler `auth()` sans requête : le build
// échouerait, ou pire, figerait un rendu. Le build doit rester sûr SANS DATABASE_URL
// (garde-fou n°1 de la Story 1.7) — c'est ce qui tient la CI sans secret.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // 🔴 PREMIÈRE INSTRUCTION DU COMPOSANT, AVANT TOUTE LECTURE DE DONNÉES. Un layout qui
  // composerait l'écran puis redirigerait aurait déjà exécuté ses requêtes et, selon le
  // streaming, pu émettre du HTML : une redirection qui rend d'abord la page est une fuite.
  // `gate:admin` mesure le HTML SERVI, pas le code de statut, précisément pour ça.
  // ⚠️ AUCUN RÔLE EXIGÉ ICI, ET C'EST VOULU : ce layout habille AUSSI `/admin/refus`, la
  // page où atterrit justement un compte sans le bon rôle. Lui exiger un rôle l'y renverrait
  // en boucle. Ce qui protège chaque section, c'est le proxy et la garde de chaque page.
  const compte = await lireCompte();
  if (compte === null) redirect(CHEMIN_CONNEXION);

  // Le menu ne montre que ce qui s'ouvre — un lien vers une porte fermée est une porte sans
  // pièce. Ce filtre lit le MÊME champ `role` que la garde du proxy.
  const sections = sectionsPour(compte.roles);

  return (
    <div className={styles.shell}>
      <a className="sr-only skip-link" href="#content">
        Aller au contenu
      </a>

      {/* ══════════════════════════════════════════════════════════════════════════════════
          LA COLONNE LATÉRALE (arbitrage de Brice, 2026-08-25, d'après les planches Stitch)
          ══════════════════════════════════════════════════════════════════════════════════
          Le chrome était un EN-TÊTE HORIZONTAL : neuf entrées y poussaient le contenu vers
          le bas et ne hiérarchisaient rien. Une colonne tient les neuf sans concurrencer la
          page, et laisse la place aux familles et à la phrase de l'entrée courante.

          ⚠️ CE QUI N'EST PAS REPRIS DES PLANCHES, ET C'EST DÉLIBÉRÉ : le champ « Rechercher »,
          la cloche de notifications, le menu de compte en haut à droite et le pied de page
          « Mentions légales / Confidentialité / Contact ». AUCUNE de ces quatre choses
          n'existe dans le produit — les dessiner promettrait des fonctions absentes, ce que
          `_sections.ts` combat depuis deux occurrences (« une porte sans pièce »). */}
      <aside className={styles.rail}>
        {/* 🔴 LE BLOC DE MARQUE EST UN LIEN VERS `/admin` — IL NE L'A JAMAIS ÉTÉ (2026-08-25).
            C'est la convention que tout le monde essaie en premier, et elle ne répondait pas :
            le chrome ne contenait QUE les neuf liens de sections, on revenait au tableau de
            bord en tapant l'URL. ⚠️ Le lien ne se suffit PAS à lui-même — une marque cliquable
            est une affordance invisible, c'est exactement celle qui a échoué ici. L'entrée
            « Tableau de bord » du menu est la parade qui se VOIT ; celle-ci est la parade qui
            se DEVINE. Les deux, parce qu'elles ne servent pas la même personne. */}
        <Link className={styles.identite} href="/admin">
          {/* `/logo-eds-blanc.png` est déjà déclaré dans next.config.ts → localPatterns.
              ⚠️ Une image locale absente de cette liste répond 400 : c'est exactement la
              régression qui a fait disparaître le logo des 5 pages en Story 4.3, avec sept
              portes vertes. `pnpm gate:images` est le témoin. */}
          <Image
            src="/logo-eds-blanc.png"
            alt="Esport des Sacres"
            width={40}
            height={40}
            className={styles.logo}
            priority
          />
          <span className={styles.marque}>Back-office</span>
        </Link>

        {/* 🔴 LA NAVIGATION EST UN COMPOSANT CLIENT, ET CE LAYOUT RESTE UN RSC. Le menu a
            besoin de `usePathname()` pour marquer l'entrée courante — un RSC ne connaît pas
            la route, et c'est exactement pourquoi le menu ne la marquait PAS jusqu'ici. La
            frontière client reste MINIMALE : ce layout lit la session et filtre par rôle,
            `MenuAdmin` ne reçoit que des sections déjà triées.
            ⚠️ Le <nav> disparaît de lui-même quand il n'y a rien à montrer (compte sans
            rôle) — c'est alors le tableau de bord qui explique la situation. */}
        <MenuAdmin sections={sections} />

        {/* 🔴 EN BAS DE COLONNE, ET SÉPARÉ DU MENU PAR UN `margin-top: auto`. Ce n'est pas
            une section : c'est qui vous êtes et comment partir. Le ranger parmi les liens de
            navigation ferait de « Se déconnecter » une destination de plus. */}
        <div className={styles.compte}>
          <span className={styles.nom}>{compte.nom ?? "Mon compte"}</span>
          {/* 🔴 « MON PROFIL » EST ICI, AVEC LE COMPTE, ET PAS DANS LE MENU DES SECTIONS
              (Story 12.1). Ce n'est pas une section du back-office : c'est la même page que
              voit un participant, et `_sections.ts` la rangerait sous un rôle — or elle est
              ouverte à TOUT compte connecté. C'est le raisonnement exact tenu pour `/admin`
              lui-même en PR #81, et il vaut ici pour la raison inverse : elle n'est même pas
              sous `/admin`.
              ⚠️ Sans cette entrée, un administrateur n'avait AUCUN chemin vers son profil :
              les deux portes posées par la 12.1 (l'état vide du tableau de bord et la page
              de refus) ne s'affichent QUE pour un compte SANS rôle. */}
          <Link className={styles.lienProfil} href="/profil">
            Mon profil
          </Link>
          {/* Server Action en ligne : aucun composant client n'est nécessaire pour un
              bouton qui poste un formulaire. RSC par défaut (project-context.md §5).
              ⚠️ PAS de `exigerRoleAction()` ici, et c'est délibéré : se déconnecter ne doit
              jamais dépendre du droit d'entrer. Un compte dont on a retiré les rôles doit
              pouvoir fermer sa session, pas s'y retrouver coincé. */}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: CHEMIN_CONNEXION });
            }}
          >
            <button className={styles.deconnexion} type="submit">
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      <main className={styles.contenu} id="content">
        {children}
      </main>
    </div>
  );
}
