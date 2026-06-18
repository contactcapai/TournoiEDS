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

// Polymorphe : rend <a> si `href` est fourni, sinon <button type="button">.
// Union discriminée sur la présence de `href` → props natives adaptées à l'élément.
type ButtonAsButton = ButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonOwnProps | "href"> & {
    href?: undefined;
  };

type ButtonAsLink = ButtonOwnProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonOwnProps> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
  const { variant = "gold", icon, children, className, ...rest } = props;

  const classes = cn(
    styles.btn,
    variant === "gold" ? styles.btnGold : styles.btnOut,
    className,
  );

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
