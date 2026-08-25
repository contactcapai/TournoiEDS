import type { Metadata } from "next";
import Image from "next/image";

import { signIn } from "@/server/auth/config";
import { lireCompte } from "@/server/auth/guard";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

// Page de connexion du back-office (Story 6.1, FR26).
//
// 🔴 SEULE ROUTE SOUS /admin QUI RESTE OUVERTE, ET ELLE L'EST À DEUX ENDROITS QUI DOIVENT
// RESTER D'ACCORD :
//   ① `proxy.ts` la laisse passer explicitement (`pathname === "/admin/login"`) ;
//   ② elle vit HORS du groupe `(protege)`, donc hors de la garde du layout.
// Si l'une des deux exemptions disparaît, la page de connexion devient inatteignable
// (boucle de redirection) et le back-office est définitivement fermé. `gate:admin` mesure
// ce point précis : `/admin/login` doit répondre 200 SANS session.
//
// Elle n'a donc aucun chrome d'administration : elle rend son propre <main>.

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Messages d'erreur du flux OAuth, en français et lisibles par un bénévole.
 *
 * ⚠️ Les clés sont celles d'Auth.js (`?error=…`), qui les pose lui-même sur cette page
 * grâce à `pages.error` dans la configuration. Sans cette table, un refus d'allowlist
 * afficherait `AccessDenied` brut — un code technique, à quelqu'un qui n'en peut rien.
 */
const MESSAGES_ERREUR: Record<string, string> = {
  AccessDenied:
    "Ce compte Discord n’est pas autorisé à accéder au back-office. Si c’est une erreur, demande à ce que ton identifiant soit ajouté.",
  Configuration:
    "La connexion Discord n’est pas configurée correctement côté serveur. Rien à faire de ton côté : c’est un réglage à corriger.",
  Verification: "Ce lien de connexion n’est plus valable. Relance la connexion.",
};

const MESSAGE_ERREUR_PAR_DEFAUT =
  "La connexion n’a pas abouti. Réessaie, et si ça recommence, signale-le.";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  // `searchParams` est une promesse depuis Next 15 — l'oublier ne casse pas toujours la
  // compilation, d'où l'`await` explicite (même garde-fou que `headers()` en Story 5.1).
  const params = await searchParams;

  // Déjà connecté ⇒ on ne montre pas un écran de connexion, on emmène au back-office.
  // Sans ça, revenir sur /admin/login avec une session valide afficherait un bouton
  // « Se connecter » trompeur.
  const compte = await lireCompte();
  if (compte !== null) redirect("/admin");

  const messageErreur =
    params.error === undefined
      ? null
      : (MESSAGES_ERREUR[params.error] ?? MESSAGE_ERREUR_PAR_DEFAUT);

  // 🔴 La destination de retour est BORNÉE à un chemin interne sous /admin. Reprendre
  // `params.next` tel quel ferait de cette page un redirecteur ouvert : `?next=https://…`
  // enverrait le visiteur sur un site tiers depuis une URL du domaine, ce qui est le
  // montage classique d'un hameçonnage. On n'accepte donc qu'un chemin relatif à nous.
  //
  // ⚠️ Le rejet de `..` a été ajouté après revue (Blind Hunter + Edge Case Hunter) : la
  // première version acceptait `?next=/admin/../../ailleurs`, qui satisfait bien le préfixe
  // `/admin/`. Les deux revues ont conclu, et la vérification l'a confirmé, que cela ne
  // permet PAS de sortir de l'origine — mais une garde dont il faut raisonner à deux
  // détentes pour se convaincre n'est pas une garde. On refuse le segment, point.
  const suite = params.next;
  const destination =
    typeof suite === "string" &&
    /^\/admin(?:\/|$)/.test(suite) &&
    !suite.startsWith("//") &&
    !suite.includes("..") &&
    !suite.includes("\\")
      ? suite
      : "/admin";

  return (
    <main className={styles.ecran} id="content">
      <div className={styles.carte}>
        <Image
          src="/logo-eds-blanc.png"
          alt="Esport des Sacres"
          width={56}
          height={56}
          className={styles.logo}
          priority
        />

        <h1 className={styles.titre}>Back-office</h1>
        <p className={styles.chapo}>
          L&rsquo;espace de gestion du site. Réservé à l&rsquo;équipe de
          l&rsquo;association.
        </p>

        {messageErreur !== null && (
          /* `role="alert"` : le message apparaît après un aller-retour vers Discord, donc
             hors du champ de vision d'un lecteur d'écran s'il n'est pas annoncé. */
          <p className={styles.erreur} role="alert">
            {messageErreur}
          </p>
        )}

        {/* Server Action en ligne : un bouton qui poste un formulaire n'a besoin d'aucun
            composant client. RSC par défaut (project-context.md §5).
            ⚠️ Fonctionne donc SANS JavaScript — c'est un vrai <form>, pas un onClick. */}
        <form
          action={async () => {
            "use server";
            await signIn("discord", { redirectTo: destination });
          }}
        >
          <button className={styles.bouton} type="submit">
            Se connecter avec Discord
          </button>
        </form>

        <p className={styles.aide}>
          La connexion passe par le compte Discord de l&rsquo;écosystème EDS. Le site
          public, lui, reste accessible à tous sans connexion.
        </p>
      </div>
    </main>
  );
}
