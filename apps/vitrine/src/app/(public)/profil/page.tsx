import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import { MesInscriptions } from "@/components/profil/MesInscriptions/MesInscriptions";
import { MonProfil } from "@/components/profil/MonProfil/MonProfil";
import { cleanText } from "@/lib/text";
import { supprimerMonCompte } from "@/server/actions/profil";
import { exigerConnexionPage } from "@/server/auth/guard";
import { signOut } from "@/server/auth/config";
import { lireProfilComplet } from "@/server/db/queries/profil";
import {
  getInscriptionsAReclamer,
  getMesInscriptions,
} from "@/server/db/queries/rattachement";
import editorial from "@/styles/editorial.module.css";
import styles from "./page.module.css";
import { CHEMIN_CONNEXION } from "@/lib/auth/chemins";

// ══════════════════════════════════════════════════════════════════════════════════════
// MON PROFIL (Story 12.1) — LA PREMIÈRE SURFACE AUTHENTIFIÉE **HORS `/admin`** DU SITE
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 SA GARDE VIT DANS LA PAGE, ET C'EST OBLIGATOIRE. Le proxy est fail-closed **sous `/admin`
// uniquement** : il dérive son exigence de `SECTIONS_ADMIN` et ne se prononce sur rien d'autre.
// Une page posée ici n'est donc couverte par RIEN — `exigerConnexionPage()` en première
// instruction est la seule chose qui la protège.
//
// 🔴 ELLE VIT DANS LE GROUPE `(public)`, ET C'EST VOULU : un participant doit retrouver l'en-tête
// et le pied du site, pas le chrome du back-office. « Authentifiée » et « publique » ne sont pas
// contraires — la seconde décrit le PUBLIC visé, la première la porte d'entrée.
//
// ⚠️ **ELLE N'ENTRE PAS DANS `GATE_PAGES`**, et c'est la même limite que celle écrite pour le
// back-office (13.2) : la porte visuelle interroge en HTTP **nu, sans cookie**. Elle recevrait la
// redirection vers la connexion et mesurerait la page de login **en croyant mesurer le profil** —
// un vert sur un écran jamais vu. Mieux vaut l'angle mort déclaré qu'une mesure fausse.

/**
 * ⚠️ `noindex, nofollow` : cette page sert des données personnelles. Même valeur que les aperçus
 * du back-office — et ici la redirection la protégerait de toute façon, mais un robot qui suit un
 * lien n'a aucune raison de l'indexer.
 */
export const metadata: Metadata = {
  title: "Mon profil",
  robots: { index: false, follow: false },
};

/**
 * 🔴 DYNAMIQUE ET SANS CACHE : ce qui s'affiche dépend de la SESSION. Un cache la partagerait
 * entre visiteurs — c'est-à-dire montrerait le profil de quelqu'un d'autre.
 */
