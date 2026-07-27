import { Button, Eyebrow, LinkArrow } from "@repo/ui";
import { Wrap } from "@/components/common/Wrap/Wrap";
import styles from "./AnimationsTeaser.module.css";

// Teaser « Animations & interventions » (Story 2.4) — Server Component pur :
// aucune interactivité propre, donc aucun 'use client'. La home reste prérendue
// Static (acquis Story 1.6).
//
// Composé des primitives @repo/ui de la Story 1.3 : rien n'est réimplémenté ici.
// ⚠️ SectionHead (components/common/) n'est PAS utilisé, et c'est délibéré : il
// porte `margin-bottom: 48px` et l'échelle --fs-section-title (clamp 40→66px),
// alors que cette bande veut un titre de BLOC compact suivi d'un paragraphe à
// 12px, le CTA étant un frère flex. On consomme donc Eyebrow directement.
//
// Les formulations sont CONTRACTUELLES (UX-DR18) — ne pas les reformuler.
export function AnimationsTeaser() {
  return (
    // aria-labelledby ↔ id du <h2> : nomme la région (pattern acquis review 1.6 F6).
    // Contrairement à la bande citation (2.3), cette section A un titre, donc elle
    // se nomme. L'id `animations` de la maquette (nav one-page) n'est PAS reporté :
    // nous avons de vraies routes (le SiteHeader pointe sur /animations).
    <section className={styles.section} aria-labelledby="animations-title">
      <Wrap>
        {/* Exactement 2 enfants : la colonne de texte et le CTA. C'est ce qui fait
            fonctionner le `justify-content: space-between`, et le `flex-wrap: wrap`
            fait passer le CTA dessous quand la place manque (= tout le responsive). */}
        <div className={styles.band}>
          <div className={styles.text}>
            {/* Le `&` s'écrit LITTÉRAL : en JSX, `&amp;` afficherait « &amp; » tel
                quel. La maquette l'échappe parce qu'elle est en HTML brut. */}
            <Eyebrow>Collectivités & écoles</Eyebrow>

            <h2 id="animations-title" className={styles.title}>
              On anime votre territoire
            </h2>

            <p className={styles.lead}>
              Ateliers gaming, sensibilisation aux écrans, interventions en maisons
              de quartier : une offre clé en main pour faire du jeu vidéo un outil
              de lien social. Environ 8 formats disponibles.
            </p>

            {/* Ajout DÉLIBÉRÉ vs la maquette, qui n'expose qu'un bouton : UX-DR19
                exige que chaque teaser renvoie à sa page dédiée, et EXPERIENCE.md
                (l.40) nomme littéralement ce libellé comme point d'entrée. Même
                précédent qu'en Story 2.2 (« Découvrir l'asso »).
                Il vit dans la colonne de texte et non à côté du bouton : empiler
                deux actions à droite déséquilibrerait la bande. */}
            <LinkArrow href="/animations" className={styles.more}>
              Toutes nos animations
            </LinkArrow>
          </div>

          {/* → /partenaires et NON /animations : le formulaire de sollicitation vit
              sur la page Partenaires (Epic 5). C'est la cible de la maquette
              (`#partenaires`) et du mapping explicite d'EXPERIENCE.md l.65.
              Les deux routes sont créées plus tard (2.7 et 4.6) : le 404 est
              ATTENDU, comme pour le CTA du hero depuis la Story 2.1. Ne pas
              retomber sur href="#" (scroll-to-top + annonce trompeuse). */}
          <Button variant="gold" href="/partenaires">
            Nous solliciter
          </Button>
        </div>
      </Wrap>
    </section>
  );
}
