import { cn } from "../../lib/cn";
import styles from "./ExternalIcon.module.css";

export interface ExternalIconProps {
  /** Classe additionnelle (rare — la taille canonique est portée par la primitive). */
  className?: string;
}

// ExternalIcon — indication VISUELLE « ce lien sort du site » (EXPERIENCE.md l.199,
// qui l'exige pour Tournois, HelloAsso, les réseaux et les logos partenaires).
//
// 🔴 CONSOLIDATION DE DEUX COPIES (Story 5.5, dette R12). Ce tracé vivait en DOUBLE :
// `MobileMenu.tsx` (composant client) et `SiteFooter.tsx` (RSC), avec le même `d`,
// les mêmes attributs ET le même CSS (13×13, flex-shrink: 0). La duplication était
// assumée en Story 1.5 (« Garde-fou n°3 : garder le header strictement iso-comportement »),
// mais elle a coûté une 3ᵉ occurrence manquante : les CTA `Button` sortants
// (« Nous rejoindre », « Adhérer via HelloAsso », « Accéder à la plateforme ») n'ont
// JAMAIS eu d'icône, faute d'un composant atteignable depuis eux.
//
// 🔴 PAS DE `'use client'` — et c'est une contrainte, pas une omission. Cette primitive
// n'a ni état ni handler : elle est consommable des deux côtés de la frontière. En poser
// un contaminerait `SiteFooter`, `DoubleDoor` et `TournamentBridge`, qui sont des Server
// Components (project-context.md §5 : « 'use client' UNIQUEMENT sur le composant qui porte
// réellement l'interactivité, JAMAIS un parent »).
//
// DÉCORATIVE : `aria-hidden` + `focusable="false"`. Le sens est porté par le texte lecteur
// d'écran (`NEW_TAB_SR` de `lib/links.ts`), jamais par l'icône — un pictogramme ne parle
// qu'aux voyants. Les deux vont toujours ensemble.
export function ExternalIcon({ className }: ExternalIconProps) {
  return (
    <svg
      className={cn(styles.icon, className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M14 5h5v5M19 5l-9 9M9 6H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
