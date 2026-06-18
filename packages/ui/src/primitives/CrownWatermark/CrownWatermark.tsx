import styles from "./CrownWatermark.module.css";

interface CrownWatermarkProps {
  /** Chemin de l'asset couronne (placé dans le public/ de l'APP, jamais bundlé ici). */
  src: string;
  /** Largeur du filigrane (défaut 340px, valeur maquette du Hero). */
  width?: number;
  /** Classe de positionnement fournie par le contexte (ex. coin du Hero, Story 2.1). */
  className?: string;
}

// CrownWatermark — filigrane couronne (opacity .05, rotate 8°). Purement décoratif :
// aria-hidden + alt="". Asset-agnostique : l'app fournit `src` (aucun binaire dans @repo/ui).
export function CrownWatermark({
  src,
  width = 340,
  className,
}: CrownWatermarkProps) {
  return (
    <img
      className={[styles.crownWm, className].filter(Boolean).join(" ")}
      src={src}
      width={width}
      alt=""
      aria-hidden="true"
    />
  );
}
