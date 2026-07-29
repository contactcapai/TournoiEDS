import type { Metadata } from "next";
import { Brush, Button, LinkArrow } from "@repo/ui";
import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import motion from "@/styles/motion.module.css";
import styles from "./page.module.css";

// Page « Animations & interventions » (Story 2.7) — DEUXIÈME page dédiée du site.
// Server Component pur : aucune interactivité, donc aucun 'use client'. Prérendue Static.
//
// ⚠️ AUCUNE MAQUETTE NE DÉCRIT CETTE PAGE. Décision UX tracée (.decision-log.md
// l.96 : « Maquettes pages dédiées : AUCUNE, pages spine-only assumées »). La
// `<section id="animations">` de la maquette est la BANDE TEASER de la HOME
// (Story 2.4), PAS cette page — même piège d'ancre qu'en 2.6 avec `#asso`.
// Tout ce qui suit est une COMPOSITION à partir des primitives et des tokens, sur
// le patron déjà validé par /l-asso (Story 2.6).
//
// 🔴 LE CATALOGUE DES ATELIERS N'EXISTE PAS, ET RIEN NE S'INVENTE ICI.
// FR10 demande « la présentation des ateliers (≈ 8) » : cette liste n'a jamais été
// fournie, elle est portée comme « à figer » par les TROIS documents de cadrage
// (Brief §11, positionnement-v2 §11, .decision-log l.48), avec le statut du
// partenariat CRIJ. Arbitrage de Brice (2026-07-29) : « familles maintenant,
// catalogue plus tard » + « ne pas nommer le CRIJ » (FR33 — pas d'ambition
// présentée comme acquise). D'où les TROIS FAMILLES ci-dessous, et zéro intitulé,
// zéro durée, zéro tarif, zéro effectif. Dette R17 → Story 4.9 puis 6.9.
//
// ⚠️ Les trois familles ne sont pas un pis-aller : elles deviennent la TAXONOMIE
// DURABLE (futur enum `workshop_family` de la Story 4.9, et cible de l'état vide
// du catalogue). Ne pas les renommer à la légère.
//
// ⚠️ Registre : VOUVOIEMENT de bout en bout. C'est la première page pro du site ;
// le tutoiement joueurs vit sur le Hero, la double porte et la clôture de /l-asso
// (Story 2.6, garde-fou n°8). Zéro « tu / ton / toi » ici.
//
// ⚠️ Zéro duplication avec /  ET avec /l-asso (NFR1, anti-pattern Zyro) : DEUX
// surfaces de référence, pas une. Le teaser dit qu'on le fait, cette page dit
// comment et pour qui. La légitimité (GIR, France Esport, réseau) reste sur
// /l-asso : on y RENVOIE, on ne la recopie pas.

export const metadata: Metadata = {
  // Le root layout pose `title.template: "%s · Esport des Sacres"` → le <title>
  // rendu est « Animations & interventions · Esport des Sacres ». Le `&` de cette
  // chaîne JS est sérialisé en `&amp;` dans la source HTML : c'est correct, c'est
  // le texte AFFICHÉ qui doit valoir « & ».
  title: "Animations & interventions",
  description:
    "Esport des Sacres intervient auprès des collectivités, des écoles et des structures sociales de Reims et du Grand Est : ateliers et tournois conviviaux, sensibilisation aux écrans, animations sur vos événements.",
  // ⚠️ DEUX pièges distincts, tous deux mesurés sur le HTML rendu en Story 2.6 :
  //  1. openGraph NE DÉRIVE PAS du `title` de la page quand le parent en déclare un ;
  //  2. Next REMPLACE l'objet `openGraph` du parent, il ne le fusionne PAS champ par
  //     champ. Sans les trois premières lignes ci-dessous, cette page perdrait
  //     `og:type`, `og:locale` et `og:site_name` (mesuré : 5 balises og sur `/`
  //     contre 2 sur /l-asso avant correctif) → carte de partage sans nom de site.
  // ⚠️ Le grep de contrôle doit matcher `og:site_name` : `og:[a-z]*` est aveugle
  //     au `_`, et c'est précisément ce qui avait laissé passer le défaut.
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Esport des Sacres",
    title: "Animations & interventions · Esport des Sacres",
    description:
      "Ateliers et tournois conviviaux, sensibilisation aux écrans, animations sur vos événements : l'offre d'Esport des Sacres pour les collectivités, les écoles et les structures sociales.",
  },
};

