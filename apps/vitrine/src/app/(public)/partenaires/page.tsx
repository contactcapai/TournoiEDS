import type { Metadata } from "next";
import { Brush, LinkArrow } from "@repo/ui";
import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { SolicitationDialog } from "@/components/forms/SolicitationDialog/SolicitationDialog";
import { Wrap } from "@/components/common/Wrap/Wrap";
import { PartnerWall } from "@/components/proof/PartnerWall/PartnerWall";
import { PARTNER_CATEGORIES } from "@/lib/schemas/partner";
import { getPublishedPartners } from "@/server/db/queries/partners";
import { lireReglages } from "@/server/db/queries/settings";
import type { PartnerCategory } from "@/server/db/schema";
import editorial from "@/styles/editorial.module.css";
import motion from "@/styles/motion.module.css";

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
// ⚠️ CHIFFRES CORRIGÉS LE 2026-08-04 (Story 6.5) : ce commentaire disait « 4 ont un logo,
// 2 une description, 0 un lien ». C'était vrai à l'écriture de cette page et FAUX quelques
// heures plus tard — le commit `64aad1a` de cette même Story 4.2 a semé un lien et une
// description sur les onze. MESURÉ en base le 2026-08-04 : **11 entrées, 4 avec logo,
// 11 avec lien, 11 avec description**.
// La « dégradation » reste le cas NOMINAL pour le LOGO (7 sur 11 n'en ont pas), et le
// redevient pour le lien dès qu'un bénévole saisit un partenaire sans URL (Story 6.5).
// Une page conçue pour la donnée pleine rendrait 7 cadres vides.
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
  // 🔴 LA LECTURE DES RÉGLAGES (Story 6.13) — pour `SolicitationDialog`, qui est un composant
  // CLIENT et ne peut donc pas lire lui-même l'e-mail de contact (son repli `<noscript>` en
  // dépend). ⚠️ Cette page est l'un des TROIS sites d'appel de la modale, avec `DoubleDoor` et
  // `/partenaires` — le compte avait été raté au cadrage de la 6.13, et c'est le TYPECHECK qui
  // l'a dit, parce que la prop a été rendue OBLIGATOIRE plutôt qu'optionnelle.
  // ⚠️ Parallélisée : elle est indépendante de la lecture ci-dessus, et `lireReglages()` est
  // enveloppée de `cache()` — le `(public)/layout.tsx` l'appelle aussi, et les deux appels ne
  // font qu'UNE requête SQL le temps de cette requête HTTP.
  const [partners, reglages] = await Promise.all([getPublishedPartners(), lireReglages()]);

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

      {/* ③ Clôture — l'ACCÈS au formulaire de sollicitation (Story 5.1).

          `FR31` définit cette page comme « Partenaires / Nous solliciter … et accès au
          FORMULAIRE » — et c'est bien un ACCÈS qui est livré ici, pas le formulaire lui-même.

          🔴 LE FORMULAIRE N'EST PLUS INLINE, ET C'EST UN ARBITRAGE DE BRICE AU GATE VISUEL
          (2026-07-31) : posé en pied de page, il n'avait pas de cohérence à cet endroit —
          une page qui DOCUMENTE le réseau de l'asso se terminait par un long formulaire.
          Il vit désormais dans une MODALE (`SolicitationDialog`), ouverte d'ici comme
          depuis la double porte de la home et le CTA d'`/animations`.
          ⚠️ La dette R28 reste soldée : le repli `mailto:` de la Story 4.2 n'est pas
          revenu en page. Il ne subsiste que dans le `<noscript>` du dialogue, donc JAMAIS
          rendu en même temps que le bouton — c'est l'un OU l'autre, pas un doublon.

          ⚠️ AUCUNE PROMESSE DE DÉLAI (« on vous répond sous 48 h ») : c'est une
          [ASSUMPTION] d'EXPERIENCE.md non figée, et Q7 (tranchée le 2026-07-31) exclut tout
          accusé de réception par e-mail au demandeur — voir `SolicitationForm`.

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
          <p className={editorial.prose}>
            Un partenariat, un coup de main sur un événement, une animation pour votre
            structure : décrivez-nous votre projet, même s&apos;il est encore flou.
          </p>
          <div className={editorial.cta}>
            <SolicitationDialog
              variant="gold"
              label="Nous écrire"
              contactEmail={reglages.contactEmail}
            />
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
