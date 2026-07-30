"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import styles from "./PastCarousel.module.css";

// Carrousel des événements passés (Story 3.3) — `/agenda` uniquement.
//
// 🔴 LE DÉFILEMENT EST NATIF, LE JAVASCRIPT N'EST QU'UN BONUS.
// La piste est un conteneur `overflow-x: auto` + `scroll-snap` : glisser au doigt, à la
// molette ou au clavier fonctionne SANS ce composant. Les flèches ci-dessous ne font
// qu'ajouter un raccourci. Conséquences voulues :
//   - les 4 événements sont TOUJOURS dans le DOM et dans le fil d'accessibilité, à un
//     geste de distance — on ne masque rien avec `display: none` ni `visibility: hidden`,
//     ce que motion.module.css interdit explicitement ;
//   - si le JS ne charge pas, la section reste pleinement utilisable.
// Un carrousel « une vignette à la fois » piloté en JS aurait rendu 3 événements sur 4
// inatteignables sans JS, pour un résultat moins robuste et plus de code.
//
// 🔴 SEUL CE COMPOSANT EST CLIENT. Les blocs d'événement arrivent en `children` :
// ce sont des Server Components rendus par la page, ils ne traversent jamais la
// frontière client (project-context.md §5 : `'use client'` uniquement sur le composant
// qui porte réellement l'interactivité, jamais sur un parent).
//
// ⚠️ La porte outillée sait désormais distinguer « conteneur défilant volontaire » de
// « débordement rogné en silence » (probe.mjs, exclusion n°3), et `gate:selftest`
// prouve qu'elle n'en est pas devenue aveugle pour autant.

export interface PastCarouselProps {
  /** Les vignettes, rendues côté serveur. */
  children: ReactNode;
  /** Nom accessible de la région défilante. */
  label: string;
}

export function PastCarousel({ children, label }: PastCarouselProps) {
  const piste = useRef<HTMLDivElement>(null);
  // 🔴 Les flèches n'existent qu'APRÈS l'hydratation. Le premier rendu client est donc
  // identique au rendu serveur (aucune discordance d'hydratation), et un navigateur
  // sans JS n'affiche jamais des boutons qui ne feraient rien.
  const [enhanced, setEnhanced] = useState(false);
  // `defilable` : y a-t-il seulement quelque chose à faire défiler ? Tant qu'il n'y a
  // qu'une vignette (l'état RÉEL de la production au démarrage, tant que l'équipe n'a
  // pas saisi d'historique), afficher deux flèches inertes serait deux commandes
  // mortes. Défaut attrapé par `gate:carousel` sur l'état à une seule vignette.
  const [position, setPosition] = useState({ debut: true, fin: true, defilable: false });

  const mesurer = useCallback(() => {
    const el = piste.current;
    if (!el) return;
    // 1px de tolérance : les navigateurs rendent des positions de défilement
    // sub-pixel, et un `scrollLeft` de 0,4px ferait clignoter l'état « début ».
    const max = el.scrollWidth - el.clientWidth;
    setPosition({
      debut: el.scrollLeft <= 1,
      fin: el.scrollLeft >= max - 1,
      defilable: max > 1,
    });
  }, []);

  /**
   * 🔴 CALLBACK DE REF, ET NON `useEffect` — deux raisons, dans cet ordre :
   *  1. **correction** : la mesure a besoin du nœud, et un callback de ref s'exécute
   *     exactement quand le nœud existe (et se nettoie quand il disparaît). Un effet
   *     doit lire un ref en espérant qu'il soit déjà rempli ;
   *  2. la règle `react-hooks/set-state-in-effect` refuse d'appeler `setState`
   *     directement dans un effet — elle a d'ailleurs raison ici, ce n'est pas de la
   *     synchronisation d'état mais une **lecture du DOM**.
   *
   * Le retour de fonction (nettoyage) est une capacité de React 19 : les écouteurs
   * partent avec le nœud, sans dépendance à un tableau de dépendances.
   */
  const attacherPiste = useCallback(
    (node: HTMLDivElement | null) => {
      piste.current = node;
      if (!node) return;
      // Les flèches n'apparaissent qu'ici : si ce code ne tourne pas (pas de JS),
      // aucun bouton inerte n'est rendu.
      setEnhanced(true);
      mesurer();
      node.addEventListener("scroll", mesurer, { passive: true });
      // La largeur des vignettes dépend du viewport : un redimensionnement change ce
      // qui est atteignable, donc l'état des flèches.
      window.addEventListener("resize", mesurer);
      return () => {
        node.removeEventListener("scroll", mesurer);
        window.removeEventListener("resize", mesurer);
        piste.current = null;
      };
    },
    [mesurer],
  );

  const faireDefiler = (sens: -1 | 1) => {
    const el = piste.current;
    if (!el) return;
    // On avance d'une vignette : la largeur de la première + la gouttière RÉELLE,
    // lue dans le style calculé plutôt que recopiée du CSS (une valeur en double
    // divergerait au premier ajustement).
    const liste = el.firstElementChild;
    const premier = liste?.firstElementChild as HTMLElement | null;
    const gap = liste ? Number.parseFloat(getComputedStyle(liste).columnGap) || 0 : 0;
    const pas = premier ? premier.getBoundingClientRect().width + gap : el.clientWidth;
    // Pas de `behavior` explicite : `scrollBy` suit alors la propriété CSS
    // `scroll-behavior`, qui n'est en `smooth` que sous `prefers-reduced-motion:
    // no-preference`. Le respect du mouvement réduit reste donc dans la feuille de
    // style, en un seul endroit.
    el.scrollBy({ left: sens * pas });
  };

  return (
    <div className={styles.carousel}>
      {/* Les flèches sont AU-DESSUS de la piste dans le DOM : un utilisateur au
          clavier les rencontre avant d'entrer dans la région défilante, ce qui est
          l'ordre utile (on choisit de naviguer avant de parcourir). */}
      {enhanced && position.defilable ? (
        <div className={styles.commandes}>
          <button
            type="button"
            className={styles.fleche}
            onClick={() => faireDefiler(-1)}
            disabled={position.debut}
            aria-label="Voir les événements plus récents"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M15 6l-6 6 6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className={styles.fleche}
            onClick={() => faireDefiler(1)}
            disabled={position.fin}
            aria-label="Voir les événements plus anciens"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M9 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      ) : null}

      {/* 🔴 DEUX NŒUDS, ET C'EST NÉCESSAIRE — un premier jet les avait fusionnés.
          `tabIndex={0}` + `role="group"` + `aria-label` : une région défilante DOIT
          être atteignable au clavier (WCAG 2.1.1 ; audit axe
          `scrollable-region-focusable`). Avec le focus dessus, les flèches du clavier
          font défiler nativement.
          MAIS `role="group"` posé sur le `<ul>` lui-même ÉCRASE son rôle de liste, et
          ses `<li>` deviennent alors des éléments de liste orphelins — perte de
          sémantique doublée d'un risque d'audit `aria-required-children`. La région
          défilante est donc un `<div>`, et la liste reste une vraie liste à
          l'intérieur. */}
      <div
        ref={attacherPiste}
        className={styles.viewport}
        tabIndex={0}
        role="group"
        aria-label={label}
      >
        <ul className={styles.piste} role="list">
          {children}
        </ul>
      </div>
    </div>
  );
}
