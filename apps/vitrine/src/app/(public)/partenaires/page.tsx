import type { Metadata } from "next";
import { Brush, LinkArrow } from "@repo/ui";
import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import { PartnerWall } from "@/components/proof/PartnerWall/PartnerWall";
import { CONTACT_EMAIL } from "@/lib/links";
import { PARTNER_CATEGORIES } from "@/lib/schemas/partner";
import { getPublishedPartners } from "@/server/db/queries/partners";
import type { PartnerCategory } from "@/server/db/schema";
import editorial from "@/styles/editorial.module.css";
import motion from "@/styles/motion.module.css";
import styles from "./page.module.css";

// Page « Partenaires » (Story 4.2) — TROISIÈME page dédiée du site, et celle qui ferme
// le DERNIER 404 interne (header, footer, double porte, /animations, /l-asso et le
// bandeau de la home y renvoyaient tous vers une route inexistante).
//
// ⚠️ AUCUNE MAQUETTE ne décrit cette page (.decision-log.md l.96 : « Maquettes pages
// dédiées : AUCUNE »). Ce qui EXISTE dans la maquette, c'est la section `.proof` de la
// HOME (l.368-405), et elle porte TROIS choses dont cette page en reprend DEUX :
//   · `.s-head` (eyebrow + titre + chapô)  → reste sur la HOME (ProofBand, Story 4.1).
//                                            NE PAS le recopier ici.
//   · `.mention` × 2 (GIR, France Esport)  → ABSORBÉES par le mur `participation` :
//                                            une seule table depuis la 4.1, donc un seul
//                                            rendu. Pas de bloc `.mention` séparé, ce
//                                            serait afficher deux fois les mêmes lignes.
//   · `.lbl` + `.logos-wall` × 3           → ICI, en QUATRE murs (la 4ᵉ catégorie est née
//                                            de la restructuration du 2026-07-30).
//
// 🔴 L'ÉTAT RÉEL DE LA DONNÉE A PILOTÉ LA CONCEPTION, ET IL FAUT LE SAVOIR EN RELISANT.
// Sur les 11 partenaires en base : 4 ont un logo, 2 une description, 0 un lien. La
// « dégradation » n'est donc pas un cas limite à traiter en marge, c'est le cas NOMINAL.
// Une page conçue pour la donnée pleine rendrait aujourd'hui 7 cadres vides et 0 lien.
//
// ⚠️ Registre : VOUVOIEMENT de bout en bout, comme /animations. C'est une page pro — le
// tutoiement joueurs vit sur le Hero, la double porte et la clôture de /l-asso.
//
// ⚠️ Zéro duplication avec / ET /l-asso ET /animations (NFR1, anti-pattern Zyro) : la
// légitimité est DOCUMENTÉE ici, l'histoire de l'asso reste sur /l-asso, l'offre reste
// sur /animations. On RENVOIE, on ne recopie pas.

/**
 * 🔴 CETTE PAGE LIT LA BASE ⇒ `force-dynamic`, EXACTEMENT COMME `/` ET `/agenda`.
 *
 * Le raisonnement complet est en tête de `app/(public)/page.tsx` (l.32-57) et n'est pas
 * recopié ici. Le résumé qui compte : sans lui, Next PRÉRENDRAIT la page au build,
 * exécuterait la requête Drizzle pendant `next build`, et la CI tomberait — elle tourne
 * SANS SECRET, c'est structurel (`.github/workflows/ci.yml`).
 *
 * ⚠️ LE TÉMOIN EST LE SYMBOLE DE BUILD : `ƒ (Dynamic)` attendu. Un `○ (Static)` sur
 * cette route signifie que la requête a tourné au build — donc que le garde-fou n°2 de
 * la Story 1.7 est tombé.
 *
 * ⚠️ Ne pas « optimiser » en ISR / `revalidate` / `'use cache'` : la Story 3.3 a tranché
 * ce point sur trois faits (dont `unstable_cache` déprécié en Next 16.2 et son
 * successeur exigeant le drapeau APPLICATIF GLOBAL `cacheComponents`), et `epics.md` +
 * `architecture.md` ont été corrigés en conséquence. La question est CLOSE.
 */
