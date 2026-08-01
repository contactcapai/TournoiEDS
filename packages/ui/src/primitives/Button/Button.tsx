import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "../../lib/cn";
import styles from "./Button.module.css";

type ButtonVariant = "gold" | "outline";

interface ButtonOwnProps {
  /** `gold` (rempli or, défaut) ou `outline` (transparent, bord crème). */
  variant?: ButtonVariant;
  /** Icône SVG optionnelle, rendue après le label (purement décorative côté charte). */
  icon?: ReactNode;
  children?: ReactNode;
}

// Polymorphe : rend <a> si `href` est fourni, <span> si `inactive`, sinon
// <button type="button">. Union discriminée → props natives adaptées à l'élément.
type ButtonAsButton = ButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps | "href"> & {
    href?: undefined;
    inactive?: undefined;
  };

type ButtonAsLink = ButtonOwnProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonOwnProps> & {
    href: string;
    inactive?: undefined;
  };

/**
 * 🔴 CTA SANS DESTINATION — Story 5.5. **Une destination absente ne fabrique pas un lien.**
 *
 * Rend un `<span>` portant l'apparence du bouton : ni `href`, ni `role`, ni focus, ni
 * curseur main, et rien d'annoncé au lecteur d'écran. C'est la doctrine déjà arbitrée
 * et revue en Story 4.2 (`PartnerWall` : *« PAS un `<a>` sans href, PAS un
 * `<div role="link">` : une tuile sans lien n'est pas interactive du tout »*).
 *
 * ⚠️ NE PAS « SIMPLIFIER » EN OMETTANT `href` : `Button` rendrait alors son
 * `<button type="button">`, qui est **focalisable et cliquable**. On aurait un CTA qui
 * prend le focus au clavier et ne fait rien — c'est-à-dire le défaut R2 déplacé, pas corrigé.
 *
 * ⚠️ `inactive` est EXCLUSIF de `href` : le type refuse `<Button inactive href="…" />`,
 * qui serait une contradiction (il y a une destination, ou il n'y en a pas).
 */
type ButtonAsInert = ButtonOwnProps & {
  href?: undefined;
  inactive: true;
  className?: string;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink | ButtonAsInert;

export function Button(props: ButtonProps) {
  const { variant = "gold", icon, children, className, ...rest } = props;

  const classes = cn(
    styles.btn,
    variant === "gold" ? styles.btnGold : styles.btnOut,
    // Porte l'affordance (survol, curseur) — voir Button.module.css. Une destination
    // absente ne doit PAS réagir à la souris : un élément inerte qui s'illumine
    // fabrique une affordance et annule la moitié du bénéfice de l'inertie.
    props.inactive === true ? undefined : styles.btnActif,
    className,
  );

  if (props.inactive === true) {
    // `data-inerte` : témoin STABLE pour la porte `gate:links`. Attribut de données et
    // non classe CSS Modules — une classe est hachée à la compilation et une règle vide
    // disparaît à la minification (leçons 2.10 et 5.1).
    return (
      <span className={classes} data-inerte="">
        {children}
        {icon}
      </span>
    );
  }

  if (props.href !== undefined) {
    // `rest` contient déjà `href` (link case) + les attributs natifs <a>.
    const anchorRest = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a className={classes} {...anchorRest}>
        {children}
        {icon}
      </a>
    );
  }

  const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type="button" className={classes} {...buttonRest}>
      {children}
      {icon}
    </button>
  );
}
