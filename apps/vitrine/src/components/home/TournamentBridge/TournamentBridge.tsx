import { Brush, Button, ExternalIcon } from "@repo/ui";
import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import { NEW_TAB_SR, TOURNOI_URL, classerDestination } from "@/lib/links";
import motion from "@/styles/motion.module.css";
import styles from "./TournamentBridge.module.css";

// Bloc « passerelle Tournoi » de l'accueil (Story 5.4) — transcription de la section
// `#tournoi` de docs/refonte-2026/maquette/index.html (markup l.339-366, CSS l.142-151,
// @media l.196). 8ᵉ des 10 blocs du long-scroll, entre QuoteBand et ProofBand (FR7).
//
// Server Component : aucune interactivité propre, donc aucun 'use client'. Ce composant
// ne requête RIEN — il est 100 % statique, sur une page qui n'est `force-dynamic` que
// pour l'agenda (Story 3.2). Ne rien ajouter au Promise.all de page.tsx pour lui.
//
// Les formulations sont CONTRACTUELLES (UX-DR18) — ne pas les reformuler.

/**
 * 🔴 LE CLASSEMENT EST FICTIF ET SE DÉCLARE COMME TEL (arbitrage de Brice, 2026-08-01).
 *
 * La maquette (l.357-361) porte QUATRE pseudos qui ressemblent à de vrais joueurs
 * (`illenium0051`, `czosenek`, `Alexandreims`, `TDQ ON TOP`). Les publier tels quels
 * aurait présenté une DONNÉE DE LA PLATEFORME COMME UN DÉCOR — figée, sans date, sans
 * contexte, et pour toujours. Ces cinq lignes sont donc inventées, et la mention
 * « Aperçu — classement d'exemple » ci-dessous n'est PAS décorative : elle est la
 * raison pour laquelle ce bloc est publiable.
 *
 * ⚠️ Ne pas « brancher » ce tableau sur la base : un classement LIVE est
 * ARCHITECTURALEMENT IMPOSSIBLE — le cloisonnement des deux bases a été prouvé dans
 * les deux sens (dette R21), il faudrait une API côté moteur — celle d'`apps/tournoi-api`
 * n'existe plus, la 10.7 l'a retirée le 2026-09-01 — et UX-DR16
 * exclut explicitement l'intégration live en v1.
 *
 * Valeurs CONTRACTUELLES : c'est l'aperçu exact validé par Brice au cadrage.
 */
const STANDINGS = [
  { pseudo: "Kirian", points: 35 },
  { pseudo: "Solveig", points: 29 },
  { pseudo: "Marn", points: 26 },
  { pseudo: "Ptit Nours", points: 22 },
  { pseudo: "joueur", points: 18 },
] as const;

