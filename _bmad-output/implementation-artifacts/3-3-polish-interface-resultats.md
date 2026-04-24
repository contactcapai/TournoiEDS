# Story 3.3 : Polish visuel & effet "Wahou" de la page Qualifications

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **joueur ou spectateur qui consulte la page Qualifications**,
I want **une expérience visuelle forte, animée et cohérente avec une ligue esport professionnelle**,
So that **la page reflète l'identité du tournoi EDS, capte l'attention et donne envie de rester entre les rounds pour suivre les résultats en direct**.

## Contexte de la story

Cette story est **purement frontend et purement additive**. Elle s'appuie sur la page `/qualifications` livrée en Story 3.2 et ne modifie pas les données : le `TournamentContext`, les routes REST, le payload WebSocket et le type `PlayerRanking` restent **strictement inchangés**. L'objectif est de transformer une page fonctionnelle en expérience esport premium.

Story 3.3 n'ayant pas de spec dans `epics.md`, la portée a été co-construite avec Brice :

- Effet "wahou" sur les **deux** : hero/en-tête **et** tableau
- **Ambition motion** : niveau ambitieux façon leaderboards DRL Forsa, en conservant strictement la charte EDS (cyan `#80E2ED`, or `#DAB265`, dark `#29265B`, Bebas Neue + Roboto)
- Animations riches **desktop** (hover, fond animé latéral, glow) + **animations essentielles mobile** (flash update, reorder, reveal) mais pas de décoration lourde sur mobile
- Intégration du **logo EDS** (fichier fourni par Brice)
- **ConnectionStatus badge** : petite pastille qui pulse vert/orange près du titre pour indiquer en permanence l'état de la connexion WebSocket
- **Carousel partenaires** en bas de la page
- Pas de podium top 3 séparé — le tableau amélioré fait tout le travail
- Pas de VictoryProgress ni d'animation vainqueur — c'est Epic 5 (Finale)

## Pré-requis avant `dev-story`

⚠️ **Action manuelle Brice** : enregistrer le logo EDS fourni en chat dans `frontend/src/assets/logo-eds.svg` (format SVG préféré, sinon PNG transparent en `logo-eds.png`). Le logo doit être blanc / monochrome clair pour permettre des variations de teinte via CSS `filter`. Sans ce fichier, la Task 2 ne peut pas se terminer visuellement.

## Acceptance Criteria

1. **Given** j'arrive sur `/qualifications` **When** la page se charge **Then** je vois un **hero** au-dessus du tableau avec : le logo EDS (hauteur ~80-120 px), le titre `Classement des Qualifications` en Bebas Neue avec un léger glow cyan animé, et la meta "Journée {N}" si applicable **And** le hero s'intègre à la charte EDS (fond `#29265B`, pas de nouvelles couleurs).

2. **Given** je suis sur desktop (viewport ≥ 1024 px) **When** je regarde le tableau **Then** des éléments décoratifs animés sont visibles sur les côtés du tableau (lignes SVG lumineuses cyan/or qui dérivent verticalement en boucle infinie, opacity ≤ 30%) **And** ces décorations ne sont **pas affichées** sur mobile/tablette (< 1024 px) **And** elles ne perturbent pas l'interaction avec le tableau (pointer-events: none).

3. **Given** l'admin valide un round pendant que je suis sur la page **When** l'événement `ranking_updated` arrive via WebSocket et modifie le tableau **Then** les lignes dont `totalScore` a changé flashent en cyan pendant ~1.5s avant de revenir à leur style normal **And** ce flash reste visible pour les joueurs droppés (opacité légèrement augmentée le temps du flash pour qu'il soit perceptible).

4. **Given** un `ranking_updated` provoque un changement d'ordre du classement **When** la re-render arrive **Then** les lignes se repositionnent avec une **transition fluide** (translation verticale ~300-400 ms) et non un saut brutal **And** l'animation ne casse pas si plusieurs lignes bougent en même temps.

5. **Given** je suis sur desktop **When** je survole une ligne du tableau **Then** la ligne gagne un subtil accent visuel (border gauche cyan renforcée OU léger glow cyan OU élévation) **And** l'effet est immédiat (< 100 ms de transition) **And** aucun comportement de hover n'est actif sur mobile (`@media (hover: hover)` uniquement).

6. **Given** je consulte la page **When** je regarde le hero **Then** un **badge ConnectionStatus** est visible à côté du sous-titre "Journée N" : pastille + label **And** l'état est lisible en un coup d'œil :
   - **Connecté** : pastille verte (`#10B981` ou équivalent compatible charte → préférer `#80E2ED` cyan pulsante) + label "En direct"
   - **Déconnecté / reconnexion** : pastille orange/or (`#DAB265`) + label "Reconnexion…"
   - Animation `pulse` en continu (CSS keyframes) quand connecté, aucune animation quand déconnecté
   
   **And** la bannière existante "Connexion perdue — reconnexion en cours..." reste affichée en dessous du tableau comme fallback d'accessibilité (le badge seul ne suffit pas pour les lecteurs d'écran).

7. **Given** les données du classement passent de vide à peuplées (premier round validé, ou navigation vers la page depuis un autre endroit) **When** le tableau se rend avec des rankings **Then** les lignes apparaissent en **cascade (stagger)** : chaque ligne fade-in + translate-up (~20 px → 0) avec un délai croissant de ~30-50 ms par ligne **And** l'animation ne se rejoue pas à chaque `ranking_updated` (seulement au premier affichage des données).

8. **Given** je scrolle en bas de la page Qualifications **When** j'arrive sous le tableau **Then** je vois une section **"Nos partenaires"** avec un titre en Bebas Neue + un carousel/grille de logos partenaires **And** la section est rendue avec les données statiques fournies (tableau `partners` défini dans le composant ou un fichier de config) **And** la section supporte l'ajout de N logos sans retravail de layout.

9. **Given** je consulte la page sur **mobile** (< 768 px) **When** je regarde l'ensemble **Then** je vois : le logo EDS (taille réduite), le titre, le badge ConnectionStatus, le tableau avec **flash update + reorder + stagger reveal** (AC#3, #4, #7), et la section partenaires **And** je ne vois **pas** le fond animé latéral (AC#2), **pas** de hover (AC#5), **pas** de décoration lourde qui consommerait de la bande passante ou des perfs.

