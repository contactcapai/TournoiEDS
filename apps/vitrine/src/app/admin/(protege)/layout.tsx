import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/server/auth/config";
import { lireAdmin } from "@/server/auth/guard";
import { SECTIONS_ADMIN } from "../_sections";
import styles from "./layout.module.css";

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
// `/admin/login` : un visiteur non connecté y serait redirigé vers `/admin/login`, dont le
// rendu déclencherait de nouveau la garde, qui redirigerait encore — `ERR_TOO_MANY_REDIRECTS`,
// c'est-à-dire une page de connexion INATTEIGNABLE, donc un back-office définitivement
// fermé. Les groupes `(…)` n'affectent pas l'URL : `(protege)/page.tsx` sert bien `/admin`,
// et `login/` reste hors de la garde. Ne pas « simplifier » en remontant ce layout d'un cran.
//
// 🔴 POURQUOI PAS LE HEADER PUBLIC : sa navigation est celle du VISITEUR (Agenda, L'asso,
// Animations, Partenaires) et son CTA est « Nous rejoindre » — une invitation à adhérer,
// absurde une fois connecté au back-office. Ce n'est pas une économie de code qu'on
// refuse, c'est un contresens qu'on évite.
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
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  return (
    <div className={styles.shell}>
      <a className="sr-only skip-link" href="#content">
        Aller au contenu
      </a>

      <header className={styles.head}>
        <div className={styles.identite}>
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
        </div>

        {/* Navigation LUE DEPUIS LE REGISTRE, jamais écrite en dur. Vide au merge de la
            6.1 : `SECTIONS_ADMIN` ne porte encore aucune entrée, et le <nav> disparaît
            plutôt que de rendre une liste vide — un menu vide ressemble à une panne. */}
        {SECTIONS_ADMIN.length > 0 && (
          <nav className={styles.nav} aria-label="Sections du back-office">
            <ul className={styles.navListe}>
              {SECTIONS_ADMIN.map((section) => (
                <li key={section.href}>
                  <Link className={styles.navLien} href={section.href}>
                    {section.libelle}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className={styles.compte}>
          <span className={styles.nom}>{admin.nom ?? "Administrateur"}</span>
          {/* Server Action en ligne : aucun composant client n'est nécessaire pour un
              bouton qui poste un formulaire. RSC par défaut (project-context.md §5).
              ⚠️ PAS de `requireAdmin()` ici, et c'est délibéré : se déconnecter ne doit
              jamais dépendre du droit d'entrer. Un compte retiré de l'allowlist doit
              pouvoir fermer sa session, pas s'y retrouver coincé. */}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/admin/login" });
            }}
          >
            <button className={styles.deconnexion} type="submit">
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      <main className={styles.contenu} id="content">
        {children}
      </main>
    </div>
  );
}
