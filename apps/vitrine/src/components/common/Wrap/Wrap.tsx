import type { ReactNode } from "react";
import styles from "./Wrap.module.css";

export interface WrapProps {
  children: ReactNode;
  /**
   * Classes de l'appelant, ajoutées à celle du conteneur (jamais substituées).
   * Indispensable aux appelants dont le conteneur central porte AUSSI une mise en
   * page — le `.grid` du Hero, la barre flex du SiteHeader : sans ça, ils devraient
   * ajouter un nœud DOM pour adopter ce composant.
   *
   * ⚠️ CE QUE CETTE FUSION NE FAIT PAS : elle concatène l'attribut `class`, elle ne
   * décide PAS de la cascade. À spécificité égale, c'est l'ordre des règles dans le
   * CSS *compilé* qui tranche — or cet ordre est un détail d'implémentation du
   * bundler (mesuré sur le bundle Turbopack : il ne suit ni l'ordre du DOM, ni celui
   * des imports, ni l'alphabet) et il peut changer d'un build à l'autre.
   *
   * RÈGLE : une classe passée ici ne doit JAMAIS redéclarer `max-width`, `margin`
   * ni `padding` — les 3 propriétés réservées de `.wrap`. Elle complète, elle ne
   * surcharge pas. Ce commentaire documente ; la GARDE est l'AC dédiée de la
   * Story 2.10 (« un avertissement en commentaire n'est pas une garde »,
   * 00 référence/pieges/avertissement-commentaire.md).
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
