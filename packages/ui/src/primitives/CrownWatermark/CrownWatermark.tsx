import { cn } from "../../lib/cn";
import styles from "./CrownWatermark.module.css";

export interface CrownWatermarkProps {
  /** Chemin de l'asset couronne (placé dans le public/ de l'APP, jamais bundlé ici). */
  src: string;
  /** Largeur du filigrane (défaut 340px, valeur maquette du Hero). */
  width?: number;
  /** Hauteur du filigrane. Défaut = `width` (asset supposé carré). Toujours fournie
   *  comme attribut → le navigateur réserve l'espace avant chargement (évite le CLS).
   *  Passer la vraie hauteur si l'asset n'est pas carré. */
  height?: number;
  /** Classe de positionnement fournie par le contexte (ex. coin du Hero, Story 2.1). */
  className?: string;
}

// CrownWatermark — filigrane couronne (opacity .05, rotate 8°). Purement décoratif :
// aria-hidden + alt="". Asset-agnostique : l'app fournit `src` (aucun binaire dans @repo/ui).
export function CrownWatermark({
  src,
  width = 340,
  height = width,
  className,
}: CrownWatermarkProps) {
  return (
    <img
      className={cn(styles.crownWm, className)}
      src={src}
      width={width}
      height={height}
      alt=""
      aria-hidden="true"
    />
  );
}
