import { Axis, Brush, LinkArrow } from "@repo/ui";
import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import styles from "./ThreeAxes.module.css";

// Bloc « Trois axes » de l'accueil (Story 2.2) — Server Component pur : aucune
// interactivité, donc aucun 'use client'. La home reste prérendue Static.
//
// Composé EXCLUSIVEMENT à partir des primitives @repo/ui livrées en Story 1.3 :
// Axis porte déjà la grille 120px/1fr, les filets, le numéro fantôme aria-hidden
// et sa propre media query 880px — rien de tout cela n'est réécrit ici.
//
// Les formulations sont CONTRACTUELLES (UX-DR18) — ne pas les reformuler.
export function ThreeAxes() {
  return (
    // aria-labelledby ↔ id du <h2> de la tête de section (pattern acquis review 1.6 F6).
    <section className={styles.section} aria-labelledby="axes-title">
      <div className={styles.wrap}>
        <SectionHead
          eyebrow="Qui on est"
          titleId="axes-title"
          title={
            <>
              {/* Seul « assume » est brossé, et il reste en cream : l'or du mot
                  brossé est SPÉCIFIQUE au hero dans la maquette (.hero h1 em),
                  les titres de section sont uniformément cream (.s-title). */}
              Trois choses qu&apos;on <Brush>assume</Brush>
            </>
          }
        />

        {/* Ce <div> n'a volontairement PAS de className : il n'existe que pour que
            le 3ᵉ <Axis> soit `:last-child` de son parent — c'est de là que vient
            son filet inférieur (`.axe:last-child` dans Axis.module.css). Y glisser
            un frère (le lien ci-dessous, par exemple) ferait disparaître ce filet ;
            envelopper chaque axe dans un <li> en poserait trois.
            Pas de className décoratif non plus : la règle CSS serait vide, donc
            supprimée à la compilation, donc `undefined` en silence (review 1.5 #1).

            Pas de <ol> : les numéros sont décoratifs (aria-hidden), l'ordre est
            porté par la séquence des <h3> (UX-DR8 / UX-DR28). */}
        <div>
          <Axis number="01" title="Local & vivant">
            Reims, cité des sacres : c&apos;est dans notre nom. On se retrouve en
            vrai, chaque semaine, dans les bars de la ville — et nos dates sont
            affichées ici, pas planquées sur Discord.
          </Axis>

          <Axis number="02" title="L'esport qui rassemble">
            L&apos;esport, c&apos;est du sport sur jeux vidéo — et ça se vit
            ensemble. On casse l&apos;image du joueur isolé : convivialité,
            partage, ouverture. Promis, on ne mange pas.
          </Axis>

          <Axis number="03" title="Sérieux & connecté">
            Présents à Game in Reims depuis 2023, adhérents France Esport, un vrai
            réseau dans le Grand Est. Une asso rigoureuse avec qui collectivités et
            partenaires aiment travailler.
          </Axis>
        </div>

        {/* Teaser → page dédiée (mapping UX-DR19). /l-asso est créée en Story 2.6 :
            ce lien renvoie un 404 par défaut d'ici là, comportement ATTENDU et
            cohérent avec le SiteHeader et le hero. Ne pas retomber sur href="#". */}
        <div className={styles.more}>
          <LinkArrow href="/l-asso">Découvrir l&apos;asso</LinkArrow>
        </div>
      </div>
    </section>
  );
}
