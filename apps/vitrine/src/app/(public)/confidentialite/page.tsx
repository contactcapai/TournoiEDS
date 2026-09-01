import type { Metadata } from "next";
import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import { ASSOCIATION } from "@/lib/legal";
import editorial from "@/styles/editorial.module.css";
import motion from "@/styles/motion.module.css";

// ══════════════════════════════════════════════════════════════════════════════════════
// CONFIDENTIALITÉ (Story 12.5) — ÉCRITE DEPUIS LE SCHÉMA, PAS DEPUIS UN MODÈLE
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 CHAQUE LIGNE DU TABLEAU CI-DESSOUS CORRESPOND À DES COLONNES RÉELLES DE `schema.ts`,
// relevées le 2026-09-01 : `solicitation` (nom, e-mail, message, consentement),
// `user`/`account` (adresse, nom, avatar, jetons OAuth), `user_profile` (pseudo du site,
// Discord, Riot, Steam, Epic), `tournament_entry` + `tournament_entry_attendance`
// (inscriptions et présences), `event_attendance` (« j'y serai »), `member` (prénom et
// portrait du bureau), `photo`.
// ⚠️ UNE POLITIQUE RECOPIÉE D'UN GÉNÉRATEUR AURAIT ANNONCÉ DES TRAITEMENTS QUI N'EXISTENT
// PAS ICI (publicité, profilage, transferts hors UE de contenus) ET OUBLIÉ CEUX QUI
// EXISTENT. Une page qui décrit un autre site est pire qu'une page absente : elle est
// fausse tout en ayant l'air de tenir l'obligation.
//
// 🔴 DEUX FAITS RARES ET VRAIS, ÉCRITS PARCE QU'ILS SONT VÉRIFIABLES :
//   ① AUCUN OUTIL DE MESURE D'AUDIENCE dans le dépôt — ni Google Analytics, ni Matomo, ni
//      Plausible, ni Hotjar (grep du 2026-09-01, zéro occurrence) ;
//   ② LE SEUL COOKIE EST CELUI DE SESSION (`authjs.session-token`), strictement nécessaire,
//      donc AUCUN bandeau de consentement n'est requis. Un bandeau posé « par précaution »
//      demanderait un consentement qui n'a pas d'objet, et habituerait à cliquer sans lire.
// ⚠️ Ces deux phrases deviennent FAUSSES le jour où l'on ajoute un traqueur ou un cookie non
// essentiel. Elles sont donc à relire à ce moment-là — pas plus tôt, mais pas plus tard.

export const metadata: Metadata = {
  title: "Confidentialité",
  description:
    "Quelles données personnelles le site d'Esport des Sacres collecte, pourquoi, combien de temps, et comment exercer vos droits.",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Esport des Sacres",
    title: "Confidentialité · Esport des Sacres",
    description:
      "Quelles données personnelles le site d'Esport des Sacres collecte, pourquoi, combien de temps, et comment exercer vos droits.",
  },
};

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 `force-dynamic` — ET ICI LA RAISON N'EST PAS CELLE DES CINQ AUTRES PAGES
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `/`, `/agenda`, `/partenaires`, `/animations` et `/l-asso` portent cette ligne parce
 * qu'ELLES lisent la base. **Cette page-ci ne lit rien** : son contenu est du texte et
 * `lib/legal.ts` est un objet constant. On peut donc croire, très raisonnablement, qu'elle
 * n'en a pas besoin.
 *
 * 🔴 C'EST SON LAYOUT QUI LIT LA BASE. Depuis la Story 6.13, `(public)/layout.tsx` lit
 * `site_setting` pour le pied de page et le chrome — donc TOUTE page de ce groupe touche la
 * base, même celle qui n'a aucune requête à elle. Sans cette ligne, Next tente un PRÉRENDU au
 * build, la connexion Drizzle s'ouvre, et `next build` échoue.
 *
 * ⚠️ ET LE DÉFAUT EST INVISIBLE EN LOCAL, PAR CONSTRUCTION : ici `.env.local` fournit
 * `DATABASE_URL`, donc la lecture réussit et la page bascule d'elle-même en dynamique. La CI
 * construit SANS AUCUN SECRET (garde-fou n°2 de la Story 1.7, structurel dans `ci.yml`) :
 * elle est le seul endroit où ça casse. ⇒ Trouvé par la CI, et par elle seule — l'exact
 * symétrique de « le rendu se regarde sur staging ».
 * ⚠️ Le commentaire de `/l-asso` décrivait ce piège mot pour mot, AVANT qu'on le refasse.
 */
export const dynamic = "force-dynamic";

