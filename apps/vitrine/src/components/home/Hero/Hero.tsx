import Image from "next/image";
import {
  Brush,
  Button,
  CrownWatermark,
  Eyebrow,
  LinkArrow,
  PhotoFrame,
  Sticker,
} from "@repo/ui";
import { Wrap } from "@/components/common/Wrap/Wrap";
import styles from "./Hero.module.css";

// Hero de l'accueil (Story 2.1) — Server Component pur : toute l'animation est en
// CSS (apparition + pulse du sticker), donc aucun 'use client'. La home reste
// prérendue Static, acquis de la Story 1.6.
//
// Composé EXCLUSIVEMENT à partir des primitives @repo/ui livrées en Story 1.3 :
// aucune brique visuelle n'est réimplémentée ici, seul le layout est local.
//
// Les formulations sont CONTRACTUELLES (UX-DR18) — ne pas les reformuler.
export function Hero() {
  return (
    // aria-labelledby ↔ id du <h1> : nomme la région (pattern acquis review 1.6 F6).
    // Le <main id="content"> est fourni par (public)/layout.tsx → pas de <main> ici.
    <section className={styles.hero} aria-labelledby="home-title">
      {/* Filigrane décoratif (aria-hidden + alt="" portés par la primitive).
          height=204 est OBLIGATOIRE : couronne-eds.png fait 352×211, PAS un carré.
          Sans elle, le défaut `height = width` réserverait 340×340 → saut de mise
          en page au chargement (CLS). 340 × 211 / 352 ≈ 204. */}
      <CrownWatermark
        src="/couronne-eds.png"
        width={340}
        height={204}
        className={styles.crown}
      />

      {/* `.grid` est FUSIONNÉE dans Wrap (Story 2.10) : aucun nœud DOM ajouté, donc
          le sélecteur `.grid > *` qui porte l'apparition du hero continue de viser
          les deux colonnes ci-dessous. */}
      <Wrap className={styles.grid}>
        <div>
          <Eyebrow>Reims · depuis 2022</Eyebrow>

          {/* Lignes en <span display:block> plutôt qu'en <br> : les séparateurs
              {" "} garantissent un texte accessible « Jouer. Se retrouver.
              Transmettre. » tout en gardant le rendu sur 3 lignes. */}
          <h1 id="home-title" className={styles.title}>
            <span className={styles.line}>Jouer.</span>{" "}
            <span className={styles.line}>Se retrouver.</span>{" "}
            <span className={styles.line}>
              {/* <span> et non <em> : l'or est purement décoratif ici, un <em>
                  annoncerait une emphase non voulue aux lecteurs d'écran. */}
              <span className={styles.accent}>
                <Brush>Transmettre.</Brush>
              </span>
            </span>
          </h1>

          <p className={styles.lead}>
            À Reims et dans le Grand Est, on fait vivre le jeu vidéo{" "}
            <strong>en vrai</strong> — comme un sport, et surtout comme un moment
            ensemble.
          </p>

          <p className={styles.small}>
            Une asso locale et conviviale. Viens comme tu es, même sans manette.
          </p>

          {/* /agenda (Epic 3) et /l-asso (Story 2.6) ne sont pas encore créées :
              ces liens renvoient un 404 par défaut, comportement ATTENDU et
              cohérent avec le SiteHeader depuis la Story 1.4. Ne pas retomber sur
              href="#" (scroll-to-top + annonce trompeuse, cf. review 1.4 #1). */}
          <div className={styles.cta}>
            <Button variant="gold" href="/agenda">
              Voir l&apos;agenda
            </Button>
            <LinkArrow href="/l-asso">Découvrir l&apos;asso</LinkArrow>
          </div>
        </div>

        {/* PhotoFrame n'expose pas de `className` → l'enveloppe porte le placement
            dans la grille et la marge mobile. */}
        <div className={styles.photoCol}>
          <PhotoFrame
            rotation={2}
            caption="On se retrouve au bar ✦ Reims"
            sticker={
              <Sticker className={styles.sticker}>
                {/* Deux blocs plutôt qu'un <br> : le conteneur du Sticker est un
                    flex, un <br> y deviendrait un item et casserait l'empilement.
                    Le {" "} sépare le texte accessible (« CE JEUDI » et non
                    « CEJEUDI ») — même raison que les lignes du <h1>. Un nœud de
                    texte blanc seul n'est pas rendu comme item flex : aucun effet
                    visuel. */}
                <span className={styles.stickerLines}>
                  <span>CE</span>{" "}
                  <span>JEUDI</span>
                </span>
              </Sticker>
            }
          >
            {/* ⚠️ CÂBLAGE PROVISOIRE — ce n'est PAS l'implémentation de la Story 4.7.
                Posé hors story, sur arbitrage de Brice (2026-07-28), pour remplacer
                le placeholder par une image réelle en attendant. Dette R15.

                Ce qui MANQUE et que la Story 4.7 doit livrer :
                  - une photo en HAUTE DÉFINITION — celle-ci fait 922×480, et le
                    recadrage 4/3 de PhotoFrame n'en laisse que 640px utiles pour un
                    besoin d'environ 950px en retina (colonne photo ≈ 476px) ;
                  - `sizes` + l'optimisation Next (jeu de tailles responsive) ;
                  - le passage par le back-office (Epic 6), qui portera l'upload.

                `unoptimized` est DÉLIBÉRÉ ici : `sharp` est absent de ce workspace,
                et sans lui l'optimiseur d'images échoue à l'exécution — l'AVIF est
                donc servi tel quel. À retirer en 4.7, avec sharp installé.

                Dimensions intrinsèques 922×480 → aspect-ratio réservé, aucun CLS.
                Le recadrage vient de PhotoFrame (`aspect-ratio: 4/3` +
                `object-fit: cover`), pas d'ici.

                ⚠️ Les visages sont identifiables : le consentement des personnes
                photographiées doit être acquis AVANT la mise en service du VPS.
                Rien n'est publié tant que le site n'est pas en ligne. */}
            <Image
              src="/photos/soiree-bar-eds-01.avif"
              alt="Une soirée Esport des Sacres dans un bar rémois : des joueurs attablés devant un écran de jeu, sous le kakémono de l'association."
              width={922}
              height={480}
              priority
              unoptimized
            />
          </PhotoFrame>
        </div>
      </Wrap>
    </section>
  );
}
