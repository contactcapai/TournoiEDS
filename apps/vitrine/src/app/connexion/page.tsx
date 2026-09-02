import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { signIn } from "@/server/auth/config";
import { lireCompte } from "@/server/auth/guard";
import { redirect } from "next/navigation";

import { destinationApresConnexion } from "@/lib/auth/retour";
import styles from "./page.module.css";

// Page de connexion du site (Story 6.1 pour le back-office, RÉÉCRITE PAR LA 12.4 pour tous).
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE N'EST PLUS « LA PAGE DU BACK-OFFICE », ET C'EST TOUTE LA STORY 12.4
// ══════════════════════════════════════════════════════════════════════════════════════
//
// Elle vivait en `/admin/login` et s'intitulait « Back-office — réservé à l'équipe de
// l'association ». C'était vrai tant que seule l'équipe avait une raison de se connecter. La
// 12.2 (« j'y serai ») et la 12.3 (s'inscrire à un tournoi) en ont donné une à tout le monde,
// et les deux boutons envoient ICI : un joueur qui cliquait « S'inscrire » lisait donc, au
// moment précis où il voulait entrer, qu'il n'avait rien à faire là.
// ⚠️ La mécanique, elle, marchait déjà (`retour.ts` accepte `/tournois/…` depuis la 12.2).
// C'était l'ÉNONCÉ qui était faux — 3ᵉ occurrence du motif « un contrat tenu dont on ne
// réécrit pas l'énoncé devient un faux témoin ».
//
// 🔴 ELLE EST SORTIE DE `/admin` PLUTÔT QUE RENOMMÉE SUR PLACE : l'URL se lit dans la barre
// d'adresse ET dans l'e-mail du lien magique. Un chemin qui dit « admin » à un joueur dément
// l'écran qu'il ouvre. Les deux chemins hérités sont redirigés (`next.config.ts`).
//
// ⚠️ ELLE EST HORS DU GROUPE `(public)`, DONC SANS CHROME DE SITE : ni en-tête ni pied de
// page. C'est délibéré — le CTA du chrome mène désormais ici, et l'afficher donnerait un
// bouton pointant la page qu'on regarde. Le retour au site est explicite, en bas de la carte.
// ⚠️ Elle est aussi hors du matcher du proxy (`/admin/:path*`), donc ouverte par construction,
// et `gate` la mesure comme n'importe quelle page publique — ce qu'il ne pouvait pas faire
// sous `/admin`.

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

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  // `searchParams` est une promesse depuis Next 15 — l'oublier ne casse pas toujours la
  // compilation, d'où l'`await` explicite (même garde-fou que `headers()` en Story 5.1).
  const params = await searchParams;

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
  // 🔴 LA RÈGLE VIT DÉSORMAIS DANS `lib/auth/retour.ts`, ET ELLE EST TESTÉE (Story 12.2).
  // Elle bornait `next` à `/admin/…`, ce qui était juste tant que SEUL un administrateur avait
  // une raison de se connecter. « J'y serai » en donne une à tout le monde : sans lever la
  // borne, quelqu'un qui se connecte depuis l'agenda atterrirait sur `/admin`, c'est-à-dire
  // nulle part pour lui.
  // ⚠️ LA GARDE N'EST PAS RELÂCHÉE, ELLE EST RENDUE EXPLICITE : une LISTE FERMÉE de racines
  // internes remplace l'expression régulière, et les quatre refus qui ont coûté deux revues
  // (URL absolue, `//`, `..`, `\`) sont conservés mot pour mot. Douze tests les figent.
  const destination = destinationApresConnexion(params.next);

  // 🔴 DÉJÀ CONNECTÉ ⇒ ON L'EMMÈNE OÙ IL ALLAIT, ET C'EST UN CORRECTIF DE LA 12.4. Cette
  // garde disait `redirect("/admin")` : quelqu'un qui arrivait ici avec une session valide et
  // `?next=/tournois/le-tournoi` PERDAIT sa destination et atterrissait sur le tableau de
  // bord — c'est-à-dire nulle part, pour un joueur. Le défaut était invisible tant que seuls
  // des administrateurs se connectaient : leur destination par défaut ÉTAIT `/admin`.
  // ⚠️ Le calcul de `destination` doit donc rester AVANT cette garde, jamais après.
  const compte = await lireCompte();
  if (compte !== null) redirect(destination);

  return (
    <main className={styles.ecran} id="content">
      <div className={styles.carte}>
        <Link href="/" className={styles.logoLien} aria-label="Esport des Sacres — accueil">
          <Image
            src="/logo-eds-blanc.png"
            alt="Esport des Sacres"
            width={56}
            height={56}
            className={styles.logo}
            priority
          />
        </Link>

        {/* 🔴 UN SEUL ÉNONCÉ POUR DEUX PUBLICS, ET IL SE TOURNE VERS CELUI QUI N'A RIEN.
            Le titre disait « Back-office » et le chapô « réservé à l'équipe de
            l'association » : lu par un joueur qui vient de cliquer « S'inscrire », c'est un
            refus. Lu par un bénévole, « Connexion » ne lui retire rien — il sait ce qu'il
            vient faire, et son back-office l'attend derrière.
            🔴 LA SECONDE PHRASE EST LA PLUS IMPORTANTE DE L'ÉCRAN : il n'existe AUCUN
            formulaire d'inscription dans ce projet — les trois moyens créent le compte au
            premier passage (Auth.js). Sans la dire, celui qui n'a pas de compte cherche un
            bouton « créer un compte » qui n'existera jamais, et repart. */}
        <h1 className={styles.titre}>Connexion</h1>
        <p className={styles.chapo}>
          Pour vous inscrire à un tournoi, annoncer votre venue un jeudi, ou gérer le site si
          vous êtes de l&rsquo;équipe.
          <br />
          {/* `{" "}` explicite : l'espace après </strong> était AVALÉE au rendu
              (« ?Votre », mesuré sur staging) — piège jsx-espace-avalee, même
              correctif que la PR #90. */}
          <strong>Première fois&nbsp;?</strong>{" "}
          Votre compte se crée tout seul en vous
          connectant&nbsp;: il n&rsquo;y a rien d&rsquo;autre à remplir.
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
            Discord reste l'entrée principale, et la 12.4 ne la déplace pas : c'est celle de
            l'équipe, et c'est aussi là que vit la communauté de joueurs — le compte qu'ils ont
            déjà. Google et le lien magique restent des portes secondaires.
            ✅ L'APPLICATION CLOUD « OAUTH EDS » EST PUBLIÉE DEPUIS LE 2026-09-01 : Google
            s'ouvre à tout le monde. Ce bloc portait jusque-là « Google rend un 403 à qui n'est
            pas utilisateur test » — vrai pendant six epics, et faux à la minute où l'état a
            changé. ⚠️ Un avertissement honoré qu'on laisse en place devient un faux témoin :
            la prochaine lecture croirait Google encore fermé et déconseillerait ce bouton.
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

        {/* 🔴 LA SECONDE PHRASE A ÉTÉ RETIRÉE, PAS RÉÉCRITE. Elle disait « le site public,
            lui, reste accessible à tous sans connexion » — vraie, et pourtant un contresens
            adressée à quelqu'un qui vient de cliquer « S'inscrire » : elle lui explique qu'il
            n'a pas besoin d'être là. Une phrase vraie qui se lit comme un renvoi vaut une
            phrase fausse (leçon des PR #90 et #100). */}
        <p className={styles.aide}>
          Peu importe le moyen&nbsp;: si l&rsquo;adresse est la même, c&rsquo;est le même
          compte.
        </p>

        {/* ⚠️ RETOUR EXPLICITE, ET PAS SEULEMENT LE LOGO. Cette page n'a pas le chrome du
            site : sans ce lien, la seule sortie serait le bouton « précédent » du navigateur.
            Le logo est cliquable lui aussi, mais une marque cliquable seule est une affordance
            invisible — précisément celle qui a échoué en 13.2 (PR #81). Deux parades pour deux
            personnes différentes. */}
        <p className={styles.retour}>
          <Link href="/">Retour au site</Link>
        </p>
      </div>
    </main>
  );
}