export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  // 🔴 EN PREMIÈRE INSTRUCTION, AVANT TOUTE LECTURE : une page qui composerait son écran puis
  // redirigerait aurait déjà exécuté ses requêtes et, selon le streaming, pu émettre du HTML.
  const compte = await exigerConnexionPage();

  const donnees = await lireProfilComplet(compte.utilisateurId);
  // ⚠️ EN PARALLÈLE : ces deux lectures ne dépendent pas l'une de l'autre, et la seconde lit
  // tout le plateau non réclamé — les enchaîner doublerait l'attente pour rien.
  const [rattachees, suggestions] = await Promise.all([
    getMesInscriptions(compte.utilisateurId),
    getInscriptionsAReclamer(compte.utilisateurId),
  ]);
  // La session existe mais la ligne `user` a disparu (suppression concurrente, restauration) :
  // on ne rend pas une page à moitié, on renvoie se reconnecter.
  if (!donnees) redirect(CHEMIN_CONNEXION);

  /**
   * ⚠️ ENVELOPPÉE ICI PLUTÔT QU'APPELÉE DEPUIS LE CLIENT : `signOut()` écrit des en-têtes, ce
   * qu'une Server Action invoquée depuis un composant client ne peut pas faire. La suppression et
   * la déconnexion doivent pourtant s'enchaîner — laisser la session vivre après la suppression
   * du compte donnerait une navigation entière sur un compte qui n'existe plus.
   */
  async function supprimerPuisDeconnecter() {
    "use server";
    const resultat = await supprimerMonCompte();
    if (!resultat.ok) return;
    await signOut({ redirectTo: "/" });
  }

  // `cleanText` : dernier filet contre une écriture qui contournerait Zod ET les `CHECK` —
  // `btrim` ne retire pas U+200B, et un champ fait uniquement de caractères sans largeur doit
  // compter comme ABSENT (dette R41).
  const profil = {
    pseudo: cleanText(donnees.profil.pseudo),
    discordPseudo: cleanText(donnees.profil.discordPseudo),
    riotId: cleanText(donnees.profil.riotId),
    steamId: cleanText(donnees.profil.steamId),
    epicId: cleanText(donnees.profil.epicId),
  };

  return (
    <>
      <section className={editorial.head} aria-labelledby="profil-title">
        <Wrap>
          <SectionHead
            headingLevel={1}
            titleId="profil-title"
            eyebrow="Mon espace"
            title="Mon profil"
          />
          <p className={styles.chapo}>
            Ce que vous déclarez ici sert à vous <strong>reconnaître en jeu</strong> et à vous{" "}
            <strong>joindre</strong> — notamment pour vous inviter dans un lobby un jour de
            tournoi. Tout est facultatif.
          </p>
        </Wrap>
      </section>

      <section className={editorial.section} aria-labelledby="identite-title">
        <Wrap>
          <SectionHead
            headingLevel={2}
            titleId="identite-title"
            eyebrow="Vous"
            title="Vos identifiants"
          />
          <MonProfil onSupprimer={supprimerPuisDeconnecter} profil={profil} />
        </Wrap>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════════
          MES TOURNOIS — ET CE QUI POURRAIT ÊTRE À MOI (Story 12.1, 2/2)
          ══════════════════════════════════════════════════════════════════════════════
          🔴 LE CHAPÔ EXPLIQUE D'OÙ VIENNENT LES PROPOSITIONS, et c'est indispensable : une
          liste d'inscriptions apparue sans raison sous le nom de quelqu'un ressemble à une
          fuite. Elle vient de SES pseudos déclarés, et rien n'est rattaché sans qu'un
          bénévole le valide. */}
      <section className={editorial.section} aria-labelledby="inscriptions-title">
        <Wrap>
          <SectionHead
            headingLevel={2}
            titleId="inscriptions-title"
            eyebrow="Vos tournois"
            title="Vos inscriptions"
          />
          <p className={styles.chapoSection}>
            Une inscription prise par un bénévole ou via MATELY ne connaît pas votre compte —
            elle vit <strong>non réclamée</strong> jusqu&rsquo;à ce que vous la reconnaissiez.
            {suggestions.cles.length === 0
              ? " Déclarez vos pseudos ci-dessus pour qu'on puisse vous proposer les vôtres."
              : " Celles qui portent l'un de vos pseudos vous sont proposées ci-dessous."}
          </p>
          <MesInscriptions proposees={suggestions.inscriptions} rattachees={rattachees} />
        </Wrap>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════════════
          COMMENT VOUS VOUS CONNECTEZ — CONSTATÉ, JAMAIS SAISI
          ══════════════════════════════════════════════════════════════════════════════
          ⚠️ CETTE SECTION NE SE MODIFIE PAS, et c'est ce qui la distingue de la précédente :
          ce qui prouve qui vous êtes vit dans `account` (Auth.js) et se change en se
          connectant autrement, jamais par un formulaire.
          🔴 LE LIEN MAGIQUE N'A AUCUNE LIGNE DANS `account` — c'est le contrat d'Auth.js,
          seuls les fournisseurs OAuth y figurent. Une liste vide serait donc le cas NORMAL de
          quelqu'un qui n'utilise que son adresse, et l'afficher telle quelle ressemblerait à
          une panne. On l'écrit. */}
      <section className={editorial.section} aria-labelledby="connexion-title">
        <Wrap>
          <SectionHead
            headingLevel={2}
            titleId="connexion-title"
            eyebrow="Votre compte"
            title="Comment vous vous connectez"
          />

          <dl className={styles.connexion}>
            <div className={styles.ligne}>
              <dt className={styles.terme}>Adresse</dt>
              <dd className={styles.valeur}>{donnees.compte.email ?? "—"}</dd>
            </div>
            <div className={styles.ligne}>
              <dt className={styles.terme}>Comptes liés</dt>
              <dd className={styles.valeur}>
                {donnees.moyens.length > 0
                  ? donnees.moyens.map((moyen) => LIBELLE_MOYEN[moyen] ?? moyen).join(", ")
                  : "Aucun — vous vous connectez par lien magique, envoyé à votre adresse."}
              </dd>
            </div>
          </dl>

          <p className={styles.aideConnexion}>
            Pour lier un autre moyen, déconnectez-vous et reconnectez-vous avec lui&nbsp;: les
            comptes qui partagent votre adresse se rattachent automatiquement.
          </p>
        </Wrap>
      </section>
    </>
  );
}

/**
 * ⚠️ `Record<string, string>` ET NON un enum : les fournisseurs viennent d'Auth.js et sont
 * configurés côté serveur — un enum ici prétendrait connaître une liste qu'il ne contrôle pas, et
 * casserait le jour où l'on en ajoute un. Le repli est le nom brut, qui reste lisible.
 */
const LIBELLE_MOYEN: Record<string, string> = {
  discord: "Discord",
  google: "Google",
};
