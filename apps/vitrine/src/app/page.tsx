import {
  Axis,
  Brush,
  Button,
  Eyebrow,
  LinkArrow,
  PhotoFrame,
  Sticker,
  Tag,
} from "@repo/ui";
import styles from "./page.module.css";

// Démo des primitives (Story 1.3) : prouve que la chaîne @repo/ui → CSS Module →
// transpilePackages résout au build/dev, à la charte (or/navy/Bebas).
// Remplacé par le vrai Hero + sections en Epic 2 (Story 2.1+).
export default function Home() {
  return (
    <main className={styles.main}>
      <Eyebrow>Design system EDS</Eyebrow>
      <h1 className={styles.title}>
        Les <Brush>primitives</Brush> sont en place
      </h1>
      <p className={styles.lead}>
        Boutons, étiquettes, cadres photo et signatures de marque sont câblés
        depuis <code>@repo/ui</code>, à la charte officielle.
      </p>

      <div className={styles.row}>
        <Button
          href="https://www.helloasso.com/"
          icon={
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M4 12h14M13 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        >
          Rejoindre
        </Button>
        <Button variant="outline">Nous solliciter</Button>
      </div>

      <div className={styles.row}>
        <Tag>Jeudi</Tag>
        <Tag variant="highlight">Temps fort</Tag>
        <LinkArrow href="/agenda">Voir l’agenda</LinkArrow>
      </div>

      <div className={styles.frames}>
        <PhotoFrame
          caption="ambiance du jeudi"
          rotation={2}
          sticker={<Sticker>CE JEUDI</Sticker>}
        />
        <PhotoFrame caption="le réseau rémois" />
      </div>

      <section className={styles.axes}>
        <Axis number="01" title="Local & vivant">
          Tous les jeudis, en roulement sur quatre bars rémois.
        </Axis>
        <Axis number="02" title="L’esport qui rassemble">
          Des rendez-vous chaleureux, ouverts à toutes et tous.
        </Axis>
        <Axis number="03" title="Sérieux & connecté">
          Un collectif structuré, accrédité et bien entouré.
        </Axis>
      </section>
    </main>
  );
}