// Flèche du CTA (maquette l.352). DÉCORATIVE : `aria-hidden` + `focusable="false"`,
// patron de la primitive LinkArrow. Aucune dimension ici — `Button.module.css` pose
// déjà `.btn svg { width: 18px; height: 18px }` depuis la Story 1.3.
// ⚠️ 1ʳᵉ consommation de la prop `icon` de Button dans le projet : elle existe depuis
// la 1.3 et n'avait jamais été rendue.
const arrowIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M5 12h14M13 6l6 6-6 6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function TournamentBridge() {
  // CALCULÉ, jamais présumé — patron de `DoubleDoor` (l.26-31) et de `MobileMenu.renderCta()`.
  //
  // 🔴 ET CETTE LIGNE VIENT DE PAYER, SANS ÊTRE MODIFIÉE — STORY 9.4. `TOURNOI_URL` vaut
  // désormais `/tournois` : `external` bascule à `false` TOUT SEUL, et les trois attributs de
  // lien sortant disparaissent du CTA sans qu'une seule ligne de logique change ici. C'est le
  // bénéfice exact pour lequel la Story 5.5 a créé `classerDestination` — un `target="_blank"`
  // littéral aurait dû être traqué dans trois fichiers.
  //
  // ⚠️ CE COMMENTAIRE ANNONÇAIT *« la Story 6.13 rendra TOURNOI_URL modifiable au back-office
  // (lib/links.ts devient un lecteur de site_setting) »*. **C'était faux depuis le 2026-08-06** :
  // la 6.13 a décidé l'INVERSE et l'a écrit noir sur blanc (`schemas/site-setting.ts` : *« elle
  // N'EST PAS ICI, et ce n'est pas un oubli »*). Un commentaire qui annonce un avenir déjà
  // démenti fait chercher la panne au mauvais endroit (`pieges/cadrage-perime.md`).
  const external = classerDestination(TOURNOI_URL) === "externe";

  return (
    // aria-labelledby ↔ id du <h2> de la tête de section (patron acquis review 1.6 F6).
    <section className={styles.section} aria-labelledby="tournoi-title">
      <Wrap>
        <SectionHead
          eyebrow="Compétition accessible"
          titleId="tournoi-title"
          title={
            <>
              {/* {" "} explicite : JSX avale l'espace de fin de ligne avant un nœud
                  (leçon 2.6, pieges/jsx-espace-avalee.md). Sans lui on lirait
                  « Nostournois ». */}
              Nos <Brush>tournois</Brush>
            </>
          }
          intro="Gratuits, ouverts sur inscription. À commencer par notre circuit TFT, sur notre propre plateforme."
        />

        {/* 🔴 `motion.reveal` EST POSÉ ICI, ET SÛREMENT PAS SUR LA <section> — 3ᵉ
            occurrence du même montage après EventHub (3.2) et ProofBand (4.1), et
            pour la même raison exactement : le chapô de SectionHead rend
            `var(--grey)`, qui vaut 5,54:1 sur `--navy-deep` à pleine opacité mais
            tombe à 3,70:1 sous le fondu (`motion.reveal` part de 0,75), soit un ÉCHEC
            net pour un seuil de 4,5. Le SectionHead reste donc à l'opacité 1.
            ⚠️ Ne pas « simplifier » en remontant cette classe sur la <section>.
            ⚠️ Les couleurs du tableau ci-dessous ont été CALCULÉES SOUS CE FONDU et
            divergent volontairement de la maquette — voir le bloc 🔬 en fin de
            TournamentBridge.module.css avant d'y toucher. */}
        <div className={motion.reveal}>
          <div className={styles.grid}>
            {/* Colonne gauche (`.t-l`). */}
            <div className={styles.pitch}>
              {/* <h3> : la <section> porte déjà le <h2> de SectionHead. Deux lignes
                  en <span display:block> plutôt qu'avec le <br> de la maquette, et
                  {" "} explicite entre elles — patron QuoteBand (l.35-38) : le texte
                  accessible doit dire « Tournoi TFT Esport des Sacres » et non
                  « Tournoi TFTEsport des Sacres ». Rendu identique. */}
              <h3 className={styles.blockTitle}>
                <span className={styles.titleLine}>Tournoi TFT</span>{" "}
                <span className={styles.titleLine}>Esport des Sacres</span>
              </h3>

              {/* 🔴 « CASH PRIZE » RETIRÉ (arbitrage de Brice, 2026-08-01). La maquette
                  (l.350) écrit « Format suisse, classement en direct, cash prize. » ;
                  FR33 réserve la place aux FAITS ACQUIS. Écart ASSUMÉ à la maquette,
                  présenté au gate visuel — le reste de la phrase est mot à mot.
                  Ne pas « rééquilibrer » en ajoutant autre chose à la place. */}
              <p className={styles.lead}>
                Format suisse, classement en direct. Inscription, check-in et
                résultats en temps réel — le tout chez nous, à notre image.
              </p>

              {/* L'URL vient de `lib/links.ts`, JAMAIS en dur : c'est la source unique de
                  cette destination. 3ᵉ consommateur de TOURNOI_URL après SiteHeader
                  (nav « Tournois ») et SiteFooter (deux colonnes) — le libellé diffère
                  volontairement, EXPERIENCE.md (l.65) fige « Accéder à la plateforme »
                  pour ce bloc.
                  ⚠️ CE LIBELLÉ N'EST PAS MODIFIÉ PAR LA STORY 9.4, et il reste vrai : la
                  plateforme, c'est désormais nous. Les formulations de ce bloc sont
                  CONTRACTUELLES (UX-DR18) — le retoucher se porte au gate visuel, pas au
                  passage d'un changement d'URL.

                  🔴 LA FLÈCHE EST REVENUE LE 2026-08-14, ET CE COMMENTAIRE L'AVAIT ANNONCÉ.
                  De la Story 5.5 à la 9.4, `ExternalIcon` REMPLAÇAIT `arrowIcon` — jamais
                  ne s'y ajoutait —, et c'est une MESURE qui l'avait tranché : les deux
                  icônes côte à côte élargissaient le CTA de ~27px (`.btn svg` impose 18px
                  + 9px de `gap`), ce qui suffisait à faire DÉBORDER la grille du bloc
                  tournoi de 4,28px à 320px, et `gate` passait ROUGE dessus. La ligne
                  disait : « la flèche reste rendue si la destination cessait d'être
                  sortante ». C'est arrivé — `TOURNOI_URL` est une route interne.
                  ⚠️ IL Y A DONC TOUJOURS EXACTEMENT UNE ICÔNE, et le débordement de 4,28px
                  ne peut pas revenir. Ne JAMAIS rendre les deux : `icon={external ? … : …}`
                  est un ternaire et doit le rester.
                  ⚠️ Le retour de la flèche est un CHANGEMENT VISIBLE sur l'accueil — porté
                  au gate visuel de la 9.4, pas découvert dessus.

                  ⚠️ C'est aussi cette flèche qui a fait rendre un FAUX NÉGATIF à la
                  première version de `gate:links`, laquelle cherchait « un svg décoratif
                  quelconque » et la trouvait — porte VERTE sur un vrai défaut R12. La
                  porte cible depuis `[data-external-icon]`, porté par la seule
                  primitive partagée. ⇒ Le retour de `arrowIcon` ne peut donc PAS faire
                  croire à la porte qu'un lien sortant est signalé : les deux svg sont
                  distincts pour elle, et c'est ce qui rend ce basculement mesurable. */}
              <Button
                variant="gold"
                href={TOURNOI_URL}
                icon={external ? <ExternalIcon /> : arrowIcon}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                Accéder à la plateforme
                {external && <span className="sr-only">{NEW_TAB_SR}</span>}
              </Button>
            </div>

            {/* Colonne droite (`.t-r`). */}
            <div className={styles.boardCol}>
              {/* <figure> + <figcaption> EN PREMIER ENFANT, et c'est une garde, pas une
                  préférence de balisage : la mention « classement d'exemple » doit être
                  lue AVANT les lignes. Un lecteur d'écran qui entendrait « Kirian,
                  35 pts » sans l'avertissement serait PLUS trompé qu'un voyant, pas
                  moins — or c'est cet avertissement qui rend le bloc publiable.
                  ⚠️ Ne pas poser `aria-hidden` sur ce bloc « puisqu'il est illustratif » :
                  ça masquerait aussi l'avertissement. */}
              <figure className={styles.board}>
                <figcaption className={styles.boardCaption}>
                  Aperçu — classement d&apos;exemple
                </figcaption>

                {/* `role="list"` EXPLICITE : `list-style: none` fait perdre à WebKit la
                    sémantique de liste (comportement connu de VoiceOver). Le rang est
                    donc porté par l'ORDRE de la liste.
                    Le « 1 · » visible est `aria-hidden` — patron du numéro fantôme
                    d'`Axis` (Story 1.3). ⚠️ Ne PAS le produire par un compteur CSS :
                    le contenu généré EST exposé dans l'arbre d'accessibilité par
                    Chrome et Safari, ce qui ferait annoncer le rang DEUX FOIS (une par
                    la liste, une par le ::before). L'attribut, lui, est déterministe. */}
                <ol className={styles.rows} role="list">
                  {STANDINGS.map(({ pseudo, points }, index) => (
                    <li
                      key={pseudo}
                      className={
                        index === 0 ? `${styles.row} ${styles.rowWin}` : styles.row
                      }
                    >
                      <span className={styles.player}>
                        <span className={styles.rank} aria-hidden="true">
                          {index + 1} ·
                        </span>
                        <span>{pseudo}</span>
                      </span>
                      <span>{points} pts</span>
                    </li>
                  ))}
                </ol>
              </figure>
            </div>
          </div>
        </div>
      </Wrap>
    </section>
  );
}
