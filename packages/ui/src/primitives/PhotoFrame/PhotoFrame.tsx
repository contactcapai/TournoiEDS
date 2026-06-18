import type { CSSProperties, ReactNode } from "react";
import styles from "./PhotoFrame.module.css";

interface PhotoFrameProps {
  /** Média fourni par l'app (<img> / next/image). Si absent → placeholder « tirage ». */
  children?: ReactNode;
  /** Légende manuscrite (Caveat, ink sur cream — lisible). */
  caption?: string;
  /** Rotation optionnelle du cadre, en degrés (effet « tirage » posé de travers). */
  rotation?: number;
  /** Macaron optionnel (Sticker) positionné sur le cadre. */
  sticker?: ReactNode;
}

// PhotoFrame — cadre crème type tirage photo. Asset-agnostique : l'app fournit le
// média en children (jamais de dépendance next/image ici → @repo/ui reste portable).
export function PhotoFrame({
  children,
  caption,
  rotation,
  sticker,
}: PhotoFrameProps) {
  const frameStyle: CSSProperties | undefined =
    rotation === undefined ? undefined : { transform: `rotate(${rotation}deg)` };

  return (
    <figure className={styles.photo} style={frameStyle}>
      {sticker}
      <div className={styles.img}>
        {children ?? (
          <div className={styles.phFill} aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path
                d="M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="8.5" cy="9" r="1.5" fill="currentColor" />
            </svg>
            <span>Photo à venir</span>
          </div>
        )}
      </div>
      {caption && <figcaption className={styles.cap}>{caption}</figcaption>}
    </figure>
  );
}