export const dynamic = "force-dynamic";

/**
 * Libellés PUBLICS des quatre catégories.
 *
 * 🔴 LES QUATRE SONT CONTRACTUELS (UX-DR18) — trois sont VERBATIM de la maquette
 * (`.lbl`, l.386 / l.393 / l.399), le quatrième vient de l'AC d'`epics.md`. Ne pas les
 * reformuler : « Nos participations » n'est PAS « Nos partenaires » (France Esport est
 * une ADHÉSION, Game in Reims une PARTICIPATION — les ranger sous « partenaires »
 * affirmerait une relation qui n'existe pas, FR33).
 *
 * 🔴 `Record<PartnerCategory, string>` EXHAUSTIF, ET C'EST LA GARDE : ajouter une valeur
 * à l'enum sans lui donner de libellé CASSE LE TYPECHECK. Un objet indexé librement
 * (`Record<string, string>`) aurait rendu un mur anonyme, en silence.
 */
const CATEGORY_LABELS: Record<PartnerCategory, string> = {
  sponsor: "Nos sponsors",
  partenaire: "Nos partenaires",
  soutien: "Ils nous soutiennent",
  participation: "Nos participations",
};

/**
 * La variante `.inst` de la maquette (filet or léger) est posée sur les SOUTIENS et sur
 * eux seuls — la maquette la donne à ses deux tuiles institutionnelles (Reims Legend'R,
 * Ville de Reims, l.400-402) et à aucune autre. Les participations y étaient rendues en
 * `.mention`, pas en tuile `.inst`.
 */
const CATEGORIE_INSTITUTIONNELLE: PartnerCategory = "soutien";

export const metadata: Metadata = {
  // Le root layout pose `title.template: "%s · Esport des Sacres"` → le <title> rendu
  // est « Partenaires · Esport des Sacres ».
  title: "Partenaires",
  description:
    "Les sponsors, partenaires, soutiens et participations d'Esport des Sacres : commerces rémois, associations du Grand Est et institutions locales. Des faits acquis, pas des ambitions.",
  // ⚠️ DEUX pièges distincts, tous deux MESURÉS sur le HTML rendu en Story 2.6 :
  //  1. openGraph NE DÉRIVE PAS du `title` de la page quand le parent en déclare un ;
  //  2. Next REMPLACE l'objet `openGraph` du parent, il ne le fusionne PAS champ par
  //     champ. Sans les trois premières lignes ci-dessous, cette page perdrait
  //     `og:type`, `og:locale` et `og:site_name` → carte de partage sans nom de site.
  // ⚠️ Le grep de contrôle doit matcher `og:site_name` : `og:[a-z]*` est aveugle au `_`,
  //     et c'est précisément ce qui avait laissé passer le défaut.
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Esport des Sacres",
    title: "Partenaires · Esport des Sacres",
    description:
      "Qui entoure Esport des Sacres, et à quel titre : sponsors, partenaires du réseau Grand Est, soutiens institutionnels et participations.",
  },
};

