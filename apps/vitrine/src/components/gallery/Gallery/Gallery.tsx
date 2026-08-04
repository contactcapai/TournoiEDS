import { Wrap } from "@/components/common/Wrap/Wrap";
import { Scrapbook } from "@/components/gallery/Scrapbook/Scrapbook";
import type { GalleryPhoto } from "@/server/db/queries/photos";
import motion from "@/styles/motion.module.css";
import styles from "./Gallery.module.css";

// Bloc « Galerie scrapbook » de l'accueil (Story 4.3, FR15, UX-DR13) — 8ᵉ des 10 blocs
// du long-scroll, entre « Preuve & réseau » (4.1) et la double porte (2.5).
// Transcription de la maquette : markup l.408-423, CSS `.scrap` l.166-172.
//
// Server Component : aucune interactivité propre. Seul `Scrapbook` porte `'use client'`
// (project-context.md §5 — jamais un parent). Ce composant ne requête pas la base :
// `page.tsx` lit et distribue en props (patron AC1 de la 3.2).
//
// 🔴 CE BLOC N'UTILISE PAS `SectionHead`, ET C'EST VÉRIFIÉ, PAS SUPPOSÉ.
// `SectionHead` rend un `Eyebrow` — losanges + capitales or — alors que la maquette pose
// ici une accroche MANUSCRITE (`.hand`, Caveat or 28px) au-dessus d'un titre CENTRÉ. Ce
// sont deux registres différents, et c'est le seul bloc de la home dans ce registre.
// ⚠️ Ne pas « harmoniser » en y forçant `SectionHead` : il faudrait lui ajouter des props
// `align` et `hand` que son propre commentaire interdit nommément (« API MINIMALE, et
// elle le reste […] Ne pas ajouter de 3ᵉ prop au cas où »). La tête vit donc ici, en
// six lignes de CSS, et c'est moins cher que d'élargir une API partagée pour un seul
// consommateur.
//
// Les formulations sont CONTRACTUELLES et VERBATIM de la maquette (l.412-413) :
// « souriez, vous êtes en train de jouer » et « La vie de l'asso ». Ne pas les reformuler.
// ⚠️ La note de bas de maquette (« → Tes vraies photos viendront ici ») est une
// ANNOTATION DE MAQUETTE et non du contenu : elle est en `.foot-note`, la classe que la
// maquette réserve à ses propres commentaires — comme le « Cases = emplacements logos »
// que les Stories 4.1 et 4.2 ont écarté pour la même raison. Elle n'est PAS transcrite.

export interface GalleryProps {
  /** Photos publiées, déjà triées par la requête. Peut être vide (état É7). */
  photos: GalleryPhoto[];
  /**
   * Rendu dans le back-office (Story 6.4) : images servies par `/admin/medias`, brouillons
   * compris, et **jamais optimisées**.
   * ⚠️ Ce composant ne l'INTERPRÈTE pas : il la fait suivre. La décision — et la raison
   * MESURÉE (l'optimiseur de Next requête sans cookie de session) — vivent dans `Scrapbook`,
   * seul à construire une URL d'image.
   */
  sourceAdmin?: boolean;
}

export function Gallery({ photos, sourceAdmin }: GalleryProps) {
  return (
    // aria-labelledby ↔ id du <h2> (patron acquis review 1.6 F6).
    <section className={styles.section} aria-labelledby="gallery-title">
      <Wrap>
        <div className={styles.head}>
          {/* `aria-hidden` : c'est une accroche d'ambiance en écriture manuscrite, pas
              une information. La lire à voix haute avant le titre ajouterait du bruit
              sans rien apprendre — même traitement que les éléments décoratifs de la
              charte (project-context.md §5). */}
          <p className={styles.hand} aria-hidden="true">
            souriez, vous êtes en train de jouer
          </p>
          <h2 id="gallery-title" className={styles.title}>
            La vie de l&apos;asso
          </h2>
        </div>

        {/* 🔴 `motion.reveal` SUR UN <div> INTÉRIEUR QUI EXCLUT LA TÊTE, jamais sur la
            <section> — patron imposé par `motion.module.css` et déjà appliqué par
            `EventHub` (3.2), `ProofBand` (4.1) et `/partenaires` (4.2).
            Ici la raison est propre à ce bloc : la tête porte du Caveat OR, et l'or est
            la couleur qui a fixé le plancher d'opacité du fondu (0,747 depuis la 4.1).
            L'exclure évite d'avoir à re-mesurer une combinaison déjà au plus juste.
            ⚠️ Les couleurs QUI RESTENT dans le bloc animé (légende `--ink` sur le crème
            du cadre, texte du placeholder) sont calculées sous fondu — voir la fin de
            Gallery.module.css. */}
        <div className={motion.reveal}>
          <Scrapbook photos={photos} sourceAdmin={sourceAdmin} />
        </div>
      </Wrap>
    </section>
  );
}
