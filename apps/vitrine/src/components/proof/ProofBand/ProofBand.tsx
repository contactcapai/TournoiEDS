import { Brush, LinkArrow } from "@repo/ui";
import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import { PartnerMarquee } from "@/components/proof/PartnerMarquee/PartnerMarquee";
import type { PartnerTile } from "@/server/db/queries/partners";
import motion from "@/styles/motion.module.css";
import styles from "./ProofBand.module.css";

// Bloc « Preuve & réseau » de l'accueil (Story 4.1) — transcription de la section
// `.proof` de docs/refonte-2026/maquette/index.html (CSS l.153, markup l.368-405) pour
// la tête de section, le fond et la tuile. Le BANDEAU DÉFILANT, lui, n'a pas de source
// dans la maquette : celle-ci rend 3 murs étiquetés à tuiles nommées, et c'est
// l'arbitrage de Brice du 2026-07-30 qui a tranché en faveur du bandeau (l'AC de
// `epics.md` était donc juste, ce sont UX-DR12 / la maquette / FR13 / DESIGN.md /
// EXPERIENCE.md qui constituaient l'écart — les 5 documents ont été corrigés).
//
// Server Component : aucune interactivité propre. Seul `PartnerMarquee` porte
// `'use client'` (project-context.md §5 — jamais un parent). Ce composant ne requête pas
// la base : `page.tsx` lit et distribue en props (patron AC1 de la 3.2).
//
// Vit dans `components/proof/` et non `components/home/` : `architecture.md` (l.560)
// nomme cette famille pour le groupe C, et la Story 4.2 réutilisera le rendu d'un
// partenaire sur la page `/partenaires`.
//
// Les formulations sont CONTRACTUELLES (UX-DR18) — ne pas les reformuler.
// « Devenir partenaire » vient du mapping figé d'EXPERIENCE.md (l.67, UX-DR19).

export interface ProofBandProps {
  /**
   * Les partenaires publiés QUI ONT UN LOGO, dans l'ordre du bandeau.
   * Peut être vide — voir la garde ci-dessous.
   */
  partners: PartnerTile[];
}

export function ProofBand({ partners }: ProofBandProps) {
  // 🔴 AUCUNE PREUVE ⇒ AUCUN BLOC. Pas de tête de section orpheline, pas de cadre vide,
  // pas de « prochainement ». Un bloc de preuve sans preuve n'est pas un état vide
  // chaleureux (le patron UX-DR20 de l'agenda) : c'est un aveu. La différence avec le
  // hub événementiel est réelle et assumée — « pas de jeudi calé » est une information
  // utile au visiteur, « personne ne nous soutient » n'en est pas une.
  //
  // ⚠️ Le cas n'est PAS théorique : le filtre `logo IS NOT NULL` le rend atteignable
  // dès qu'aucun fichier n'est en place (état du dépôt jusqu'à cette story), et il le
  // restera tant que le back-office (6.5) laissera saisir un partenaire sans logo.
  if (partners.length === 0) return null;

  // `logo` arrive typé `string | null` : Drizzle ne sait pas que le `WHERE` de
  // `getPartnersWithLogo()` l'a déjà exclu. On affine ICI, une seule fois, plutôt que
  // de semer des `!` non vérifiés dans le markup du bandeau.
  const tuiles = partners.map(({ id, name, logo }) => ({ id, name, logo: logo ?? "" }));

  return (
    // aria-labelledby ↔ id du <h2> de la tête de section (patron acquis review 1.6 F6).
    <section className={styles.section} aria-labelledby="proof-title">
      <Wrap>
        <SectionHead
          eyebrow="La preuve par les actes"
          titleId="proof-title"
          title={
            <>
              {/* {" "} explicite : JSX avale l'espace en fin de ligne avant un nœud
                  (leçon 2.6). Sans lui on lirait « soutenus,connectés ». */}
              Reconnus, soutenus, <Brush>connectés</Brush>
            </>
          }
          intro="Pas de chiffres en l'air — présents sur le terrain, adhérents France Esport, connectés dans tout le Grand Est."
        />

        {/* 🔴 `motion.reveal` EST POSÉ ICI, ET SÛREMENT PAS SUR LA <section> — c'est le
            cas que `motion.module.css` avait NOMMÉMENT prévu à l'intention des Epics
            3/4/5 : « si une section devait un jour porter du --grey sur --navy, ce
            motif redeviendrait NON CONFORME sur elle ».
            Cette section EST ce cas : elle pose `background: var(--navy)` (maquette
            `.proof`) et le chapô de SectionHead rend `var(--grey)`. À pleine opacité la
            combinaison donne 4,60:1 — conforme, mais avec 0,10 de marge ; or
            `motion.reveal` part de `opacity: 0.75`, ce qui mélange 25 % de fond dans le
            texte et fait tomber le rapport à 3,24:1 pendant toute l'apparition.
            Ce <div> n'enveloppe donc QUE le bandeau et le renvoi, dont les couleurs ont
            été CALCULÉES sous fondu (mesures en fin de ProofBand.module.css). Le
            SectionHead reste à l'opacité 1.
            ⚠️ Ne pas « simplifier » en remontant cette classe sur la <section> : c'est
            exactement le même montage qu'`EventHub` (l.84-95), et pour la même raison. */}
        <div className={motion.reveal}>
          <PartnerMarquee tiles={tuiles} label="Nos partenaires et soutiens" />

          {/* Un `LinkArrow` et NON un `Button` : la home comptait déjà deux CTA vers
              /partenaires, et cette story vient d'en SUPPRIMER un pour redondance (le
              « Nous solliciter » d'AnimationsTeaser, AC7). Un troisième bouton or
              rouvrirait le défaut qu'on solde.
              Route INTERNE : ni target, ni rel, ni mention « nouvel onglet ».
              /partenaires est créée en Story 4.2 → 404 ATTENDU d'ici là, comme les
              cibles du hero (2.1) et des axes (2.2). Ne pas retomber sur href="#"
              (scroll-to-top + annonce trompeuse). */}
          <div className={styles.more}>
            <LinkArrow href="/partenaires">Devenir partenaire</LinkArrow>
          </div>
        </div>
      </Wrap>
    </section>
  );
}