export default async function Partenaires() {
  // La page requête et distribue en props ; aucun composant enfant ne lit la base
  // (patron AC1 de la 3.2). Une seule lecture ici — pas de `Promise.all` à faire.
  const partners = await getPublishedPartners();

  // 🔴 L'ORDRE DES MURS DÉCOULE DE `PARTNER_CATEGORIES`, IL N'EST PAS RÉÉCRIT. C'est la
  // même liste qui construit le `pgEnum`, donc le même ordre que le `ORDER BY category`
  // de la requête et que le bandeau de la home. Une seconde liste ici aurait divergé au
  // premier ajout de catégorie.
  //
  // 🔴 UNE CATÉGORIE SANS ENTRÉE PUBLIÉE EST ENTIÈREMENT OMISE (AC4) : pas de titre
  // orphelin, pas de grille vide, pas de « prochainement ». Un titre seul est pire
  // qu'une absence — il annonce un contenu que la page n'a pas.
  const murs = PARTNER_CATEGORIES.map((category) => ({
    category,
    entries: partners.filter((partner) => partner.category === category),
  })).filter((mur) => mur.entries.length > 0);

  return (
    <>
      {/* ① Tête de page. Seul <h1> du document ; le <main id="content"> est fourni par
          (public)/layout.tsx → pas de <main> ici. Seule occurrence d'Eyebrow de la page.

          🔴 CETTE SECTION N'EST PAS ANIMÉE, ET C'EST UNE GARDE, PAS UN OUBLI. Le chapô
          de SectionHead rend `var(--grey)`, qui ÉCHOUE sous l'état `from` de
          `motion.reveal` (opacity 0,75) sur tous les fonds du site — 3,70:1 sur
          `--navy-deep`, valeur mesurée en Story 3.3. Les pages /l-asso et /animations
          n'ont jamais rencontré ce défaut parce que leur tête de page n'est pas animée
          non plus (« la 1ʳᵉ section d'une page ne s'anime pas », règle uniforme du
          site). Ne pas ajouter `motion.reveal` ici, et ne poser AUCUN autre SectionHead
          avec `intro` ailleurs sur cette page. */}
      <section className={editorial.head} aria-labelledby="partenaires-title">
        <Wrap>
          <SectionHead
            headingLevel={1}
            titleId="partenaires-title"
            eyebrow="Partenaires & réseau"
            title={
              <>
                {/* {" "} explicite : JSX avale l'espace en fin de ligne avant un nœud
                    (leçon 2.6). Sans lui on lirait « nous entourent » collé. */}
                Celles et ceux qui nous <Brush>entourent</Brush>
              </>
            }
            intro="Esport des Sacres n'avance pas seule : des commerces rémois, des associations du Grand Est et des institutions locales accompagnent l'association. Voici qui — et à quel titre."
          />
        </Wrap>
      </section>

      {/* ② Les murs. Fond `--navy` : DESIGN.md (l.171) réserve ce fond aux sections
          RELEVÉES et nomme littéralement « agenda, preuve » ; la maquette pose d'ailleurs
          `background: var(--navy)` sur `.proof`, dont ces murs sont la transcription.
          C'est aussi la seule bande de cette page (procédé /l-asso et /animations : une
          seule section à fond distinct par page).

          ⚠️ `<div>` et non `<section>` : ce n'est qu'un groupement de présentation, et
          les quatre <section> nommées sont les murs eux-mêmes. Un <section> de plus
          n'aurait pas de nom accessible à lui donner.

          ⚠️ <Wrap> est utilisé NU (aucune classe fusionnée) : rien à ancrer ici, donc
          aucune question de cascade — le contrat de Wrap est respecté par construction. */}
      <div className={`${editorial.section} ${editorial.band} ${motion.reveal}`}>
        <Wrap>
          {murs.length > 0 ? (
            murs.map(({ category, entries }) => (
              <PartnerWall
                key={category}
                label={CATEGORY_LABELS[category]}
                titleId={`mur-${category}`}
                entries={entries}
                institutionnel={category === CATEGORIE_INSTITUTIONNELLE}
              />
            ))
          ) : (
            /* 🔴 ZÉRO PARTENAIRE PUBLIÉ ⇒ LA PAGE EXISTE TOUJOURS, ET C'EST UNE
               DIFFÉRENCE ASSUMÉE AVEC `ProofBand`, QUI SE REND `null`.
               Un BLOC de preuve sans preuve est un aveu : on le retire de la home. Une
               PAGE dont l'URL est dans le header ne peut pas ne pas exister — la retirer
               rouvrirait le 404 que cette story ferme. Donc : la tête de page reste, la
               section de contact reste, et les quatre murs cèdent la place à UNE phrase.
               Surtout pas quatre titres vides.
               `editorial.prose` posé DIRECTEMENT sur le <p> : il porte la mesure de
               lecture (680px) et `--light` — la couleur qui tient sous le fondu, là où
               `--grey` tomberait à 3,70:1 (mesuré en 3.3). Une classe locale aurait
               redéclaré la mesure de lecture, donc rouvert R9 pour une seule ligne. */
            <p className={editorial.prose}>
              Les structures qui accompagnent l&apos;association sont en cours de mise à
              jour. En attendant, écrivez-nous : la liste se construit au fil des
              partenariats confirmés.
            </p>
          )}
        </Wrap>
      </div>

      {/* ③ Clôture — le MOYEN DE CONTACT.

          🔴 CE BLOC EST UN REPLI, ET LA STORY 5.2 DOIT LE REMPLACER, PAS S'AJOUTER À CÔTÉ.
          `FR31` définit cette page comme « Partenaires / Nous solliciter … et accès au
          FORMULAIRE », lequel arrive en Epic 5. Or SIX surfaces renvoient déjà ici avec
          une intention de contact (header, footer, double porte « Nous contacter »,
          /animations « Nous solliciter », /l-asso, bandeau « Devenir partenaire ») :
          livrer la page sans aucun moyen de contact referait le défaut soldé en Story 3.3
          (un CTA « participer » qui n'avait pas de destination). Arbitrage de Brice du
          2026-07-31. Dette R28 → Story 5.2.

          ⚠️ AUCUNE PROMESSE DE DÉLAI (« on vous répond sous 48 h ») : c'est une
          [ASSUMPTION] d'EXPERIENCE.md attachée au formulaire, non figée (Q7, canal de
          réception non tranché). Même garde qu'en 2.7.

          ⚠️ PAS de `Button` or « Nous contacter » : on est déjà ARRIVÉ ici en cliquant
          « Nous contacter ». Un bouton de plus rouvrirait la redondance de porte pro que
          la Story 4.1 vient précisément de supprimer sur la home.

          ⚠️ DERNIÈRE section avant le footer : cas critique de la plage d'animation (un
          bloc qui n'atteint jamais la fin de sa plage resterait invisible pour toujours).
          À vérifier aux 7 largeurs, comme en 2.8. */}
      <section
        className={`${editorial.section} ${motion.reveal}`}
        aria-labelledby="solliciter-title"
      >
        <Wrap>
          <h2 id="solliciter-title" className={editorial.title}>
            Nous <Brush>solliciter</Brush>
          </h2>
          <div className={editorial.prose}>
            <p>
              Un partenariat, un coup de main sur un événement, une animation pour votre
              structure : décrivez-nous votre projet, même s&apos;il est encore flou.
            </p>
            <p>
              L&apos;équipe est bénévole et répond par mail —{" "}
              {/* L'affordance du lien est portée par le SOULIGNÉ, jamais par la seule
                  couleur (WCAG 1.4.1) : patron des liens en prose de /agenda.
                  ⚠️ Un `mailto:` N'EST PAS « sortant » (`isExternalUrl` le sait) : ni
                  `target`, ni `rel`, ni annonce « nouvel onglet ». Patron SiteFooter
                  l.237-240. */}
              <a href={`mailto:${CONTACT_EMAIL}`} className={styles.email}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </div>
          {/* Le volet « offre d'animations » de FR31, satisfait par un RENVOI et non par
              une recopie de la page Animations (NFR1). Route interne → ni target, ni
              rel, ni mention SR. */}
          <div className={editorial.more}>
            <LinkArrow href="/animations">Notre offre d&apos;animations</LinkArrow>
          </div>
        </Wrap>
      </section>
    </>
  );
}
