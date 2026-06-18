import type { AnchorHTMLAttributes, ReactNode } from "react";
import styles from "./LinkArrow.module.css";

interface LinkArrowOwnProps {
  href: string;
  children: ReactNode;
  /** Lien externe : ajoute target/rel + mention « nouvel onglet » pour lecteurs d'écran. */
  external?: boolean;
}

export type LinkArrowProps = LinkArrowOwnProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkArrowOwnProps>;

// LinkArrow — lien d'action or avec flèche glissante (décorative) au hover.
export function LinkArrow({
  href,
  children,
  external = false,
  className,
  ...rest
}: LinkArrowProps) {
  const externalProps = external
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <a
      className={[styles.linkArrow, className].filter(Boolean).join(" ")}
      href={href}
      {...externalProps}
      {...rest}
    >
      {children}
      {external && <span className={styles.srOnly}> (nouvel onglet)</span>}
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
    </a>
  );
}