export default function Animations() {
  return (
    <>
      {/* ① Tête de page. Seul <h1> du document ; le <main id="content"> est fourni
          par (public)/layout.tsx → pas de <main> ici (un seul dans le DOM).
          Seule occurrence d'Eyebrow de la page : elle ouvre, elle ne rythme pas.
          headingLevel={1} et intro sont les deux props ouvertes par la Story 2.6 —
          on les CONSOMME, SectionHead n'est pas retouché. */}
      <section className={styles.head} aria-labelledby="anim-title">
        <Wrap>
          <SectionHead
            headingLevel={1}
            titleId="anim-title"
            eyebrow="Utilité sociale"
            title={
              <>
                Nos animations et <Brush>interventions</Brush>
              </>
            }
            intro="Esport des Sacres intervient à Reims et dans le Grand Est pour faire du jeu vidéo un support de rencontre : ateliers, temps de sensibilisation aux écrans, animations sur vos événements. On se déplace avec le matériel, et le format se cale avec vous."
          />
        </Wrap>
      </section>

      {/* ② L'angle : utilité sociale, PAS offre commerciale (FR10, dernière phrase).
          Aucun tarif, aucun devis, aucune mention de prix nulle part sur la page.
          Le LinkArrow renvoie vers /l-asso plutôt que de recopier la légitimité
          (GIR, France Esport, réseau) qui y vit déjà — c'est le rôle du lien. */}
      {/* `motion.reveal` (Story 2.8) sur toutes les sections SAUF la tête de page :
          celle-ci est au-dessus de la ligne de flottaison, l'animer n'aurait pas de
          sens (règle uniforme du site : la 1ʳᵉ section d'une page ne s'anime pas). */}
      <section
        className={`${styles.section} ${motion.reveal}`}
        aria-labelledby="mission-title"
      >
        <Wrap>
          <h2 id="mission-title" className={styles.title}>
            Une mission, pas une <Brush>prestation</Brush>
          </h2>
          <div className={styles.prose}>
            <p>
              Esport des Sacres est une association de bénévoles. Nos
              interventions ne sont pas un produit : elles prolongent ce
              qu&apos;on fait le reste de l&apos;année, à savoir réunir des gens
              autour d&apos;un écran et d&apos;une manette.
            </p>
            <p>
              Concrètement, ça veut dire qu&apos;on commence par parler de votre
              public et de votre objectif. Un temps d&apos;échange dans une
              classe et une animation de fin d&apos;année dans une maison de
              quartier n&apos;appellent pas le même format.
            </p>
          </div>
          <div className={styles.more}>
            <LinkArrow href="/l-asso">
              L&apos;association et son histoire
            </LinkArrow>
          </div>
        </Wrap>
      </section>

      {/* ③ SEULE section à fond distinct (--navy), procédé de la maquette pour ses
          sections relevées (.agenda, .proof) et reconduit une fois sur /l-asso.
          Elle porte la substance de l'offre, c'est elle qui mérite le relief.

          ❌ PAS de CrownWatermark ici, et c'est une décision : le filigrane est une
          marque IDENTITAIRE (hero, bande « cité des sacres »). Sur une page-offre
          destinée à des structures il n'apporte rien, et il ouvrirait une 3ᵉ
          occurrence de la dette R6 — en plus d'un débordement à mesurer, qui a
          coûté un défaut réel en 2.6 (rotation 8° → boîte englobante élargie).
          Sans filigrane, pas d'ancre `position: relative` ni de z-index à poser :
          <Wrap> est utilisé NU, donc aucune classe fusionnée, donc aucune question
          de cascade (le contrat de Wrap est respecté par construction).

          ❌ PAS la primitive Axis pour les trois familles : son numéro fantôme
          01/02/03 est la signature visuelle du bloc « Trois axes » de la home. Des
          <h3> + <p> simples, comme les partis pris de /l-asso. */}
      <section
        className={`${styles.section} ${styles.band} ${motion.reveal}`}
        aria-labelledby="offre-title"
      >
        <Wrap>
          <h2 id="offre-title" className={styles.title}>
            Ce qu&apos;on <Brush>propose</Brush>
          </h2>
          <div className={styles.prose}>
            <p>
              Nos interventions se rangent en trois familles. Elles se combinent
              volontiers : un même après-midi peut mêler un temps de
              sensibilisation et un tournoi.
            </p>

            <h3 className={styles.subtitle}>Ateliers et tournois conviviaux</h3>
            <p>
              On installe les postes, on lance les parties, et on encadre — en
              tournoi léger ou en jeu libre. L&apos;objectif n&apos;est pas le
              niveau : c&apos;est que des gens qui ne se parlaient pas se
              retrouvent devant le même écran.
            </p>

            <h3 className={styles.subtitle}>Sensibilisation aux écrans</h3>
            <p>
              Un temps d&apos;échange sur les usages : le temps passé devant un
              écran, ce qu&apos;on y joue, ce qui s&apos;y passe. On aborde le
              sujet en joueurs, sans diaboliser le jeu vidéo ni faire semblant
              que tout va bien.
            </p>

            <h3 className={styles.subtitle}>Animations sur vos événements</h3>
            <p>
              Une fête de quartier, un forum, une journée portes ouvertes : on
              vient avec le matériel et on tient l&apos;espace jeu pendant toute
              la durée de l&apos;événement.
            </p>

            {/* Cette phrase est la réponse HONNÊTE à l'absence de catalogue : elle
                décrit le fonctionnement réel d'une asso de bénévoles, elle ne
                masque pas un manque. Ne pas la retirer quand la Story 4.9 posera
                le catalogue — c'est elle qui explique pourquoi il y a des familles
                ET des ateliers. */}
            <p className={styles.closing}>
              Le format exact — durée, nombre de postes, jeux, âge du public — se
              définit avec vous. On préfère caler ça ensemble plutôt que de
              dérouler un catalogue.
            </p>
          </div>
        </Wrap>
      </section>

      {/* ④ Les publics de FR10 : collectivités, écoles, structures sociales /
          maisons de quartier — plus les acteurs du territoire (positionnement §5
          Axe 3, « fédérer l'écosystème local »). Rien au-delà des sources. */}
      <section
        className={`${styles.section} ${motion.reveal}`}
        aria-labelledby="publics-title"
      >
        <Wrap>
          <h2 id="publics-title" className={styles.title}>
            Pour <Brush>qui</Brush>
          </h2>
          <div className={styles.prose}>
            {/* <ul> et non une suite de <p> : c'est une liste, elle doit être
                annoncée comme telle (« liste de 4 éléments »).

                ⚠️ Le `{" "}` après chaque </strong> n'est PAS décoratif : sans lui,
                l'espace qui sépare le libellé du tiret DISPARAÎT au rendu. Mesuré
                sur le HTML prérendu en Story 2.6 : deux items sur quatre rendaient
                « Game in Reims— présents », alors que le source JSX était identique
                pour les quatre. Un séparateur explicite est le seul à survivre à la
                normalisation des espaces de JSX, quelle que soit la façon dont le
                texte est réparti sur les lignes source. Piège documenté :
                00 référence/pieges/jsx-espace-avalee.md. Ne pas les retirer. */}
            <ul className={styles.publics}>
              <li>
                <strong>Collectivités</strong>{" "}
                — services jeunesse, sport et culture, et leurs équipements.
              </li>
              <li>
                <strong>Écoles et établissements scolaires</strong>{" "}
                — du primaire au lycée, sur le temps scolaire ou périscolaire.
              </li>
              <li>
                <strong>Maisons de quartier et structures sociales</strong>{" "}
                — centres sociaux, MJC, accueils de loisirs.
              </li>
              <li>
                <strong>Associations et acteurs du territoire</strong>{" "}
                — pour monter une animation à plusieurs.
              </li>
            </ul>
          </div>
        </Wrap>
      </section>

      {/* ⑤ Le « comment », qui est ce qu'on sait réellement — par opposition au
          catalogue, qu'on ne sait pas. Aucune promesse de délai : « on te répond
          sous 48h » est une [ASSUMPTION] d'EXPERIENCE.md attachée au FORMULAIRE,
          non figée (Q7, canal de réception non tranché). */}
      <section
        className={`${styles.section} ${motion.reveal}`}
        aria-labelledby="deroulement-title"
      >
        <Wrap>
          <h2 id="deroulement-title" className={styles.title}>
            Comment ça se <Brush>passe</Brush>
          </h2>
          <div className={styles.prose}>
            <p>
              Vous nous écrivez en décrivant votre structure, votre public et ce
              que vous avez en tête. On revient vers vous pour caler le format,
              la durée et le matériel nécessaire.
            </p>
            <p>
              L&apos;équipe est bénévole : les dates se calent à l&apos;avance,
              et une intervention se prépare mieux quelques semaines avant que
              quelques jours avant.
            </p>
          </div>
        </Wrap>
      </section>

      {/* ⑥ Clôture. UN SEUL CTA principal, et un seul lien secondaire (en ②, vers
          /l-asso) : deux liens voisins vers la même cible avec des libellés
          différents sont la redondance relevée en revue 2.5 / EC2.
          → /partenaires et NON un formulaire local : le formulaire de sollicitation
          vit sur la page Partenaires (Epic 5), cible du mapping EXPERIENCE.md l.65
          et déjà celle du CTA du teaser depuis la Story 2.4. /partenaires est
          livrée en Story 4.6 : le 404 est ATTENDU d'ici là, comme pour le CTA du
          hero depuis la 2.1. Ne pas retomber sur href="#" (scroll-to-top + annonce
          trompeuse). Route interne → ni target, ni rel, ni mention SR. */}
      {/* ⚠️ DERNIÈRE section avant le footer : cas critique de la plage d'animation
          (un bloc qui n'atteint jamais la fin de sa plage resterait invisible pour
          toujours). Mesuré vert aux 7 largeurs de référence (Story 2.8, Tâche 5). */}
      <section
        className={`${styles.section} ${motion.reveal}`}
        aria-labelledby="contact-title"
      >
        <Wrap>
          <h2 id="contact-title" className={styles.title}>
            Un projet en <Brush>tête</Brush> ?
          </h2>
          <div className={styles.prose}>
            <p>
              Décrivez-nous votre besoin, même s&apos;il est encore flou. On vous
              répond — et si on n&apos;est pas les bons pour ce projet, on vous
              le dit.
            </p>
          </div>
          <div className={styles.cta}>
            <Button variant="gold" href="/partenaires">
              Nous solliciter
            </Button>
          </div>
        </Wrap>
      </section>
    </>
  );
}
