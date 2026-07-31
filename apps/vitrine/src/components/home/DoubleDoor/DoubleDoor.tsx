import { Button, Eyebrow, LinkArrow } from "@repo/ui";
import { Wrap } from "@/components/common/Wrap/Wrap";
import { NEW_TAB_SR, REJOINDRE_URL, isExternalUrl } from "@/lib/links";
import motion from "@/styles/motion.module.css";
import styles from "./DoubleDoor.module.css";

// Double porte joueurs / partenaires (Story 2.5) — Server Component pur : aucune
// interactivité propre, donc aucun 'use client'. 10ᵉ et dernier bloc du long-scroll,
// avant le footer.
// ⚠️ La home n'est plus prérendue Static depuis la Story 3.2 (elle lit la base) : ce
// composant, lui, ne requête rien et n'y est pour rien.
//
// Composé des primitives @repo/ui de la Story 1.3 (Button, Eyebrow, LinkArrow) et du
// conteneur partagé Wrap (Story 2.4) : rien n'est réimplémenté ici.
//
// ⚠️ LA PORTE PARTENAIRES A HÉRITÉ D'UN LIEN EN STORY 4.1 : « Toutes nos animations »
// venait du bloc `AnimationsTeaser`, que cette story a SUPPRIMÉ de la home (AC7). Motif
// mesuré : le CTA or « Nous solliciter » de ce bloc et le CTA outline « Nous contacter »
// ci-dessous pointaient TOUS DEUX vers /partenaires, à deux blocs d'écart, pour le même
// public. Le lien vers /animations, lui, n'avait pas d'autre point d'entrée dans le
// long-scroll — il ne pouvait pas disparaître avec le bloc.
//
// Les formulations sont CONTRACTUELLES (UX-DR18) — ne pas les reformuler.
export function DoubleDoor() {
  // CALCULÉ, jamais présumé. `REJOINDRE_URL` vaut aujourd'hui une URL http réelle
  // mais PROVISOIRE (finalisée en Story 5.5) : faire dériver target/rel/mention SR
  // de l'URL rend ce bloc insensible à ce que la 5.5 y mettra. Un placeholder « # »
  // ne doit JAMAIS annoncer « nouvel onglet » (review 1.4 #1 / 1.5 #4).
  // Patron identique à MobileMenu.renderCta(), qui pointe la MÊME cible.
  const rejoindreExternal = isExternalUrl(REJOINDRE_URL);

  return (
    // Ni aria-label ni aria-labelledby : ce bloc n'a PAS de titre de section (la
    // maquette n'en pose aucun), et en fabriquer un serait inventer un niveau
    // absent. Précédent explicite : QuoteBand (Story 2.3) — une <section> sans nom
    // accessible n'est pas exposée comme landmark. Décision, pas oubli.
    //
    // `motion.reveal` (Story 2.8) : apparition au scroll. ⚠️ C'est le DERNIER bloc de
    // la home avant le footer, donc le cas critique de la plage d'animation — un bloc
    // qui n'atteint jamais la fin de sa plage resterait invisible pour toujours.
    // Mesuré vert aux 7 largeurs de référence (Story 2.8, Tâche 5).
    <section className={`${styles.section} ${motion.reveal}`}>
      {/* La maquette pose `class="wrap doors"` sur UN SEUL élément : on consomme
          donc la prop `className` de Wrap plutôt que d'ajouter un nœud DOM.
          ⚠️ 1ʳᵉ consommation de cette prop dans le projet. Elle concatène l'attribut
          `class`, elle ne décide PAS de la cascade (revue 2.4 / EC1) : c'est sûr ici
          parce que `.doors` ne déclare AUCUNE des 3 propriétés réservées de `.wrap`
          (max-width / margin / padding) — vérifié ligne à ligne, cf. Debug Log. */}
      <Wrap className={styles.doors}>
        {/* Porte JOUEURS (`.door.p1` de la maquette). Les <h2> ne sont pas les <h3>
            de la maquette : les deux portes sont des blocs de PREMIER RANG de la
            home, pairs de la bande Animations. Un <h3> les rattacherait
            sémantiquement à la section qui précède. */}
        <div className={`${styles.door} ${styles.doorPlayers}`}>
          <Eyebrow>Joueurs</Eyebrow>

          <h2 className={styles.title}>Rejoins l&apos;aventure</h2>

          <p className={styles.lead}>
            Viens jouer un jeudi, tente un tournoi, ou adhère pour soutenir
            l&apos;asso. Aucun niveau requis — juste l&apos;envie de partager.
          </p>

          {/* 🔴 CE PIED EXISTE POUR ALIGNER LES DEUX CTA, ET SON `margin-top: auto` EST
              LA SEULE MÉTHODE ADMISE ICI. Ne PAS chercher l'égalisation par
              `height: 100%` : `align-items: stretch` n'étire un élément de grille QUE
              si sa taille transversale vaut `auto`, si bien que `height: 100%` PRODUIT
              le défaut qu'on croit corriger — mesuré en Story 3.3 (hauteurs
              [580, 557, 499, 557] au lieu d'une valeur unique). Détail en CSS. */}
          <div className={styles.foot}>
            {/* Lien SORTANT (1ᵉʳ d'un bloc de contenu de la home — jusqu'ici seuls le
                header et le footer en portaient). L'URL vient de lib/links.ts, source
                unique : jamais en dur ici.
                ⚠️ Pas d'icône visible de lien sortant, contrairement à ce qu'exige
                EXPERIENCE.md l.186 : `ExternalIcon` vit dans MobileMenu (composant
                client, non exportée) et la recopier en ferait une 2ᵉ occurrence. Le
                texte SR, lui, est bien rendu. Dette R12 → Story 5.5, qui traitera tous
                les CTA sortants d'un coup. */}
            <Button
              variant="gold"
              href={REJOINDRE_URL}
              {...(rejoindreExternal
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              Adhérer via HelloAsso
              {rejoindreExternal && <span className="sr-only">{NEW_TAB_SR}</span>}
            </Button>
          </div>
        </div>

        {/* Porte PARTENAIRES (`.door.p2` de la maquette). */}
        <div className={`${styles.door} ${styles.doorPartners}`}>
          {/* Le `&` s'écrit LITTÉRAL : en JSX, `&amp;` afficherait « &amp; » tel
              quel. La maquette l'échappe parce qu'elle est en HTML brut. */}
          <Eyebrow>Partenaires & institutions</Eyebrow>

          <h2 className={styles.title}>Travaillons ensemble</h2>

          <p className={styles.lead}>
            Collectivités, écoles, acteurs du jeu vidéo, BDE : on anime le
            territoire et on monte des événements clés en main.
          </p>

          <div className={styles.foot}>
            {/* HÉRITÉ D'`AnimationsTeaser` (Story 4.1, AC7), dont ce lien était le seul
                apport propre. Il reste un `LinkArrow` et non un `Button` : deux boutons
                empilés dans la même porte mettraient deux actions en concurrence, et
                la hiérarchie de cette carte est déjà posée (outline = secondaire).
                AU-DESSUS du bouton, comme l'exige AC7 : /animations est une page à
                DÉCOUVRIR, /partenaires l'action à faire — l'ordre visuel dit lequel des
                deux est l'objectif de la carte.
                EXPERIENCE.md (l.40) nomme littéralement ce libellé comme point d'entrée
                de la page Animations : ne pas le reformuler. */}
            <LinkArrow href="/animations">Toutes nos animations</LinkArrow>

            {/* 1ʳᵉ consommation de `variant="outline"` du projet (livrée en Story 1.3,
                jamais rendue). DESIGN.md §Components la désigne NOMMÉMENT comme le CTA
                secondaire de la porte partenaires : c'est cette hiérarchie visuelle
                (or plein vs outline) qui segmente les deux publics — ne pas la
                « simplifier » en gold.
                Route INTERNE : ni target, ni rel, ni mention « nouvel onglet ».
                ✅ /partenaires EXISTE depuis la Story 4.2, et elle porte un moyen de
                contact (e-mail) en attendant le formulaire de l'Epic 5 : ce CTA a donc
                enfin une destination utile. Ne pas retomber sur href="#". */}
            <Button variant="outline" href="/partenaires">
              Nous contacter
            </Button>
          </div>
        </div>
      </Wrap>
    </section>
  );
}
