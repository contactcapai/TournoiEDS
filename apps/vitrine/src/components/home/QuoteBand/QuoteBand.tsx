import Image from "next/image";
import styles from "./QuoteBand.module.css";

// Bande citation pleine largeur (Story 2.3) — Server Component pur : aucune
// interactivité, donc aucun 'use client'. La home reste prérendue Static (acquis
// Story 1.6).
//
// Story 2.8 : la bande porte désormais une PARALLAXE, entièrement en CSS (couches
// en pseudo-éléments + animation pilotée par le scroll). Aucun nœud DOM ajouté,
// aucun JS, aucun 'use client' — c'est précisément le point de l'exercice. Voir
// QuoteBand.module.css pour la structure en 3 couches et ses gardes.
// ⚠️ Cette bande N'A PAS le fondu `motion.reveal` des autres sections : le
// mouvement du fond est son entrée (décision Story 2.8).
//
// SEULE section de la vitrine composée uniquement de balises natives : la
// maquette n'utilise ici ni bouton, ni cadre, ni losanges. Ne pas détourner
// PhotoFrame (cadre crème « tirage » avec légende et ombre) ni Eyebrow
// (losanges + capitales espacées) pour « consommer une primitive à tout prix » :
// ce serait un contresens visuel. Et ne pas extraire de primitive pour
// l'accroche manuscrite — c'est sa 1ʳᵉ occurrence, la 2ᵉ arrive avec la galerie
// (Story 4.3), qui codifiera (règle « payé deux fois », METHODE.md §5).
//
// Les formulations sont CONTRACTUELLES (UX-DR18) — ne pas les reformuler.
export interface QuoteBandProps {
  /**
   * La photo de fond, ou `null` quand aucune n'est choisie (Story 7.3).
   *
   * ⚠️ `null` EST L'ÉTAT NOMINAL, et le rendu sans photo n'est pas dégradé : le
   * pseudo-élément `.band::before` porte alors le dégradé de la maquette, exactement comme
   * depuis la Story 2.3. C'est une amélioration progressive, pas un placeholder en attente.
   */
  photoDeLaBande: {
    filename: string;
    alt: string;
    focalX: number;
    focalY: number;
  } | null;
}

export function QuoteBand({ photoDeLaBande }: QuoteBandProps) {
  return (
    // Ni aria-label ni aria-labelledby, contrairement au pattern des sections
    // 2.1/2.2 : cette section n'a PAS de titre (un <blockquote> n'en est pas un,
    // et en fabriquer un serait inventer un niveau absent de la maquette). Une
    // <section> sans nom accessible n'est pas exposée comme landmark — c'est le
    // comportement voulu ici : nommer cette bande purement émotionnelle
    // ajouterait un repère de navigation de plus à parcourir. Décision, pas oubli.
    <section
      className={`${styles.band} ${photoDeLaBande === null ? "" : styles.bandAvecPhoto}`}
    >
      {/* ══════════════════════════════════════════════════════════════════════════════
          LA COUCHE ① — LE CSS AVAIT DÉJÀ TRANCHÉ COMMENT LA REMPLIR (Story 7.3)
          ══════════════════════════════════════════════════════════════════════════════
          `QuoteBand.module.css` l'écrivait depuis la 2.8, pour ce jour précis : « quand la
          vraie photo arrivera, elle se glisse DANS CETTE COUCHE, sous le voile — qui doit
          RESTER : une photo claire sans voile ferait tomber le contraste sous AA. Elle
          passera par next/image en <Image fill> ; c'est alors l'image, et non ce
          pseudo-élément, qui portera l'animation. » ⇒ On suit, on ne redécide pas.

          🔴 LE VOILE (`.band::after`) N'EST PAS TOUCHÉ, ET C'EST UNE GARDE DE CONTRASTE :
          le texte tient AA (cream 12,87:1 · or 7,42:1) parce qu'il est mesuré AU-DESSUS du
          voile. Une photo claire sans lui ferait tomber la citation sous le seuil, sans que
          rien ne le signale — le contraste ne casse pas, il se dégrade.
          ⚠️ Et le calcul de la 2.8 reste valable : il majorait sur la couleur la PLUS
          CLAIRE de la couche ①. Une photo peut être plus claire que `#3a3672` en un
          point — c'est pourquoi le voile est indispensable ici, alors qu'il était une
          simple précaution avec un dégradé.

          ⚠️ `priority` VOLONTAIREMENT ABSENT : cette bande est sous la ligne de flottaison,
          contrairement au hero. Le mettre ferait concurrence à l'image du hero pour la même
          bande passante, au premier rendu, sur mobile. */}
      {photoDeLaBande === null ? null : (
        <Image
          className={styles.photo}
          src={`/medias/${photoDeLaBande.filename}`}
          // Décorative : la citation porte le sens, et l'alt de la galerie décrirait une
          // scène dont la bande ne parle pas. `alt=""` la retire de l'arbre, c'est la règle
          // du projet pour tout décoratif.
          alt=""
          fill
          sizes="100vw"
          style={{
            objectPosition: `${photoDeLaBande.focalX}% ${photoDeLaBande.focalY}%`,
          }}
        />
      )}

      <div className={styles.content}>
        <span className={styles.hand}>notre raison d&apos;être</span>

        {/* Lignes en <span display:block> plutôt qu'avec le <br> de la maquette :
            les séparateurs {" "} garantissent un texte accessible « … le jeu
            vidéo à Reims … » et non « … vidéoà Reims … » (revue 2.1 / EC1). Le
            rendu sur deux lignes est identique. */}
        <blockquote className={styles.quote}>
          <span className={styles.line}>« On fait vivre le jeu vidéo</span>{" "}
          <span className={styles.line}>
            {/* <em> ASSUMÉ ici, contrairement au <span> décoratif du hero :
                « en vrai. » est la chute de la phrase, l'emphase est réelle — le
                lead du hero écrit déjà <strong>en vrai</strong>. Côté CSS, le
                `font-style: normal` de `.quote em` n'est PAS cosmétique. */}
            à Reims, <em>en vrai.</em> »
          </span>
        </blockquote>
      </div>
    </section>
  );
}
