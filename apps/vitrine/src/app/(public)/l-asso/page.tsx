import type { Metadata } from "next";
import { Brush, Button, CrownWatermark, LinkArrow } from "@repo/ui";
import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import editorial from "@/styles/editorial.module.css";
import motion from "@/styles/motion.module.css";
import styles from "./page.module.css";

// Page « L'asso » (Story 2.6) — PREMIÈRE page dédiée du site, et premier <h1> hors
// du hero. Server Component pur : aucune interactivité, donc aucun 'use client'.
// La page est prérendue Static.
//
// ⚠️ AUCUNE MAQUETTE NE DÉCRIT CETTE PAGE. Décision UX tracée (.decision-log.md
// l.96 : « Maquettes pages dédiées : AUCUNE, pages spine-only assumées »). Le
// `<section id="asso">` de la maquette est le bloc « Trois axes » de la HOME
// (Story 2.2), PAS cette page — ne pas s'y tromper en cherchant une référence.
// Tout ce qui suit est donc une COMPOSITION à partir des primitives et des tokens,
// pas une transcription : le rythme vertical, l'échelle des titres et la bande
// --navy sont des décisions de la story, validées au gate visuel.
//
// Le contenu éditorial n'existait nulle part avant la story : il est écrit dans
// docs/implementation-artifacts/2-6-page-l-asso.md (bloc « Contenu contractuel »)
// à partir des seules sources documentaires du projet, et VALIDÉ PAR BRICE.
// Ne pas le reformuler. Ne rien y ajouter qui ne soit pas un fait sourcé :
// FR16 interdit tout chiffre de communauté, FR33 interdit de présenter une
// ambition comme acquise.
//
// ⚠️ Zéro duplication avec la home (NFR1, anti-pattern Zyro) : les trois axes de
// l'accueil TEASENT cette page. Elle développe, elle ne répète pas — vérifié par
// comparaison de n-grammes de 8 mots sur les <main> des deux pages.

export const metadata: Metadata = {
  // Le root layout pose `title.template: "%s · Esport des Sacres"` → le <title>
  // rendu est « L'asso · Esport des Sacres ».
  title: "L'asso",
  description:
    "Association esport née à Reims en 2022 : notre histoire, l'origine de notre nom, nos partis pris, notre équipe de bénévoles et les faits qui nous engagent.",
  // ⚠️ DEUX pièges distincts, tous deux mesurés sur le HTML rendu :
  //  1. openGraph NE DÉRIVE PAS du `title` de la page quand le parent en déclare un ;
  //  2. Next REMPLACE l'objet `openGraph` du parent, il ne le fusionne PAS champ par
  //     champ. Sans les trois premières lignes ci-dessous, /l-asso perdrait
  //     `og:type`, `og:locale` et `og:site_name` (mesuré : 5 balises og sur `/`
  //     contre 2 ici) → carte de partage sans nom de site sur Discord/LinkedIn.
  // À reconduire tel quel sur toute nouvelle page dédiée (Story 2.7 et suivantes).
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Esport des Sacres",
    title: "L'asso · Esport des Sacres",
    description:
      "Association esport née à Reims en 2022 : notre histoire, l'origine de notre nom, nos partis pris et notre équipe de bénévoles.",
  },
};