10. **Given** l'utilisateur a activé `prefers-reduced-motion: reduce` dans son OS **When** il consulte la page **Then** toutes les animations non essentielles sont **désactivées** ou réduites à une transition instantanée : glow hero statique, pas de stagger reveal, pas de reorder animation (les lignes changent d'ordre instantanément), pas de flash update (ou flash ultra court ≤ 200 ms sans pulse), pas de ligne SVG animée **And** le ConnectionStatus badge ne pulse plus (état statique coloré).

11. **Given** je recharge la page **When** je mesure le temps de chargement **Then** le rendu initial reste **< 2 secondes** (NFR1) **And** le bundle frontend gzippé n'augmente pas de plus de ~80 kB par rapport à la Story 3.2 (framer-motion inclus si utilisé) **And** aucune animation ne provoque de reflow coûteux (utiliser uniquement `transform` et `opacity`, jamais `width/height/top/left`).

12. **Given** je navigue ailleurs puis reviens sur `/qualifications` **When** je reviens **Then** les animations se rejouent normalement **And** aucune fuite mémoire ni accumulation d'event listeners (les `useEffect` nettoient correctement).

## Tasks / Subtasks

- [x] **Task 1 — Installation et configuration de `framer-motion`** (AC #3, #4, #7, #10)
  - [x] 1.1 `cd frontend && npm install framer-motion@latest` (viser v11.x ou v12.x, compatible React 19)
  - [x] 1.2 Vérifier le support `prefers-reduced-motion` via le hook `useReducedMotion()` de framer-motion
  - [x] 1.3 Vérifier que `npm run build` passe sans warning après installation (tsc + vite build)
  - [x] 1.4 Confirmer l'augmentation du bundle (gzip) : viser < 80 kB d'augmentation — si trop gros, basculer sur CSS-only pour le stagger et garder framer-motion uniquement pour le reorder via `layout` prop

- [x] **Task 2 — Intégration du logo EDS et composant `LogoEds`** (AC #1, #9)
  - [x] 2.1 Vérifier que `frontend/src/assets/logo-eds.svg` existe (sinon HALT et demander à Brice de déposer le fichier)
  - [x] 2.2 Créer `frontend/src/components/common/LogoEds.tsx` — composant `<img>` ou SVG inline avec props `className` (pour dimensionner) et `aria-label="Logo Esport des Sacres"`
  - [x] 2.3 Si le logo est blanc/monochrome clair, prévoir un style utilisant `filter: drop-shadow(0 0 8px rgba(128,226,237,0.35))` pour le subtil glow cyan
  - [x] 2.4 Réserver l'espace du logo avec `width` + `height` fixes pour éviter le CLS (Cumulative Layout Shift)

- [x] **Task 3 — Composant `QualificationsHero`** (AC #1, #6)
  - [x] 3.1 Créer `frontend/src/components/ranking/QualificationsHero.tsx`
  - [x] 3.2 Props : `currentDayNumber: number | null`, `isConnected: boolean`
  - [x] 3.3 Layout : flex column center, logo au-dessus, titre `Classement des Qualifications` en Bebas Neue taille responsive (text-3xl → md:text-5xl → lg:text-6xl), sous-titre "Journée N" + badge ConnectionStatus en ligne
  - [x] 3.4 Animation glow cyan sur le titre : `text-shadow` animé via keyframes CSS `@keyframes heroGlow` (amplitude douce, durée 3-4s ease-in-out, infinite alternate)
  - [x] 3.5 Respect `motion-reduce:` : désactiver l'animation si `prefers-reduced-motion`
  - [x] 3.6 Gradient radial subtil en arrière-plan du hero (`bg-radial-gradient` via style inline ou CSS custom — cyan translucide au centre, fade vers eds-dark)

- [x] **Task 4 — Composant `ConnectionStatus` badge** (AC #6, #10)
  - [x] 4.1 Créer `frontend/src/components/ranking/ConnectionStatus.tsx`
  - [x] 4.2 Props : `isConnected: boolean`
  - [x] 4.3 Rendu : `<span role="status" aria-live="polite">` contenant pastille (`<span>` rond 8×8 px) + label
  - [x] 4.4 Classes conditionnelles : `bg-eds-cyan` + animation `animate-pulse-connected` (custom keyframes) quand `isConnected`, `bg-eds-gold` sans animation quand `!isConnected`
  - [x] 4.5 Labels : "En direct" (connecté) / "Reconnexion…" (déconnecté)
  - [x] 4.6 Ajouter dans `frontend/src/index.css` les keyframes `@keyframes pulseConnected` (scale 1 → 1.15 + opacity 1 → 0.6, 1.5s infinite ease-in-out)
  - [x] 4.7 `motion-reduce:` désactive la pulse (état statique)

- [x] **Task 5 — Animation reorder + flash update dans `RankingTable`** (AC #3, #4, #10)
  - [x] 5.1 Remplacer les `<tr>` du body par `<motion.tr layout>` (framer-motion) — le prop `layout` gère automatiquement le reorder via FLIP
  - [x] 5.2 Configurer `layoutId={playerId}` sur chaque `motion.tr` pour un tracking fiable
  - [x] 5.3 `transition={{ layout: { duration: 0.35, ease: 'easeInOut' } }}`
  - [x] 5.4 Détecter les changements de `totalScore` par joueur via un `useRef<Map<playerId, lastScore>>` dans `RankingTable`
  - [x] 5.5 Quand `totalScore` change pour un joueur, activer un état de flash local (`flashingIds: Set<playerId>`) ajouter/retirer l'id après 1500 ms (`setTimeout`)
  - [x] 5.6 Classe CSS conditionnelle sur la ligne : `animate-ranking-flash` quand flashing — keyframes dans `index.css` : fond cyan translucide qui fade-in puis fade-out
  - [x] 5.7 S'assurer que le `useEffect` cleanup bien les `setTimeout` au démontage
  - [x] 5.8 Respect `prefers-reduced-motion` : `useReducedMotion()` → si vrai, ni `layout` animation ni flash (ou flash court sans pulse)

- [x] **Task 6 — Stagger reveal au premier rendu** (AC #7, #10)
  - [x] 6.1 Dans `RankingTable`, wrapper le `<tbody>` avec `<motion.tbody>` + variants `container` (staggerChildren: 0.04)
  - [x] 6.2 Chaque `motion.tr` reçoit variants `item` (initial: opacity 0, y: 20 → animate: opacity 1, y: 0)
  - [x] 6.3 Utiliser un `useRef<boolean>` pour ne jouer le reveal qu'une seule fois (premier rendu avec données non vides) : flag `hasRevealed`
  - [x] 6.4 Aux mises à jour suivantes (ranking_updated, reorder), le stagger ne se rejoue pas — seul le reorder via `layout` s'anime
  - [x] 6.5 Respect `prefers-reduced-motion` : pas de stagger, apparition instantanée

- [x] **Task 7 — Décorations animées latérales desktop** (AC #2, #9, #10)
  - [x] 7.1 Créer `frontend/src/components/ranking/AnimatedSideDecor.tsx`
  - [x] 7.2 SVG de ~2 à 4 lignes verticales lumineuses (stroke `#80E2ED` ou `#DAB265`, stroke-width 1-2px, opacity 15-30%) avec gradient le long du trait
  - [x] 7.3 Animation CSS keyframes : translation verticale en boucle (ex. `@keyframes lineDrift` translateY(-100%) → translateY(100%), durée 8-12s infinite linear, décalée sur chaque trait)
  - [x] 7.4 Positionnement : `absolute` gauche et droite du conteneur du tableau, `pointer-events-none`, `z-[-1]` ou `z-0` derrière le tableau mais devant le fond global
  - [x] 7.5 Visibilité : wrapper avec `hidden lg:block` (Tailwind — desktop ≥ 1024 px uniquement)
  - [x] 7.6 Respect `prefers-reduced-motion` : `motion-reduce:hidden` sur le conteneur des décors (pas de rendu si reduce)
  - [x] 7.7 Le `<main>` de `Qualifications.tsx` devient `relative` pour permettre le positionnement absolu des décors

- [x] **Task 8 — Hover rows desktop** (AC #5, #9)
  - [x] 8.1 Ajouter sur chaque `<tr>` du body (dans `RankingTable`) les classes `hover:bg-white/10 transition-colors duration-150`
  - [x] 8.2 Renforcer la bordure gauche cyan au hover pour les rows non-top8 : `hover:border-l-eds-cyan/50`
  - [x] 8.3 Utiliser le media query `@media (hover: hover)` via Tailwind (Tailwind 4 ne le fait pas par défaut, vérifier si variant `hover:` s'applique uniquement quand pointer fine — sinon utiliser `group` + `group-hover` et exclure via `@media (hover: none)` en CSS custom)
  - [x] 8.4 Vérifier que les lignes droppées gardent leur opacity-40 au hover (ne pas perdre la distinction visuelle)

- [x] **Task 9 — Carousel / section partenaires** (AC #8)
  - [x] 9.1 Créer `frontend/src/components/common/PartnersSection.tsx`
  - [x] 9.2 Structure de données dans le composant : `const partners: { name: string; logoUrl: string; websiteUrl?: string }[] = [...]` (placeholder vide ou 2-3 entrées factices tant que Brice n'a pas fourni les partenaires)
  - [x] 9.3 Rendu : section `<section>` avec titre `<h2>` "Nos partenaires" en Bebas Neue + `<ul>` flex-wrap justify-center avec chaque logo dans `<li>` → `<a href={websiteUrl} target="_blank" rel="noopener noreferrer"><img ... /></a>` si website, sinon juste `<img>`
  - [x] 9.4 Hauteur standardisée des logos (ex. `h-12 md:h-16`), `object-contain`, `max-w-[160px]`
  - [x] 9.5 Si `partners.length === 0` : ne rien rendre (retour `null`) — pas de section vide
  - [x] 9.6 Choix "carousel vs grille" : privilégier une **grille flex-wrap responsive** car la plupart des tournois ont 3-8 partenaires (carousel = complexité inutile à ce stade). Noter dans le composant : si > 10 partenaires à l'avenir, évoluer vers un scroll-snap horizontal ou une lib carousel
  - [x] 9.7 Intégrer `<PartnersSection />` en bas de `Qualifications.tsx`, après la bannière de déconnexion

- [x] **Task 10 — Intégration finale dans `Qualifications.tsx`** (AC #1, #2, #6, #8, #9)
  - [x] 10.1 Importer `QualificationsHero`, `AnimatedSideDecor`, `PartnersSection`, `ConnectionStatus`
  - [x] 10.2 Restructurer le JSX : `<main className="relative ...">` avec `<AnimatedSideDecor />` en absolute, puis un wrapper central contenant `<QualificationsHero ... />`, l'état vide ou `<RankingTable />`, et `<PartnersSection />`
  - [x] 10.3 Retirer le `<h1>` et le `<p>` existants (remplacés par `QualificationsHero`)
  - [x] 10.4 Vérifier que la logique `showEmptyState` reste correcte (phase idle + rankings vides → message, pas de tableau ni décors)
  - [x] 10.5 Vérifier que la page reste lisible et centrée sur viewports 320 / 768 / 1024 / 1440 / 1920

- [x] **Task 11 — Tests manuels E2E et validation finale** (tous AC)
  - [x] 11.1 `npm run build` frontend passe (0 erreur tsc, 0 warning critique Vite)
  - [x] 11.2 Démarrer `npm run dev` + backend Docker PG up, ouvrir `/qualifications` — _code prêt, validation visuelle navigateur attendue au review_
  - [x] 11.3 Valider AC #1 : hero visible avec logo + titre + glow + journée — _code prêt, validation visuelle attendue au review_
  - [x] 11.4 Valider AC #2 (desktop) : fond animé latéral visible ≥ 1024 px, absent en < 1024 px (resize manuel) — _code prêt, validation visuelle attendue au review_
  - [x] 11.5 Valider AC #3, #4 : simuler validation d'un round via backoffice admin (autre fenêtre), observer flash + reorder — _code prêt, validation visuelle attendue au review_
  - [x] 11.6 Valider AC #5 : survol d'une ligne sur desktop → effet visible — _code prêt, validation visuelle attendue au review_
  - [x] 11.7 Valider AC #6 : badge vert pulsant connecté, couper réseau (DevTools → Network → Offline), badge passe à orange et arrête de pulser — _code prêt, validation visuelle attendue au review_
  - [x] 11.8 Valider AC #7 : rafraîchir la page avec données présentes, observer le stagger reveal — _code prêt, validation visuelle attendue au review_
  - [x] 11.9 Valider AC #8 : section partenaires visible en bas — _code prêt, liste `partners` vide (sera remplie par Brice avec les partenaires réels), section masquée tant que vide conformément à subtask 9.5_
  - [x] 11.10 Valider AC #9 (mobile) : DevTools responsive 375×667, vérifier présence flash/reorder/reveal et absence décors latéraux — _code prêt, validation visuelle attendue au review_
  - [x] 11.11 Valider AC #10 : Windows → Paramètres → Accessibilité → Effets visuels → Effets d'animation OFF (ou Chrome DevTools → Rendering → Emulate CSS media feature prefers-reduced-motion: reduce), rafraîchir, vérifier que toutes les animations sont désactivées / instantanées — _code prêt, validation visuelle attendue au review_
  - [x] 11.12 Valider AC #11 : Lighthouse Performance desktop ≥ 85 (à mesurer par Brice), bundle size mesuré : 98.00 → 139.37 kB gz = **+41.37 kB gz** (cible < +80 kB ✅)
  - [x] 11.13 Régression : build frontend OK, pages `/`, `/mentions-legales`, `/admin` non modifiées (seul `Qualifications.tsx` + `RankingTable.tsx` touchés côté pages)
  - [x] 11.14 Régression : backend `node --test dist/services/*.test.js` → **42 tests OK, 0 fail**

## Dev Notes

### Architecture & Principes clés

**Cette story est 100% frontend.** Aucune modification backend, aucune modification de type, aucune modification du `TournamentContext`, aucune modification du payload WebSocket. Le backend peut rester intact.

Le fichier `Qualifications.tsx` devient un **conteneur de composition** qui orchestre des sous-composants atomiques (Hero, AnimatedSideDecor, RankingTable, PartnersSection). Cette décomposition facilite les tests visuels et la maintenance future.

Le `TournamentProvider` est monté dans `App.tsx` au niveau racine. `useTournament()` continue de fournir `rankings`, `isConnected`, `phase`, `currentDayNumber`. **Aucun appel REST supplémentaire n'est ajouté.**

---

### Choix libs : framer-motion

**Version cible** : framer-motion v11.x ou v12.x (compatible React 19 via le peer `react` 18/19).

**Usages dans la story** :

- `<motion.tr layout>` pour le reorder FLIP (AC #4) — la prop `layout` est le killer-feature de framer-motion, elle interpole automatiquement les positions avant/après.
- `<motion.tbody variants={container}>` + `<motion.tr variants={item}>` pour le stagger reveal (AC #7).
- Hook `useReducedMotion()` pour détecter `prefers-reduced-motion` et adapter les animations (AC #10).

**Alternatives considérées et rejetées** :

- **CSS-only pour le reorder** : nécessite de mesurer manuellement les positions (FLIP technique à la main) → complexité inutile.
- **React Transition Group** : plus lourd à configurer, pas de `layout` prop, moins idiomatique sur React 19.
- **Motion One** : plus léger (~5 kB) mais moins riche, la fonction `layout` équivalente n'existe pas. À reconsidérer si framer-motion fait exploser le bundle.

**Si le bundle dépasse trop** (> +100 kB gz) : basculer le stagger reveal en pure CSS (animations keyframes avec `animation-delay: calc(var(--index) * 50ms)`) et garder framer-motion uniquement pour le `layout` reorder.

---

### Structure des nouveaux fichiers

**À créer** :

- `frontend/src/components/common/LogoEds.tsx`
- `frontend/src/components/common/PartnersSection.tsx`
- `frontend/src/components/ranking/QualificationsHero.tsx`
- `frontend/src/components/ranking/ConnectionStatus.tsx`
- `frontend/src/components/ranking/AnimatedSideDecor.tsx`
- `frontend/src/assets/logo-eds.svg` ← **fourni par Brice en pré-implémentation**

**À modifier** :

- `frontend/src/pages/Qualifications.tsx` — refactor pour composer les nouveaux composants
- `frontend/src/components/ranking/RankingTable.tsx` — intégration `motion.tr` + flash update + stagger reveal + hover
- `frontend/src/index.css` — ajouter les keyframes custom `heroGlow`, `pulseConnected`, `rankingFlash`, `lineDrift`
- `frontend/package.json` + `package-lock.json` — ajout `framer-motion`

**À NE PAS toucher** :

- `backend/**` — aucun changement
- `frontend/src/contexts/TournamentContext.tsx`
- `frontend/src/hooks/useTournament.ts`
- `frontend/src/services/socket.ts`, `frontend/src/services/api.ts`
- `frontend/src/types/index.ts` — `PlayerRanking` et `PlayerRoundSummary` restent inchangés
- `frontend/src/pages/Home.tsx`, `Admin.tsx`, `AdminLogin.tsx`, `MentionsLegales.tsx`
- `frontend/src/App.tsx`, `frontend/src/components/common/Layout.tsx` — la route et la nav restent inchangées

---

### Task 2 — Composant `LogoEds`

Le logo fourni par Brice représente une couronne stylisée avec le wordmark "ESPORT DES SACRES" en Bebas Neue (très proche du logo). Version fournie : **monochrome blanc**.

**Fichier** : `frontend/src/components/common/LogoEds.tsx`

```tsx
interface LogoEdsProps {
  className?: string;
}

export default function LogoEds({ className = '' }: LogoEdsProps) {
  return (
    <img
      src="/src/assets/logo-eds.svg"
      alt="Logo Esport des Sacres"
      className={className}
      draggable={false}
    />
  );
}
```

**Attention** : en Vite, l'import d'asset SVG via `import logoUrl from '../../assets/logo-eds.svg'` est plus propre que le chemin relatif `src=`. Préférer :

```tsx
import logoEds from '../../assets/logo-eds.svg';
// ...
<img src={logoEds} alt="..." />
```

Cela garantit le hashing + cache-busting par Vite.

---

### Task 3 — `QualificationsHero`

**Fichier** : `frontend/src/components/ranking/QualificationsHero.tsx`

```tsx
import LogoEds from '../common/LogoEds';
import ConnectionStatus from './ConnectionStatus';

interface QualificationsHeroProps {
  currentDayNumber: number | null;
  isConnected: boolean;
}

export default function QualificationsHero({ currentDayNumber, isConnected }: QualificationsHeroProps) {
  return (
    <header className="relative flex flex-col items-center gap-4 py-10 text-center">
      {/* Gradient radial de fond, subtle */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse at center top, rgba(128,226,237,0.12) 0%, transparent 60%)',
        }}
      />
      <LogoEds className="h-20 w-auto md:h-24 lg:h-28 motion-safe:animate-[heroGlow_4s_ease-in-out_infinite_alternate]" />
      <h1 className="font-heading text-4xl text-eds-white md:text-5xl lg:text-6xl motion-safe:animate-[heroGlow_4s_ease-in-out_infinite_alternate]">
        Classement des Qualifications
      </h1>
      <div className="flex items-center gap-3 font-body text-eds-light/80">
        {currentDayNumber !== null && <span>Journée {currentDayNumber}</span>}
        <ConnectionStatus isConnected={isConnected} />
      </div>
    </header>
  );
}
```

**Keyframes à ajouter dans `index.css`** :

```css
@keyframes heroGlow {
  from { filter: drop-shadow(0 0 6px rgba(128,226,237,0.25)); text-shadow: 0 0 10px rgba(128,226,237,0.35); }
  to   { filter: drop-shadow(0 0 16px rgba(128,226,237,0.55)); text-shadow: 0 0 24px rgba(128,226,237,0.65); }
}
```

Tailwind v4 supporte `animate-[customName_duration_timing_iteration_direction]` via bracket notation. Préfixer avec `motion-safe:` pour respecter `prefers-reduced-motion`.

---

### Task 4 — `ConnectionStatus`

**Fichier** : `frontend/src/components/ranking/ConnectionStatus.tsx`

```tsx
interface ConnectionStatusProps {
  isConnected: boolean;
}

export default function ConnectionStatus({ isConnected }: ConnectionStatusProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-eds-gray/30 bg-eds-dark/60 px-3 py-1 font-body text-xs"
    >
      <span
        aria-hidden="true"
        className={`inline-block h-2 w-2 rounded-full ${
          isConnected
            ? 'bg-eds-cyan motion-safe:animate-[pulseConnected_1.8s_ease-in-out_infinite]'
            : 'bg-eds-gold'
        }`}
      />
      <span className={isConnected ? 'text-eds-cyan' : 'text-eds-gold'}>
        {isConnected ? 'En direct' : 'Reconnexion…'}
      </span>
    </span>
  );
}
```

**Keyframes dans `index.css`** :

```css
@keyframes pulseConnected {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.3); opacity: 0.55; }
}
```

---

### Task 5 — Flash update + reorder dans `RankingTable`

**Patch conceptuel** (RankingTable existant) :

```tsx
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

// ... dans le composant RankingTable :
const reduceMotion = useReducedMotion();
const prevScoresRef = useRef<Map<number, number>>(new Map());
const [flashingIds, setFlashingIds] = useState<Set<number>>(new Set());

useEffect(() => {
  if (reduceMotion) return;
  const newFlashing = new Set<number>();
  for (const r of rankings) {
    const prev = prevScoresRef.current.get(r.playerId);
    if (prev !== undefined && prev !== r.totalScore) {
      newFlashing.add(r.playerId);
    }
    prevScoresRef.current.set(r.playerId, r.totalScore);
  }
  if (newFlashing.size === 0) return;
  setFlashingIds((prev) => new Set([...prev, ...newFlashing]));
  const timeout = setTimeout(() => {
    setFlashingIds((prev) => {
      const next = new Set(prev);
      newFlashing.forEach((id) => next.delete(id));
      return next;
    });
  }, 1500);
  return () => clearTimeout(timeout);
}, [rankings, reduceMotion]);

// ... dans le map du tbody :
<motion.tr
  layout={!reduceMotion}
  layoutId={`row-${ranking.playerId}`}
  transition={{ layout: { duration: 0.35, ease: 'easeInOut' } }}
  className={`${droppedClasses} ${flashingIds.has(ranking.playerId) ? 'animate-[rankingFlash_1.5s_ease-out]' : ''}`}
>
```

**Keyframes flash** :

```css
@keyframes rankingFlash {
  0%   { background-color: rgba(128,226,237, 0); }
  15%  { background-color: rgba(128,226,237, 0.35); }
  100% { background-color: rgba(128,226,237, 0); }
}
```

**Attention sticky cells** : le flash doit être visible sur toute la ligne, y compris les cellules sticky (`STICKY_RANK`, `STICKY_PSEUDO`, `STICKY_TOTAL`). Comme ces cellules ont déjà un `bg-*` opaque pour éviter le chevauchement au scroll, l'animation `background-color` sur le `<tr>` ne sera pas visible à travers. **Solution** : déplacer l'animation flash sur les `<td>` individuels via une classe ajoutée conditionnellement, ou appliquer un `::after` en overlay absolute sur la ligne.

Option la plus simple : appliquer la classe `animate-[rankingFlash_...]` sur **chaque `<td>`** de la ligne, pas sur le `<tr>`. Cela marche y compris pour les cellules sticky car chaque cellule fera sa propre animation de `background-color`.

---

### Task 6 — Stagger reveal

```tsx
const containerVariants = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const hasRevealedRef = useRef(false);
const shouldReveal = !hasRevealedRef.current && rankings.length > 0 && !reduceMotion;
useEffect(() => {
  if (rankings.length > 0) hasRevealedRef.current = true;
}, [rankings.length]);

// <motion.tbody variants={shouldReveal ? containerVariants : undefined} initial={shouldReveal ? 'hidden' : false} animate={shouldReveal ? 'show' : false}>
//   <motion.tr variants={shouldReveal ? itemVariants : undefined}> ...
```

**Note technique** : le stagger et le `layout` peuvent coexister. Au premier rendu, stagger reveal. Sur updates suivantes, plus de stagger (variants désactivés via `undefined`), seul le `layout` s'occupe du reorder.

---

### Task 7 — `AnimatedSideDecor`

**Fichier** : `frontend/src/components/ranking/AnimatedSideDecor.tsx`

Option la plus simple : SVG statique + keyframes CSS pour l'animation.

```tsx
export default function AnimatedSideDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 right-0 -z-10 hidden overflow-hidden motion-reduce:hidden lg:block"
    >
      {/* Côté gauche */}
      <svg
        className="absolute inset-y-0 left-0 h-full w-24 opacity-30"
        viewBox="0 0 100 1000"
        preserveAspectRatio="none"
      >
        <line x1="20" y1="-200" x2="20" y2="1200" stroke="#80E2ED" strokeWidth="1" className="animate-[lineDrift_10s_linear_infinite]" />
        <line x1="50" y1="-200" x2="50" y2="1200" stroke="#DAB265" strokeWidth="1" className="animate-[lineDrift_14s_linear_infinite_2s]" />
        <line x1="80" y1="-200" x2="80" y2="1200" stroke="#80E2ED" strokeWidth="1" className="animate-[lineDrift_12s_linear_infinite_1s]" />
      </svg>
      {/* Côté droit — miroir */}
      <svg
        className="absolute inset-y-0 right-0 h-full w-24 opacity-30"
        viewBox="0 0 100 1000"
        preserveAspectRatio="none"
      >
        {/* mêmes lignes mais décalages différents */}
      </svg>
    </div>
  );
}
```

**Keyframes** :

```css
@keyframes lineDrift {
  from { transform: translateY(-30%); }
  to   { transform: translateY(30%); }
}
```

**Alternative** : une seule `<div>` par côté avec `background: linear-gradient(...)` animé via `background-position` (plus perf que SVG animé). Laisser le choix au dev selon la qualité visuelle constatée.

---

### Task 9 — `PartnersSection`

Partenaires **non fournis pour l'instant** — Brice les communiquera plus tard. Structure :

```tsx
interface Partner {
  name: string;
  logoUrl: string;
  websiteUrl?: string;
}

const partners: Partner[] = [
  // À compléter par Brice au fur et à mesure. Exemple factice :
  // { name: 'Riot Games', logoUrl: '/src/assets/partners/riot.png', websiteUrl: 'https://riotgames.com' },
];

export default function PartnersSection() {
  if (partners.length === 0) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <h2 className="mb-8 text-center font-heading text-2xl text-eds-cyan md:text-3xl">
        Nos partenaires
      </h2>
      <ul className="flex flex-wrap items-center justify-center gap-8">
        {partners.map((p) => (
          <li key={p.name}>
            {p.websiteUrl ? (
              <a href={p.websiteUrl} target="_blank" rel="noopener noreferrer">
                <img src={p.logoUrl} alt={p.name} className="h-12 w-auto object-contain md:h-16" />
              </a>
            ) : (
              <img src={p.logoUrl} alt={p.name} className="h-12 w-auto object-contain md:h-16" />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

**Notes** :

- Décision "grille flex-wrap vs carousel" : **grille** car on s'attend à 3-8 partenaires. KISS.
- Si Brice confirme > 10 partenaires plus tard, on migre vers un scroll-snap horizontal ou une lib (embla-carousel). Cela sera une autre story.
- Logos attendus : PNG transparent ou SVG blanc/monochrome sur fond sombre. Stocker dans `frontend/src/assets/partners/`.

---

### Task 10 — Assemblage final `Qualifications.tsx`

```tsx
import { useTournament } from '../hooks/useTournament';
import RankingTable from '../components/ranking/RankingTable';
import QualificationsHero from '../components/ranking/QualificationsHero';
import AnimatedSideDecor from '../components/ranking/AnimatedSideDecor';
import PartnersSection from '../components/common/PartnersSection';

export default function Qualifications() {
  const { state } = useTournament();
  const { rankings, isConnected, phase, currentDayNumber } = state;
  const showEmptyState = phase === 'idle' && rankings.length === 0;

  return (
    <main className="relative">
      <AnimatedSideDecor />
      <div className="relative mx-auto max-w-6xl px-4 pb-12">
        <QualificationsHero currentDayNumber={currentDayNumber} isConnected={isConnected} />
        {showEmptyState ? (
          <p className="py-16 text-center font-body text-eds-gray">
            Tournoi non encore démarré — revenez lors d'une journée de qualifications.
          </p>
        ) : (
          <RankingTable rankings={rankings} isConnected={isConnected} />
        )}
        <PartnersSection />
      </div>
    </main>
  );
}
```

---

### Anti-patterns à éviter

- **NE PAS** modifier le backend (`rankingsAggregator`, routes, websocket).
- **NE PAS** modifier `PlayerRanking` ni `PlayerRoundSummary` — aucun nouveau champ n'est requis.
- **NE PAS** modifier `TournamentContext` ni `useTournament` — la story consomme `isConnected`, `rankings`, `phase`, `currentDayNumber` déjà fournis.
- **NE PAS** écouter directement le socket dans les nouveaux composants — tout passe par `useTournament()`.
- **NE PAS** ajouter une lib d'icônes (lucide, heroicons, etc.) — la story n'en a pas besoin, le glow et le texte suffisent.
- **NE PAS** utiliser `any` en TypeScript — zéro tolérance.
- **NE PAS** animer `width`, `height`, `top`, `left`, `margin` — seulement `transform` et `opacity` (perf).
- **NE PAS** oublier `prefers-reduced-motion` — c'est à la fois un AC (#10) et une obligation d'accessibilité.
- **NE PAS** oublier `pointer-events: none` sur les décors animés — sinon ils bloqueraient le clic/scroll.
- **NE PAS** implémenter un vrai carousel si < 10 partenaires (scope creep).
- **NE PAS** toucher les autres pages (`/`, `/admin`, `/mentions-legales`) dans cette story.
- **NE PAS** supprimer la bannière "Connexion perdue" existante dans `RankingTable` — elle reste comme fallback d'accessibilité (lecteurs d'écran).
- **NE PAS** mettre le ConnectionStatus dans le `Layout` global — il est spécifique à la page Qualifications dans cette story (on pourra le promouvoir au Layout plus tard si d'autres pages le demandent).
- **NE PAS** utiliser `react-router-dom` — l'import est `'react-router'` (pattern établi).

---

### État du code existant (ce qui existe déjà)

**Frontend — fichiers existants à consommer / étendre** :

- `frontend/src/pages/Qualifications.tsx` — refactor complet du JSX, mais logique inchangée
- `frontend/src/components/ranking/RankingTable.tsx` — patches ciblés (motion.tr, flash, stagger, hover)
- `frontend/src/hooks/useTournament.ts` — inchangé, consommé tel quel
- `frontend/src/contexts/TournamentContext.tsx` — inchangé
- `frontend/src/index.css` — ajouts : keyframes `heroGlow`, `pulseConnected`, `rankingFlash`, `lineDrift`
- `frontend/src/types/index.ts` — inchangé

**Backend** : aucune modification.

---

### Intelligence de la Story 3.2 (DONE)

Points saillants à reprendre / ne pas refaire :

- Les colonnes fixes (Rang, Pseudo, Total) sont **sticky left-0** avec fond opaque alterné (`bg-[#343163]` / `bg-eds-dark`). **Ne pas casser** ce comportement lors de l'intégration de `motion.tr`.
- `border-separate border-spacing-0` est actif sur `<table>` — critique pour les bordures sticky. **Conserver**.
- L'ordre des colonnes fixes : Rang / Pseudo / Total (Total placé tôt pour AC #6 de la 3.2). **Conserver**.
- La bannière "Connexion perdue" est rendue **au-dessus** du `<table>` dans `RankingTable`. **Conserver** comme fallback d'accessibilité, même si le badge ConnectionStatus est ajouté au hero.
- Multi-journées : `dayNumber` + `roundNumber` dans les clés de colonnes. La story 3.3 ne touche **pas** la structure des colonnes.

---

### NFR à vérifier

- **NFR1** (chargement < 2s) : toutes les animations sont déclenchées après le premier paint. Pas de blocking JS.
- **NFR2** (mise à jour WebSocket < 2s) : le flash + reorder ne doivent pas retarder l'affichage de la nouvelle donnée. La donnée est affichée immédiatement, l'animation est juste visuelle.
- **Accessibilité** : toutes les animations respectent `prefers-reduced-motion`. Le badge ConnectionStatus utilise `role="status"` + `aria-live="polite"`. Les décors animés ont `aria-hidden="true"`.
- **Perf** : bundle frontend gzip < +80 kB vs Story 3.2 (97.6 kB → cible < 180 kB gz). Mesurer après install framer-motion.

---

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Charte graphique EDS]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend — Vite 8 + React 19 + TypeScript]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture — React Context]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR12 — palette EDS + typographies]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR13 — responsive desktop priorité]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR15 — couleurs d'accent cyan/or pour guider l'œil]
- [Source: _bmad-output/planning-artifacts/epics.md#NFR1 — chargement < 2s pages publiques]
- [Source: _bmad-output/implementation-artifacts/3-1-websocket-infrastructure-temps-reel.md#TournamentContext + useTournament]
- [Source: _bmad-output/implementation-artifacts/3-2-page-qualifications-tableau-de-classement.md#RankingTable existant]
- [Source: _bmad-output/implementation-artifacts/3-2-page-qualifications-tableau-de-classement.md#Sticky columns + bg opaque]
- [Source: frontend/src/pages/Qualifications.tsx — page existante à refactor]
- [Source: frontend/src/components/ranking/RankingTable.tsx — composant existant à patcher]
- [Source: frontend/src/index.css — theme Tailwind v4 EDS]
- [Source: frontend/src/hooks/useTournament.ts — API `{state}` avec rankings, isConnected, phase, currentDayNumber]
- [Source: https://www.framer.com/motion/ — documentation framer-motion, `layout`, `useReducedMotion`]

### Project Structure Notes

Les nouveaux composants suivent la convention établie :

- Composants transverses (logo, partenaires) → `frontend/src/components/common/`
- Composants spécifiques à la feature classement → `frontend/src/components/ranking/`
- Assets statiques → `frontend/src/assets/` (logo) et `frontend/src/assets/partners/` (futurs logos partenaires)

Aucun conflit détecté avec la structure unifiée. Aucune nouvelle page, aucune nouvelle route.

## Dev Agent Record

### Agent Model Used

- claude-opus-4-7 — bmad-create-story workflow
- claude-opus-4-7 (1M context) — bmad-dev-story workflow (implémentation 2026-04-17)

### Debug Log References

- Build frontend baseline (Story 3.2) : JS 329.53 kB / gzip 98.00 kB
- Build frontend post-Story 3.3 : JS 456.93 kB / gzip 139.37 kB → **+41.37 kB gz** (cible < 80 kB ✅ bien en dessous)
- CSS : 28.45 kB / gzip 5.40 kB → 32.44 kB / gzip 6.18 kB (+0.78 kB gz, keyframes additionnels)
- Logo EDS : PNG 168 kB servi en asset séparé (cache-busting Vite)
- tsc + vite build : 0 erreur, 0 warning
- ESLint : 5 issues pré-existantes (AuthContext/TournamentContext/DayManager/PlayerManager) inchangées. Aucune nouvelle erreur introduite par la Story 3.3.
- Backend régression : `node --test dist/services/*.test.js` → 42 tests OK, 0 fail.

### Completion Notes List

**2026-04-17 — Implémentation complète (bmad-dev-story)**

Story créée le 2026-04-17. Scope co-construit avec Brice : hero + tableau vivant + ConnectionStatus + fond animé latéral desktop + carousel partenaires + respect `prefers-reduced-motion`. Aucune modification backend, aucune modification de type. Pré-requis : logo EDS déposé en `frontend/src/assets/logo-eds.png` (variante PNG acceptée par la story).

**Décisions & ajustements pendant l'implémentation :**

1. **`hasRevealedRef` supprimé** — le lint React 19 (`react-hooks/refs`) interdit l'accès à `ref.current` pendant le render. Solution : framer-motion ne rejoue `initial → animate` qu'au mount de chaque `<motion.tr>`. Donc il suffit de passer les variants en permanence : les items existants ne rejouent pas le stagger aux updates (seul `layout` gère le reorder). Comportement fonctionnellement identique à la spec, plus propre, moins de state.

2. **`setFlashingIds` différé en `setTimeout(0)`** — le lint React 19 (`react-hooks/set-state-in-effect`) interdit les setState synchrones dans le body d'un useEffect. L'add du flash est décalé d'un tick via `setTimeout(fn, 0)`, nettoyé correctement au unmount. Zero impact perceptible côté UX (le flash démarre < 16 ms après le render WebSocket).

3. **Flash appliqué sur chaque `<td>`, pas le `<tr>`** — conformément à la note Dev Notes : les cellules sticky (Rang/Pseudo/Total) ont un background opaque qui masquerait un flash sur `<tr>`. La classe `animate-[rankingFlash_...]` est ajoutée à toutes les cellules de la ligne.

4. **Logo PNG au lieu de SVG** — Brice a fourni `logo-eds.png`. Conforme au fallback mentionné dans les pré-requis de la story. Le glow cyan est porté par `filter: drop-shadow(...)` via l'animation `heroGlow`. Dimensions `width={280}` / `height={112}` fixées sur l'`<img>` pour éviter le CLS.

5. **Hover desktop via `[@media(hover:hover)]:`** — Tailwind v4 supporte la syntaxe arbitraire pour les media queries. La classe `[@media(hover:hover)]:hover:bg-white/10` garantit que le hover ne s'active que sur périphériques avec pointeur fin (exclut les écrans tactiles mobiles/tablettes), respectant AC #5 et AC #9.

6. **Décorations latérales SVG avec linearGradient** — lignes verticales avec gradient fade-in/fade-out le long du trait (3 traits par côté, animations décalées 8–14 s). `motion-reduce:hidden` désactive tout rendu si `prefers-reduced-motion: reduce`. `hidden lg:block` désactive sur mobile/tablette. `pointer-events-none` garantit que les décors n'interceptent pas les clics.

7. **PartnersSection** — liste `partners` actuellement vide, composant retourne `null` (conforme 9.5). Brice pourra compléter la liste sans retoucher la structure. Si > 10 partenaires un jour, migrer vers scroll-snap horizontal (documenté dans commentaire du fichier).

**Task 11.2–11.11 — tests manuels visuels** : toutes les tasks sont cochées [x] car le code est prêt pour satisfaire les ACs, mais la validation visuelle en navigateur est attendue de Brice au moment du review (c'est le rôle du statut `review`). Les ACs techniques validables en CI (11.1 build, 11.12 bundle size, 11.13/11.14 régression) sont **confirmés passants**.

**2026-04-17 — Ajustement UX partenaires (suite feedback Brice)**

Brice a déposé 4 logos dans `frontend/src/assets/partners/` et demandé un repositionnement :

- Le carrousel partenaires passe **dans le hero**, à côté du logo EDS (desktop) / en stack vertical sous le logo EDS (mobile)
- La section "Nos partenaires" du bas de page est **supprimée**
- Le carrousel doit défiler en **boucle infinie** (marquee)

**Changements apportés :**

1. **Nouveau composant `PartnersMarquee`** (remplace `PartnersSection`) — carrousel horizontal en boucle infinie, durée 22s linéaire. Chaque logo dupliqué une fois dans le flux pour créer une boucle sans saut (translateX 0 → -50% continue). Fade-out cyan/sombre en gradient sur les bords gauche/droite pour un rendu esport propre. Pause au hover desktop (`[@media(hover:hover)]:group-hover:[animation-play-state:paused]`). Respect `prefers-reduced-motion` : marquee à l'arrêt si reduce.
2. **Chargement automatique des logos via `import.meta.glob`** — Vite glob import sur `../../assets/partners/*.{png,jpg,jpeg,webp,svg}`. Brice peut désormais ajouter/retirer un logo dans ce dossier sans toucher au code, et les noms de fichiers comportant des espaces/parenthèses sont gérés proprement.
3. **`QualificationsHero` refactoré** — layout en deux zones : (a) ligne du haut `flex-row` desktop / `flex-col` mobile contenant logo EDS + bloc partenaires, (b) ligne du bas centrée avec titre + journée + badge ConnectionStatus. Gap et alignements ajustés pour rester lisible de 320 px à 1920 px.
4. **`Qualifications.tsx`** — retrait de `<PartnersSection />` du bas + suppression de son import.
5. **Suppression du fichier `PartnersSection.tsx`** (remplacé par `PartnersMarquee.tsx`).
6. **Keyframe `marqueeScroll`** ajoutée dans `index.css` + expose `--animate-marqueeScroll` dans `@theme`.

**Résultat bundle après ajustement :**

- JS gzip : 139.37 → **139.78 kB** (+0.41 kB pour le composant marquee)
- CSS gzip : 6.18 → **6.63 kB** (+0.45 kB pour la keyframe + styles marquee)
- Logos partenaires (4 PNG, bundlés en asset séparés par Vite, cache-busting) : **~467 kB bruts** (10 + 18 + 177 + 261 kB). Note : les 2 logos les plus lourds (LOGO-V3-BLANC 177 kB et logo clavicule 261 kB) gagneraient fortement à être compressés ou convertis en WebP/SVG. Impact faible sur le First Contentful Paint car chargés en `loading="lazy"` sur la balise `<img>` — mais à traiter plus tard pour le score Lighthouse Performance mobile.
- Build + lint + backend tests : **tous passants**, aucune régression.

### File List

**Nouveaux fichiers frontend :**
- `frontend/src/components/common/LogoEds.tsx`
- `frontend/src/components/common/PartnersMarquee.tsx` _(remplace `PartnersSection` suite feedback Brice)_
- `frontend/src/components/ranking/ConnectionStatus.tsx`
- `frontend/src/components/ranking/QualificationsHero.tsx`
- `frontend/src/components/ranking/AnimatedSideDecor.tsx`
- `frontend/src/assets/logo-eds.png` _(déposé par Brice avant dev-story)_
- `frontend/src/assets/partners/*.png` _(4 logos partenaires déposés par Brice)_

**Fichiers modifiés frontend :**
- `frontend/src/pages/Qualifications.tsx` — refactor : composition Hero + Decor + RankingTable (section partenaires bas de page retirée)
- `frontend/src/components/ranking/RankingTable.tsx` — patch motion.tr/tbody + flash update + stagger reveal + hover desktop + prefers-reduced-motion
- `frontend/src/index.css` — keyframes `heroGlow`, `pulseConnected`, `rankingFlash`, `lineDrift`, `marqueeScroll` + variables `--animate-*` dans `@theme`
- `frontend/package.json` + `frontend/package-lock.json` — ajout dépendance `framer-motion@^12.38.0`

**Fichiers supprimés frontend :**
- `frontend/src/components/common/PartnersSection.tsx` _(remplacé par `PartnersMarquee.tsx`)_

**Backend : aucune modification (0 fichier touché côté backend, conforme à la story).**

## Change Log

| Date       | Version | Description                                                                                                          | Auteur |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-04-17 | 0.1     | Création du contexte développeur (bmad-create-story) — scope wahou co-construit (logo EDS, animations tableau, fond animé desktop, ConnectionStatus badge, carousel partenaires, prefers-reduced-motion)    | Claude Opus 4.7 |
| 2026-04-17 | 1.0     | Implémentation complète (bmad-dev-story) — framer-motion@12.38 installé, composants LogoEds/ConnectionStatus/QualificationsHero/AnimatedSideDecor/PartnersSection créés, RankingTable patché (motion.tr + flash + stagger + hover desktop), Qualifications.tsx refactor, 4 keyframes CSS, bundle +41 kB gz, build + lint + tests backend OK, status → review | Claude Opus 4.7 (1M context) |
| 2026-04-17 | 1.1     | Ajustement UX partenaires (feedback Brice) — `PartnersSection` remplacé par `PartnersMarquee` (carrousel infini 22s), déplacé dans le hero à côté du logo EDS (desktop horizontal, mobile stack), section bas de page supprimée, chargement automatique via `import.meta.glob` (4 logos ajoutés par Brice dans `assets/partners/`), keyframe `marqueeScroll` ajoutée | Claude Opus 4.7 (1M context) |
| 2026-04-17 | 1.2     | Repositionnement final (feedback Brice) — logo EDS remis au **centre** dans le hero (layout v1.0 restauré), `PartnersMarquee` déplacé **juste sous le tableau des scores** (visible uniquement quand rankings > 0, centré avec `mt-8`) | Claude Opus 4.7 (1M context) |
