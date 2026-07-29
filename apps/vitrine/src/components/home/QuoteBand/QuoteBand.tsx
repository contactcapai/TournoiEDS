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
// (Story 4.5), qui codifiera (règle « payé deux fois », METHODE.md §5).
//
// Les formulations sont CONTRACTUELLES (UX-DR18) — ne pas les reformuler.
export function QuoteBand() {
  return (
    // Ni aria-label ni aria-labelledby, contrairement au pattern des sections
    // 2.1/2.2 : cette section n'a PAS de titre (un <blockquote> n'en est pas un,
    // et en fabriquer un serait inventer un niveau absent de la maquette). Une
    // <section> sans nom accessible n'est pas exposée comme landmark — c'est le
    // comportement voulu ici : nommer cette bande purement émotionnelle
    // ajouterait un repère de navigation de plus à parcourir. Décision, pas oubli.
    <section className={styles.band}>
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
