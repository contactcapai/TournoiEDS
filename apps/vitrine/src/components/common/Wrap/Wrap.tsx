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
   * décide PAS de la cascade. À spécificité égale, c'est l'ordre du CSS *compilé*
   * qui tranche, et cet ordre est instable chez Turbopack.
   *
   * RÈGLE : une classe passée ici ne doit JAMAIS redéclarer `max-width`, `margin`
   * ni `padding` — les 3 propriétés réservées de `.wrap`. Elle complète, elle ne
   * surcharge pas. Aujourd'hui AUCUN des 19 sites de consommation ne la viole, et
   * c'est ce qui rend le sujet inoffensif — pas un mécanisme de cascade.
   *
   * ⚠️ Les CSS Cascade Layers ont été essayés en Story 2.10 pour verrouiller ça, et
   * ÉCARTÉS SUR MESURE : ils cassaient le conteneur (le reset non layeré
   * `* { margin: 0; padding: 0 }` l'emportait), et leur parade dépendait elle-même
   * de l'ordre d'émission. Raisonnement complet dans Wrap.module.css.
   *
   * La garde réelle est la MESURE de géométrie de la Story 2.10 — comportementale,
   * donc elle attrape une violation future (« un avertissement en commentaire n'est
   * pas une garde », 00 référence/pieges/avertissement-commentaire.md).
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
// Les 4 consommateurs pré-2.4 ont été migrés en Story 2.10 : ce composant est
// désormais la SEULE définition du conteneur central du site. Porte mesurée sur le
// HTML servi (et non sur les sources) : les classes CSS Modules compilées portent le
// nom de leur fichier, donc `Wrap:wrap` doit être la seule classe à porter
// `max-width: 1160px` sur les 3 pages publiques.
//
// API volontairement minimale : pas de prop `as`/`tag` « au cas où ». Le jour où un
// appelant a besoin d'un autre élément, on l'ajoute — même trajectoire que SectionHead.
export function Wrap({ children, className }: WrapProps) {
  // Concaténation à la main : `cn()` vit dans packages/ui/src/lib/ et n'est PAS
  // exportée par le barrel @repo/ui (qui n'expose que tokens + primitives).
  const classes = [styles.wrap, className].filter(Boolean).join(" ");

  return <div className={classes}>{children}</div>;
}