export default function ConfidentialitePage() {
  return (
    <>
      <section className={editorial.head} aria-labelledby="confidentialite-title">
        <Wrap>
          <SectionHead
            headingLevel={1}
            titleId="confidentialite-title"
            eyebrow="Vos données"
            title="Confidentialité"
            intro="Ce que ce site sait de vous, pourquoi, et ce que vous pouvez en faire. On a écrit cette page à partir du contenu réel de notre base de données, pas d'un modèle."
          />
        </Wrap>
      </section>

      {/* ① Le principe, avant le détail. Quelqu'un qui ne lit qu'un paragraphe doit repartir
          avec l'essentiel : on ne vend rien, on ne piste personne. */}
      <section
        className={`${editorial.section} ${motion.reveal}`}
        aria-labelledby="principe-title"
      >
        <Wrap>
          <h2 id="principe-title" className={editorial.title}>
            En deux phrases
          </h2>
          <div className={editorial.prose}>
            <p>
              Nous collectons le minimum nécessaire pour faire tourner une association&nbsp;:
              vous répondre, vous inscrire à un tournoi, tenir un classement. Nous ne vendons
              rien, nous ne cédons rien à des tiers à des fins commerciales, et{" "}
              <strong>aucun outil de mesure d&rsquo;audience ne tourne sur ce site</strong> —
              ni Google&nbsp;Analytics, ni aucun autre.
            </p>
            <p>
              Le responsable de traitement est l&rsquo;association{" "}
              <strong>{ASSOCIATION.nom}</strong> ({ASSOCIATION.adresse},{" "}
              {ASSOCIATION.codePostal} {ASSOCIATION.ville}).
            </p>
          </div>
        </Wrap>
      </section>

      {/* ② Le détail, par situation vécue et non par table. Une personne ne se demande pas
          « que contient user_profile » mais « que se passe-t-il si je m'inscris ». */}
      <section
        className={`${editorial.section} ${editorial.band} ${motion.reveal}`}
        aria-labelledby="collecte-title"
      >
        <Wrap>
          <h2 id="collecte-title" className={editorial.title}>
            Ce que nous collectons, et quand
          </h2>
          <div className={editorial.prose}>
            <p>
              <strong>Si vous nous écrivez</strong> par le formulaire de contact&nbsp;: votre
              nom, votre adresse e-mail, votre message, et la trace de votre consentement.
              Pour vous répondre, rien d&rsquo;autre.
            </p>
            <p>
              <strong>Si vous créez un compte</strong>&nbsp;: votre adresse e-mail. Selon le
              moyen choisi, Discord ou Google nous transmettent aussi un nom d&rsquo;affichage
              et une image de profil. Un compte sert à vous inscrire à un tournoi, à annoncer
              votre venue, et — pour les bénévoles — à administrer le site.
            </p>
            <p>
              <strong>Si vous remplissez votre profil</strong>&nbsp;: le pseudo que vous
              voulez voir affiché, et vos identifiants de jeu (Discord, Riot, Steam, Epic).
              Ils sont facultatifs. Ils servent à vous inviter en partie et à vous nommer
              correctement dans les résultats&nbsp;: ce sont ceux qu&rsquo;on voit déjà en jeu
              et sur le stream.
            </p>
            <p>
              <strong>Si vous vous inscrivez à un tournoi</strong>&nbsp;: le pseudo sous
              lequel vous jouez, votre présence constatée par un bénévole le jour venu, et vos
              résultats. <strong>Ces résultats sont publics</strong> — un classement de
              tournoi n&rsquo;a pas de sens autrement, et c&rsquo;est la raison même de
              participer.
            </p>
            <p>
              <strong>Si vous êtes membre du bureau</strong>&nbsp;: votre prénom, votre rôle
              et votre portrait, publiés sur la page de l&rsquo;association — avec votre
              accord, et retirables à tout moment.
            </p>
            <p className={editorial.closing}>
              Nous ne demandons ni date de naissance, ni adresse postale, ni numéro de
              téléphone. Si un formulaire vous en réclame un jour, c&rsquo;est que cette page
              n&rsquo;aura pas été mise à jour&nbsp;: signalez-le-nous.
            </p>
          </div>
        </Wrap>
      </section>

      {/* ③ Cookies. Section courte parce que le sujet l'est vraiment ici. */}
      <section
        className={`${editorial.section} ${motion.reveal}`}
        aria-labelledby="cookies-title"
      >
        <Wrap>
          <h2 id="cookies-title" className={editorial.title}>
            Cookies
          </h2>
          <div className={editorial.prose}>
            <p>
              Un seul&nbsp;: celui qui vous garde connecté après votre connexion. Il est{" "}
              <strong>strictement nécessaire</strong> au fonctionnement du site, et c&rsquo;est
              pourquoi vous ne verrez <strong>aucun bandeau de consentement</strong> ici — la
              loi n&rsquo;en exige pas pour ce type de cookie, et vous en présenter un
              laisserait croire qu&rsquo;il y a un choix à faire.
            </p>
            <p>
              Si vous ne vous connectez jamais, ce site ne dépose rien sur votre appareil.
            </p>
          </div>
        </Wrap>
      </section>

      {/* ④ Sous-traitants. ⚠️ On nomme ceux qui reçoivent réellement des données, et EUX
          SEULS. HelloAsso n'y est pas : l'adhésion se fait sur leur site, ce n'est pas nous
          qui leur transmettons quoi que ce soit. */}
      <section
        className={`${editorial.section} ${motion.reveal}`}
        aria-labelledby="tiers-title"
      >
        <Wrap>
          <h2 id="tiers-title" className={editorial.title}>
            Qui d&rsquo;autre voit ces données
          </h2>
          <div className={editorial.prose}>
            <p>
              <strong>Google</strong>, si vous choisissez de vous connecter avec un compte
              Google, et pour l&rsquo;envoi des e-mails de connexion&nbsp;;{" "}
              <strong>Discord</strong>, si vous choisissez ce moyen de connexion&nbsp;;{" "}
              <strong>Hostinger</strong>, qui héberge le serveur. C&rsquo;est tout.
            </p>
            <p>
              Le site et sa base de données sont hébergés sur un serveur que nous administrons
              nous-mêmes, en Europe. Les données ne sont ni revendues, ni louées, ni
              transmises à des fins publicitaires.
            </p>
          </div>
        </Wrap>
      </section>

      {/* ⑤ Conservation. ⚠️ Les durées énoncées ici doivent rester tenables À LA MAIN : rien
          dans le code ne purge automatiquement quoi que ce soit aujourd'hui. Annoncer une
          suppression automatique serait une promesse que personne n'exécute. */}
      <section
        className={`${editorial.section} ${motion.reveal}`}
        aria-labelledby="duree-title"
      >
        <Wrap>
          <h2 id="duree-title" className={editorial.title}>
            Combien de temps
          </h2>
          <div className={editorial.prose}>
            <p>
              <strong>Les messages de contact</strong> sont supprimés une fois traités, et au
              plus tard un an après leur réception.
            </p>
            <p>
              <strong>Votre compte et votre profil</strong> vivent aussi longtemps que vous les
              gardez. Vous pouvez supprimer votre compte vous-même depuis votre profil.
            </p>
            {/* ⚠️ FORMULATION EXACTE, ET ELLE A ÉTÉ CORRIGÉE : supprimer son compte DÉLIE
                (`ON DELETE SET NULL` sur `tournament_entry.user_id`), ça n'efface pas la
                ligne. Le pseudo sous lequel on a joué RESTE affiché au classement. Écrire
                « votre nom cesse d'y être rattaché » seul aurait laissé croire qu'il
                disparaît de l'écran — un engagement qu'on ne tient pas. */}
            <p>
              <strong>Les résultats de tournoi</strong> sont conservés&nbsp;: ils font
              l&rsquo;histoire sportive de l&rsquo;association. Si vous supprimez votre
              compte, il cesse d&rsquo;être relié à ces résultats, mais{" "}
              <strong>le pseudo sous lequel vous avez joué reste affiché</strong> dans les
              classements de ces tournois — les effacer changerait le classement des autres
              joueurs, qui n&rsquo;y sont pour rien. Vous pouvez nous demander de remplacer ce
              pseudo par une mention neutre&nbsp;: écrivez-nous.
            </p>
          </div>
        </Wrap>
      </section>

      {/* ⑥ Les droits, et surtout COMMENT les exercer. Une page qui les énumère sans donner
          d'adresse ne sert à personne. */}
      <section
        className={`${editorial.section} ${motion.reveal}`}
        aria-labelledby="droits-title"
      >
        <Wrap>
          <h2 id="droits-title" className={editorial.title}>
            Vos droits
          </h2>
          <div className={editorial.prose}>
            <p>
              Vous pouvez demander à consulter les données qui vous concernent, les faire
              corriger, les faire supprimer, ou vous opposer à leur usage. Une photo où vous
              apparaissez&nbsp;? Nous la retirons sur simple demande, sans discuter le motif.
            </p>
            <p>
              Écrivez à{" "}
              <a href={`mailto:${ASSOCIATION.email}`}>{ASSOCIATION.email}</a>. Nous répondons
              sous un mois. Nous sommes des bénévoles&nbsp;: si c&rsquo;est urgent, dites-le,
              on s&rsquo;organise.
            </p>
            <p className={editorial.closing}>
              Si notre réponse ne vous convient pas, vous pouvez saisir la CNIL —{" "}
              <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
                cnil.fr
              </a>
              .
            </p>
          </div>
        </Wrap>
      </section>
    </>
  );
}
