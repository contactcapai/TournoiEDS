import type { ReactNode } from "react";
import styles from "./Wrap.module.css";

export interface WrapProps {
  children: ReactNode;
  /**
   * Classes de l'appelant, FUSIONNÉES avec celles du conteneur (jamais remplacées).
   * Indispensable aux appelants dont le conteneur central porte AUSSI une mise en
   * page — le `.grid` du Hero, la barre flex du SiteHeader : sans ça, ils devraient
   * ajouter un nœud DOM pour adopter ce composant.
   */
  className?: string;
}

// Wrap — conteneur central de la vitrine (`.wrap` de la maquette : 1160px, centré,
// gouttière de 26px). Server Component, comme tout ce qui n'a pas d'interactivité.
//
// Extrait en Story 2.4 : les 3 déclarations étaient déjà écrites QUATRE fois
// (Hero `.grid`, ThreeAxes `.wrap`, SiteHeader, SiteFooter `.wrap`) — le décompte
// annoncé en Story 2.2 (« 2ᵉ occurrence ») ne comptait que les sections de la home.
//
// ⚠️ Les 4 consommateurs existants ne sont PAS migrés ici, et ce n'est pas un oubli :
// SiteHeader/SiteFooter sont le chrome de TOUTES les pages, et mêler ce refactor à une
// story de rendu rendrait le gate visuel ambigu. Dette R9 → Story 2.10.
//
// API volontairement minimale : pas de prop `as`/`tag` « au cas où ». Le jour où un
// appelant a besoin d'un autre élément, on l'ajoute — même trajectoire que SectionHead.
export function Wrap({ children, className }: WrapProps) {
  // Concaténation à la main : `cn()` vit dans packages/ui/src/lib/ et n'est PAS
  // exportée par le barrel @repo/ui (qui n'expose que tokens + primitives).
  const classes = [styles.wrap, className].filter(Boolean).join(" ");

  return <div className={classes}>{children}</div>;
}
