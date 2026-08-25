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
  // ⚠️ RÉÉCRIT PAR LA STORY 8.1. Il disait « ce compte Discord n'est pas autorisé à accéder
  // au back-office » — FAUX depuis que se connecter et avoir un accès sont deux faits
  // distincts. Se connecter réussit désormais pour tout le monde ; ce qui manque ensuite est
  // un RÔLE, et ça se dit sur `/admin/refus`, pas ici.
  AccessDenied:
    "La connexion a été refusée par le fournisseur. Réessaie, et si ça recommence, signale-le.",
  Configuration:
    "Ce moyen de connexion n’est pas configuré correctement côté serveur. Rien à faire de ton côté : c’est un réglage à corriger.",
  Verification:
    "Ce lien de connexion n’est plus valable : il a déjà servi, ou il a expiré. Demande-en un nouveau ci-dessous.",
  // 🔴 Ne devrait plus arriver depuis que la liaison par adresse vérifiée est activée
  // (`allowDangerousEmailAccountLinking`). Le message reste : si ce cas revenait, il faut
  // qu'il soit lisible plutôt que muet — et il nous dirait que le réglage a sauté.
  OAuthAccountNotLinked:
    "Cette adresse est déjà rattachée à un autre moyen de connexion. Utilise celui avec lequel tu t’es connecté la première fois.",
  EmailSignin:
    "L’envoi du lien de connexion a échoué. Vérifie l’adresse saisie, puis réessaie.",
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

        {/* ══════════════════════════════════════════════════════════════════════════════
            TROIS MOYENS, UN SEUL ACCENT DORÉ — ET C'EST DÉLIBÉRÉ
            ══════════════════════════════════════════════════════════════════════════════
            Trois boutons `--gold` empilés ne hiérarchisent plus rien : l'accent ne veut dire
            quelque chose que s'il est rare (leçon des 4 boutons or × 64 lignes, 13.1).
            Discord reste l'entrée principale — c'est celle de l'équipe aujourd'hui ; Google
            et le lien magique sont des portes secondaires, tracées et non remplies.
            ⚠️ Les trois fonctionnent SANS JavaScript : ce sont de vrais <form>, pas des
            onClick. Un back-office qui exigerait JS pour se connecter serait injoignable au
            pire moment. */}
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

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: destination });
          }}
        >
          <button className={styles.boutonSecondaire} type="submit">
            Se connecter avec Google
          </button>
        </form>

        <p className={styles.separateur}>
          <span>ou par e-mail</span>
        </p>

        {/* 🔴 `signIn("nodemailer")` ET NON `signIn("email")` : l'identifiant du fournisseur
            est celui du module importé dans `auth/config.ts`. `email` est l'ancien nom,
            déprécié dans Auth.js v5 — et un identifiant inconnu échoue à l'exécution, pas à
            la compilation. */}
        <form
          className={styles.formEmail}
          action={async (formData: FormData) => {
            "use server";
            await signIn("nodemailer", {
              email: String(formData.get("email") ?? ""),
              redirectTo: destination,
            });
          }}
        >
          <label className={styles.etiquette} htmlFor="email">
            Votre adresse e-mail
          </label>
          <input
            className={styles.champ}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="prenom@exemple.fr"
          />
          <button className={styles.boutonSecondaire} type="submit">
            Recevoir un lien de connexion
          </button>
        </form>

        <p className={styles.aide}>
          Peu importe le moyen&nbsp;: si l&rsquo;adresse est la même, c&rsquo;est le même
          compte. Le site public, lui, reste accessible à tous sans connexion.
        </p>
      </div>
    </main>
  );
}