export default function LAsso() {
  return (
    <>
      {/* ① Tête de page. Seul <h1> du document ; le <main id="content"> est fourni
          par (public)/layout.tsx → pas de <main> ici (un seul dans le DOM).
          Seule occurrence d'Eyebrow de la page : elle ouvre, elle ne rythme pas. */}
      <section className={editorial.head} aria-labelledby="asso-title">
        <Wrap>
          <SectionHead
            headingLevel={1}
            titleId="asso-title"
            eyebrow="Qui sommes-nous"
            title={
              <>
                Une asso de joueurs, à <Brush>Reims</Brush>
              </>
            }
            intro="Esport des Sacres est née à Reims en 2022. On organise des rendez-vous hebdomadaires, des tournois, et des animations pour les collectivités et les écoles. Le tout en association, avec des bénévoles."
          />
        </Wrap>
      </section>

      {/* ② Notre histoire */}
      {/* `motion.reveal` (Story 2.8) sur toutes les sections SAUF la tête de page :
          celle-ci est au-dessus de la ligne de flottaison, l'animer n'aurait pas de
          sens (règle uniforme du site : la 1ʳᵉ section d'une page ne s'anime pas). */}
      <section
        className={`${editorial.section} ${motion.reveal}`}
        aria-labelledby="histoire-title"
      >
        <Wrap>
          <h2 id="histoire-title" className={editorial.title}>
            Comment ça a <Brush>commencé</Brush>
          </h2>
          <div className={editorial.prose}>
            <p>
              L&apos;association s&apos;est créée en 2022, à Reims. Le point de
              départ tenait en une phrase : donner au jeu vidéo une date, un lieu
              et des gens, plutôt qu&apos;un salon vocal de plus.
            </p>
            <p>
              Depuis, le rendez-vous est hebdomadaire. Tous les jeudis, on
              s&apos;installe dans un bar rémois, en roulement sur quatre
              établissements : chacun a son jeudi dans le mois. C&apos;est
              prévisible pour les habitués, et ça fait tourner l&apos;asso sur
              quatre quartiers de la ville.
            </p>
            <p>
              Les dates ne vivent plus derrière un compte à créer : elles sont
              affichées ici. Discord reste notre salon, il n&apos;est plus la
              porte d&apos;entrée.
            </p>
          </div>
        </Wrap>
      </section>

      {/* ③ Le nom — SEULE section à fond distinct (--navy), procédé de la maquette
          pour ses sections relevées (.agenda, .proof). Elle porte le filigrane
          couronne : Reims cité des sacres, c'est le cœur identitaire de la page. */}
      <section
        className={`${editorial.section} ${editorial.band} ${styles.bandAnchor} ${motion.reveal}`}
        aria-labelledby="nom-title"
      >
        {/* Décoratif : aria-hidden + alt="" sont portés par la primitive, ne rien
            redéclarer. height=204 est OBLIGATOIRE : couronne-eds.png fait 352×211,
            PAS un carré — sans elle, 340×340 seraient réservés → CLS (leçon 2.1). */}
        <CrownWatermark
          src="/couronne-eds.png"
          width={340}
          height={204}
          className={styles.crown}
        />
        {/* `.bandInner` ne déclare QUE position + z-index (voir le CSS) : aucune des
            3 propriétés réservées de `.wrap`, donc aucune dépendance à l'ordre
            d'émission du CSS compilé. Preuve consignée au Debug Log. */}
        <Wrap className={styles.bandInner}>
          <h2 id="nom-title" className={editorial.title}>
            Reims, <Brush>cité des sacres</Brush>
          </h2>
          <div className={editorial.prose}>
            <p>
              Les rois de France étaient couronnés ici, dans la cathédrale :
              c&apos;est ce qui vaut à Reims son surnom de cité des sacres. Notre
              nom vient de là, et la couronne de notre logo aussi.
            </p>
            <p>
              Ce n&apos;est pas qu&apos;un clin d&apos;œil. On ne fait pas de
              l&apos;esport « quelque part en France » : on en fait à Reims, avec
              des lieux, des partenaires et un public d&apos;ici.
            </p>
          </div>
        </Wrap>
      </section>

      {/* ④ Nos partis pris — les trois partis pris du positionnement (§3).
          ⚠️ Volontairement PAS la primitive Axis : son numéro fantôme 01/02/03 est
          la signature visuelle du bloc « Trois axes » de la home. Le rejouer ici
          donnerait l'impression d'un copier-coller et brouillerait le rapport
          teaser → page. Des <h3> + <p> simples, sans numéro et sans les filets. */}
      <section
        className={`${editorial.section} ${motion.reveal}`}
        aria-labelledby="partis-pris-title"
      >
        <Wrap>
          <h2 id="partis-pris-title" className={editorial.title}>
            Nos <Brush>partis pris</Brush>
          </h2>
          <div className={editorial.prose}>
            <h3 className={editorial.subtitle}>Le local d&apos;abord</h3>
            <p>
              On joue là où on vit. Les soirées se tiennent dans des bars rémois,
              et nos interventions se font dans les quartiers, les écoles et les
              structures qui nous sollicitent. Ce qu&apos;on organise doit
              profiter à la ville, pas seulement à nos adhérents.
            </p>

            <h3 className={editorial.subtitle}>L&apos;esport au sens large</h3>
            <p>
              Un plateau de compétition, oui, mais pas seulement. C&apos;est aussi
              une manette qu&apos;on se passe, une première partie gagnée, une
              soirée où personne ne regarde le classement. On accueille les
              curieux aussi bien que les joueurs assidus.
            </p>

            <h3 className={editorial.subtitle}>Le sérieux par la preuve</h3>
            <p>
              Une association qui reçoit du public s&apos;engage : sur ses dates,
              sur son accueil, sur ce qu&apos;elle annonce. On préfère montrer ce
              qu&apos;on a fait plutôt que d&apos;afficher ce qu&apos;on prétend
              peser.
            </p>
          </div>
        </Wrap>
      </section>

      {/* ⑤ L'équipe — présentation COLLECTIVE : aucun nom, aucun portrait, aucun
          effectif chiffré (un effectif serait un chiffre de communauté, FR16).
          Le projet n'a aucune donnée nominative, et NFR5 pose un bloquant projet :
          aucune procédure de consentement au droit à l'image n'existe côté asso.
          Arbitrage de Brice (2026-07-29) : collectif maintenant, nominatif plus
          tard → dette R16, absorbée par la Story 6.10. Ne PAS inventer de prénoms. */}
      <section
        className={`${editorial.section} ${motion.reveal}`}
        aria-labelledby="equipe-title"
      >
        <Wrap>
          <h2 id="equipe-title" className={editorial.title}>
            Une équipe de <Brush>bénévoles</Brush>
          </h2>
          <div className={editorial.prose}>
            <p>
              L&apos;association est portée par des bénévoles : un bureau, et
              celles et ceux qui installent les écrans le jeudi soir, tiennent la
              table d&apos;un tournoi ou animent un atelier.
            </p>
            <p>
              Personne n&apos;est ici à temps plein, et ça explique beaucoup de
              nos choix : des formats simples, des rendez-vous réguliers, et des
              outils que l&apos;équipe peut reprendre sans dépendre d&apos;une
              seule personne.
            </p>
          </div>
        </Wrap>
      </section>

      {/* ⑥ Les faits — la légitimité est TEXTUELLE ici. Les mentions illustrées et
          les 3 murs de logos appartiennent à l'Epic 4 (4.2, 4.3, 4.6) : ne pas les
          rejouer, et ne pas nommer les sponsors un par un (ce sont les données de
          l'Epic 4 — deux sources à maintenir sinon). Le LinkArrow route vers la
          preuve visuelle. */}
      <section
        className={`${editorial.section} ${motion.reveal}`}
        aria-labelledby="faits-title"
      >
        <Wrap>
          <h2 id="faits-title" className={editorial.title}>
            On préfère les <Brush>faits</Brush>
          </h2>
          <div className={editorial.prose}>
            <p>
              Pas de compteur de membres ni de statistiques d&apos;audience sur ce
              site. Ce qu&apos;on peut montrer, en revanche, se vérifie :
            </p>
            {/* <ul> et non une suite de <p> : c'est une liste, elle doit être
                annoncée comme telle (« liste de 4 éléments »).

                ⚠️ Le `{" "}` après chaque </strong> n'est PAS décoratif : sans lui,
                l'espace qui sépare le libellé du tiret DISPARAÎT au rendu. Mesuré
                sur le HTML prérendu : les deux items dont le texte contient une
                entité `&apos;` rendaient « Game in Reims— présents » (tiret collé),
                les deux autres non. Un séparateur explicite est le seul à survivre
                à la normalisation des espaces de JSX, quelle que soit la façon dont
                le texte est réparti sur les lignes source.
                Même remède qu'en Story 2.1 / 2.3 (Hero, QuoteBand) : ce piège est
                déjà documenté dans QuoteBand.tsx. Ne pas retirer ces séparateurs. */}
            <ul className={styles.facts}>
              <li>
                <strong>Game in Reims</strong>{" "}
                — présents à l&apos;événement rémois du jeu vidéo depuis 2023.
              </li>
              <li>
                <strong>France Esport</strong>{" "}
                — association adhérente.
              </li>
              <li>
                <strong>Un réseau dans le Grand Est</strong>{" "}
                — d&apos;autres associations et acteurs du jeu vidéo avec qui on
                monte des projets.
              </li>
              <li>
                <strong>Des soutiens locaux</strong>{" "}
                — des enseignes rémoises et des acteurs institutionnels qui
                suivent nos actions.
              </li>
            </ul>
          </div>
          {/* /partenaires est créée en Story 4.2 : ce lien renvoie un 404 par
              défaut d'ici là, comportement ATTENDU et cohérent avec le SiteHeader
              depuis la 1.4. Ne pas retomber sur href="#" (scroll-to-top + annonce
              trompeuse). Route interne → ni target, ni rel, ni mention SR. */}
          <div className={editorial.more}>
            <LinkArrow href="/partenaires">
              Nos partenaires et nos réalisations
            </LinkArrow>
          </div>
        </Wrap>
      </section>

      {/* ⑦ Clôture — s'adresse aux JOUEURS, donc tutoiement (registre du hero et de
          la double porte). Le registre pro (vouvoiement) vit sur /animations et
          /partenaires. UN SEUL CTA : ne pas ajouter un second lien vers
          /partenaires, la section ⑥ le porte déjà — deux liens voisins vers la même
          cible avec des libellés différents sont la redondance relevée en revue 2.5.
          /agenda est livrée par l'Epic 3 : 404 attendu, comme le CTA du hero. */}
      {/* ⚠️ DERNIÈRE section avant le footer : cas critique de la plage d'animation
          (un bloc qui n'atteint jamais la fin de sa plage resterait invisible pour
          toujours). Mesuré vert aux 7 largeurs de référence (Story 2.8, Tâche 5). */}
      <section
        className={`${editorial.section} ${motion.reveal}`}
        aria-labelledby="venir-title"
      >
        <Wrap>
          <h2 id="venir-title" className={editorial.title}>
            Envie de passer un <Brush>jeudi</Brush> ?
          </h2>
          <div className={editorial.prose}>
            <p>
              Le plus simple, c&apos;est de venir voir. C&apos;est gratuit, et on
              n&apos;attend de toi ni niveau ni matériel — juste de pousser la
              porte du bar.
            </p>
          </div>
          <div className={editorial.cta}>
            <Button variant="gold" href="/agenda">
              Voir l&apos;agenda
            </Button>
          </div>
        </Wrap>
      </section>
    </>
  );
}
