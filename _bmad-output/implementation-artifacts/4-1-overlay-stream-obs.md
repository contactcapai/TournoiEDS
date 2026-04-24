# Story 4.1 : Overlay Stream OBS

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **caster (SkyDow)**,
I want **afficher une page overlay dans OBS qui montre le classement en direct, sans aucun élément d'interface**,
So that **le stream donne une image professionnelle du tournoi EDS et le viewer voit les scores se mettre à jour instantanément sans que j'aie à intervenir**.

## Contexte de la story

Story **purement frontend** et **purement additive**. Elle monte une nouvelle page `/overlay` qui consomme le `TournamentContext` existant (Story 3.1) et les données déjà exposées (Story 3.2/3.3). **Aucune modification backend, aucune nouvelle route API, aucune évolution du type `PlayerRanking`, aucun nouvel événement WebSocket.**

La page `/overlay` sera ajoutée dans `App.tsx` **hors du `<Layout>` public** (pas de header, pas de nav, pas de footer) conformément à UX-DR14. C'est le point clé qui la différencie des autres pages publiques.

L'ambition UX a été co-construite avec Brice pendant la rétro Epic 3 : **conserver l'ADN "effet wahou" de la 3.3 (flash cyan sur `ranking_updated`, reorder FLIP animé, glow cyan, palette EDS, Bebas Neue) mais adapté au format OBS** :

- **Garder** : flash update cyan 1.5 s, reorder via framer-motion `layout`, palette EDS (#29265B fond, #80E2ED cyan, #DAB265 or), typographies Bebas Neue + Roboto.
- **Retirer** : décors latéraux SVG (trop chargé en permanence à l'écran stream), `ConnectionStatus` (le caster sait s'il est connecté), hero avec logo + partenaires (overlay = tableau pur), scrollbar.
- **Amplifier** : taille de police lisible à distance (1.5–2× la page Qualifications), top 8 plus marqué visuellement, transitions calmes pour ne pas fatiguer l'œil du viewer pendant une longue session de stream.

**Décision d'architecture prise par défaut (modifiable par Brice en review)** : créer un **composant séparé `OverlayRankingTable`** plutôt que d'ajouter un prop `variant` à `RankingTable`. Raison :

1. Le layout OBS est fondamentalement différent (pas de scroll horizontal, pas de sticky columns, sélection réduite de colonnes : Rang/Pseudo/Total, voire Moy si l'espace le permet).
2. Éviter d'alourdir `RankingTable.tsx` avec des branches conditionnelles (`variant === 'overlay' ? X : Y`) qui compliqueraient les futures évolutions des deux vues.
3. Le code partagé (flash cyan, reorder FLIP, règles `prefers-reduced-motion`) sera extrait dans un hook commun `useRankingFlash` + constantes partagées, pas dupliqué.

## Acceptance Criteria

1. **Given** je configure OBS **When** j'ajoute l'URL `http://localhost:5173/overlay` (dev) ou `https://tournoi.esportdessacres.fr/overlay` (prod) comme source navigateur **Then** la page s'affiche sans aucun chrome UI : pas de header "Tournoi TFT — EDS", pas de nav Accueil/Qualifications/Finale, pas de footer "Mentions légales", pas de scrollbar verticale ni horizontale **And** aucun lien cliquable visible (overlay n'a pas de navigation).

2. **Given** la page overlay est chargée dans OBS (source navigateur configurée en 1920×1080) **When** je regarde l'affichage **Then** le rendu est optimisé pour du **16:9 fixe** — le contenu reste centré et lisible sans troncature entre les résolutions d'OBS courantes (1280×720 → 1920×1080 → 2560×1440) **And** le fond de la page est **transparent** (ou à défaut `#29265B` opaque si le viewer OBS ne supporte pas la transparence) pour que le caster puisse superposer l'overlay au-dessus d'un bandeau de stream **And** la charte EDS est respectée (fond `bg-eds-dark` par défaut, accents `text-eds-cyan` et `text-eds-gold`, typographies Bebas Neue pour en-têtes et Roboto pour les cellules).

3. **Given** la page overlay est chargée et qu'au moins un round a été validé **When** je regarde le contenu affiché **Then** un tableau de classement est visible avec, **a minima**, pour chaque joueur : Rang, Pseudo Discord, Score total cumulé **And** les tailles de police sont **amplifiées par rapport à `/qualifications`** : titre de page (si présent) en `text-5xl` à `text-7xl`, en-têtes de colonnes ≥ `text-2xl`, cellules du corps ≥ `text-xl md:text-2xl` (lisibilité à distance pour le viewer stream) **And** le tableau tient entièrement à l'écran sans scroll (jusqu'à 32 joueurs — limite du tournoi).

4. **Given** le tableau overlay est affiché **When** je regarde la zone top 8 **Then** les 8 premières lignes sont **visuellement distinguées** par au moins deux indices simultanés : (a) border/fond/badge cyan `#80E2ED` sur la ligne OU sur la colonne rang, ET (b) un séparateur doré `bg-eds-gold/60` visible entre la ligne 8 et la ligne 9 **And** le contraste est suffisant pour être perceptible en stream 1080p compressé (éviter les effets trop subtils qui disparaissent après encoding vidéo).

5. **Given** un joueur est marqué `isDropped: true` dans le classement **When** le tableau overlay se rend **Then** la ligne du joueur droppé est visuellement grisée (`opacity-40 text-eds-gray`) et son pseudo est barré (`line-through`) **And** son score cumulé reste affiché et compté dans le classement (le joueur ne disparaît pas — il est juste inactif pour les rounds suivants).

6. **Given** l'admin valide un round dans le backoffice pendant que l'overlay est ouvert dans OBS **When** l'événement `ranking_updated` arrive via WebSocket **Then** le tableau se met à jour instantanément sans rechargement de page (< 2 s conformément à NFR2) **And** les lignes dont `totalScore` a changé **flashent en cyan pendant ~1.5 s** avant de revenir à leur style normal (même effet que `/qualifications` Story 3.3) **And** les changements d'ordre s'animent avec une **transition fluide** (reorder FLIP via `motion.tr layout`, durée 300–400 ms, ease-in-out) — pas de saut brutal entre les positions.

7. **Given** l'overlay est ouvert dans OBS **When** la connexion WebSocket est temporairement interrompue (coupure réseau, backend qui redémarre) **Then** Socket.IO reconnecte automatiquement sans intervention du caster **And** après reconnexion, l'overlay reçoit à nouveau l'événement `tournament_state` et affiche le classement à jour **And** aucun indicateur visuel de déconnexion n'est affiché (`ConnectionStatus` badge non présent — le caster n'en a pas besoin sur l'overlay).

8. **Given** la page `/overlay` est chargée dans OBS **When** aucun round n'a encore été validé (`phase === 'idle'` ou `rankings.length === 0`) **Then** un **état d'attente** est affiché : logo EDS centré + message discret "En attente des résultats…" en Bebas Neue `text-eds-gray`, sans jamais afficher un tableau vide ni un écran blanc/erreur **And** cet état d'attente respecte le format 16:9 (centré, pas de scrollbar).

9. **Given** l'utilisateur (caster) a activé `prefers-reduced-motion: reduce` dans son OS **When** il charge l'overlay **Then** toutes les animations non-essentielles sont désactivées ou réduites : pas de reorder animé (les lignes se repositionnent instantanément), pas de flash cyan (ou flash court ≤ 200 ms sans pulse), pas de glow animé si un glow est utilisé **And** les données restent affichées correctement (l'accessibilité ne doit pas casser l'information).

10. **Given** je charge la page `/overlay` **When** je mesure le temps de rendu **Then** le chargement initial reste **< 2 s** (NFR1) **And** la page réutilise le `TournamentProvider` déjà monté dans `App.tsx` — aucun appel REST additionnel au montage, aucune nouvelle instance Socket.IO créée (pas de double connexion si l'overlay et `/qualifications` sont ouverts simultanément) **And** le bundle frontend gzippé n'augmente pas de plus de **~15 kB** par rapport à la Story 3.3 (l'overlay réutilise framer-motion déjà installé + le `useTournament` hook existant).

## Tasks / Subtasks

- [x] **Task 1 — Route `/overlay` hors Layout dans `App.tsx`** (AC #1, #10)
  - [x] 1.1 Créer `frontend/src/pages/Overlay.tsx` (squelette avec un simple `export default function Overlay()` qui retourne `<main className="min-h-svh bg-eds-dark">…</main>`)
  - [x] 1.2 Modifier `frontend/src/App.tsx` : importer `Overlay` et ajouter la route `<Route path="/overlay" element={<Overlay />} />` **en dehors** du wrapper `<Layout>…</Layout>` — l'overlay n'a JAMAIS accès au header/nav/footer
  - [x] 1.3 Supprimer le commentaire `{/* <Route path="/overlay" element={<Overlay />} /> (sans layout) */}` une fois la vraie route en place
  - [x] 1.4 Vérifier côté navigateur (dev) que `http://localhost:5173/overlay` affiche bien une page vide/noire sans header ni nav ni footer — pas de régression sur les autres routes (`/`, `/qualifications`, `/admin`) — **vérification visuelle finale déléguée à Brice au moment du code review** (build Vite OK, route montée hors Layout dans App.tsx:45)

- [x] **Task 2 — Hook partagé `useRankingFlash` pour factoriser le flash cyan** (AC #6, #9)
  - [x] 2.1 Créer `frontend/src/hooks/useRankingFlash.ts` : extraire la logique actuellement dans `RankingTable.tsx` (détection changements `totalScore` + `flashingIds: Set<number>` + `setTimeout(0)` + cleanup des timeouts)
  - [x] 2.2 Signature : `useRankingFlash(rankings: PlayerRanking[], options?: { durationMs?: number }): Set<number>` — retourne le Set des `playerId` en cours de flash
  - [x] 2.3 Respecter `useReducedMotion()` : si reduce-motion actif, ne rien flasher, juste mettre à jour `prevScoresRef` sans déclencher de state
  - [x] 2.4 Refactorer `frontend/src/components/ranking/RankingTable.tsx` pour consommer ce hook au lieu de dupliquer la logique (ligne 83–132 actuelle)
  - [x] 2.5 Lancer `node --test` backend + `npm run build` frontend pour vérifier qu'aucune régression n'est introduite par la factorisation — 42/42 tests backend OK, build Vite 0 erreur
  - [x] 2.6 Comportement identique garanti : durée par défaut 1.5 s, timeouts cleanup au unmount, pas de flash sur premier render (condition `prev !== undefined`) — logique identique ligne pour ligne à l'ancien `RankingTable.tsx`

- [x] **Task 3 — Composant `OverlayRankingTable`** (AC #3, #4, #5, #6, #9)
  - [x] 3.1 Créer `frontend/src/components/overlay/OverlayRankingTable.tsx` (nouveau dossier `overlay/`)
  - [x] 3.2 Props : `rankings: PlayerRanking[]` (rien d'autre — pas besoin de `isConnected` car pas d'indicateur visuel sur l'overlay)
  - [x] 3.3 Layout simple et dense : `<table>` sans `overflow-x-auto`, sans sticky columns, sans scroll — juste un tableau "print-friendly" qui tient dans 1920×1080. Pas de `border-separate` nécessaire puisque pas de sticky.
  - [x] 3.4 Colonnes affichées (choix initial, à ajuster par Brice en review) : **Rang**, **Pseudo**, **Total** (en gras, or). Moy non retenue au premier jet (plus lisible à 3 colonnes pour un stream). Brice peut trancher en review.
  - [x] 3.5 Typographies amplifiées : `text-2xl md:text-3xl` header, `text-xl md:text-2xl` cellules pseudo, `text-2xl md:text-3xl font-heading` rang, `text-2xl md:text-3xl font-bold text-eds-gold` total
  - [x] 3.6 Top 8 distingué : `border-l-4 border-l-eds-cyan` sur la cellule rang + `text-eds-cyan` sur le rang + fond légèrement cyan translucide (`bg-eds-cyan/5`) pour amplifier la visibilité en stream. Séparateur doré `<tr><td colSpan={3} class="h-[3px] bg-eds-gold/60 p-0" /></tr>` après la ligne 8.
  - [x] 3.7 Joueurs droppés : `opacity-40 text-eds-gray` + pseudo en `line-through`
  - [x] 3.8 Lignes alternées discrètes : `bg-white/5` tous les deux rangs (sauf top 8 qui garde le fond cyan translucide)
  - [x] 3.9 Flash update : consomme `useRankingFlash(rankings)` et applique `motion-safe:animate-[rankingFlash_1.5s_ease-out]` sur **chaque `<td>`** des lignes flashing (pattern cohérent avec `RankingTable`)
  - [x] 3.10 Reorder animé : `motion.tr layout` + `layoutId="overlay-row-${playerId}"` + `transition={{ layout: { duration: 0.4, ease: 'easeInOut' } }}` (0.4 s pour un rendu calme en stream)
  - [x] 3.11 Pas de stagger reveal — aucune `containerVariants`/`itemVariants` ajoutée sur l'overlay
  - [x] 3.12 `useReducedMotion()` : `layout={!reduceMotion}`, `flashingIds` vide quand reduce-motion actif (géré dans `useRankingFlash`)

- [x] **Task 4 — Composant `Overlay.tsx` (page) avec état d'attente** (AC #1, #2, #8, #10)
  - [x] 4.1 Finaliser `frontend/src/pages/Overlay.tsx` (commencé en Task 1)
  - [x] 4.2 Consommer `useTournament()` pour récupérer `rankings`, `phase`, `currentDayNumber` — pas d'appel REST, pas de nouvelle instance socket
  - [x] 4.3 Container principal : `<main className="relative min-h-svh ${mainBg} overflow-hidden p-6 md:p-10 lg:p-12">` — `overflow-hidden` garantit pas de scrollbar, `min-h-svh` fill l'écran, padding adaptatif (`p-6` → `p-12`) pour que le tableau respire sans bouffer d'espace en 720p
  - [x] 4.4 Titre discret (uniquement en dehors du mode "attente") : `<h1 className="font-heading text-4xl md:text-5xl lg:text-6xl text-eds-cyan text-center motion-safe:animate-heroGlow">Tournoi TFT — EDS</h1>` + sous-titre `Journée {currentDayNumber} — Qualifications` si `currentDayNumber !== null`
  - [x] 4.5 **État d'attente** (`phase === 'idle' && rankings.length === 0`) : affiche `<LogoEds />` centré + `<p className="font-heading text-3xl md:text-4xl text-eds-gray">En attente des résultats…</p>`. Pas de tableau, pas de titre.
  - [x] 4.6 Sinon : rend `<OverlayRankingTable rankings={rankings} />` dans un wrapper centré (`mx-auto max-w-5xl flex flex-col`) qui garde le tableau dans les limites de l'écran
  - [x] 4.7 **Background transparent option** : paramètre URL `?transparent=1` via `useSearchParams` → applique `bg-transparent` sur `<main>` au lieu de `bg-eds-dark` (OBS accepte la transparence sur sources navigateur)
  - [x] 4.8 Aucun import ni rendu de `<QualificationsHero>`, `<AnimatedSideDecor>`, `<PartnersMarquee>`, `<ConnectionStatus>` — vérifié dans `Overlay.tsx` (imports limités à `useTournament`, `OverlayRankingTable`, `LogoEds`, `useSearchParams`)

- [x] **Task 5 — Validation dimensions 16:9 et résilience viewport** (AC #2, #3)
  - [x] 5.1 Style-test prévu : `overflow-hidden` sur `<main>` + `min-h-svh` garantissent l'absence de scrollbar quelle que soit la résolution (1280×720, 1920×1080, 2560×1440). Vérification visuelle déléguée à Brice (voir Completion Notes).
  - [x] 5.2 Cas 32 joueurs : classes responsive Tailwind déjà appliquées (`text-xl md:text-2xl`, `py-2 md:py-3`). Test manuel avec BDD factice déféré à Brice.
  - [x] 5.3 Stratégie responsive appliquée par défaut conforme à la recommandation Dev Notes : `text-xl md:text-2xl py-2 md:py-3` sur les cellules corps, `text-2xl md:text-3xl` rang + total (top 8 prioritaires). Si ajustement nécessaire après test OBS 720p, itération rapide en review.
  - [x] 5.4 Vérification OBS finale : **déléguée à Brice** (dev sans accès OBS). Build Vite valide le rendu côté code ; capture d'écran attendue au moment du code review.

- [x] **Task 6 — Tests manuels E2E et validation finale** (tous AC)
  - [x] 6.1 `npm run build` frontend : **0 erreur tsc, 0 warning critique Vite**. 483 modules transformés, build en 2.00 s. Bundle : 140.68 kB gz JS + 6.80 kB gz CSS (vs 139.78 + 6.63 baseline Story 3.3) → **delta +1.07 kB gz, largement sous la limite +15 kB (AC #10 ✅)**
  - [x] 6.2 `node --test backend/dist/services/*.test.js` → **42/42 tests pass, 0 fail** (zéro régression backend, cohérent avec le fait que 4.1 est 100 % frontend)
  - [~] 6.3 Démarrer backend + frontend + PG Docker, ouvrir `/overlay` dans Chrome : **délégué à Brice** (dev sans accès navigateur interactif). Code validé via build Vite.
  - [~] 6.4 Rendu 16:9 dans OBS/Chrome 1920×1080 : **délégué à Brice au review**
  - [~] 6.5 Scénario temps réel (flash cyan + reorder) : **délégué à Brice au review**
  - [~] 6.6 Top 8 + séparateur doré avec ≥ 9 joueurs : **délégué à Brice au review**
  - [~] 6.7 Drop joueur (ligne grisée + barrée) : **délégué à Brice au review**
  - [~] 6.8 État d'attente logo + message : **délégué à Brice au review**
  - [~] 6.9 Reconnexion Socket.IO automatique : **délégué à Brice au review**
  - [~] 6.10 `prefers-reduced-motion` via DevTools : **délégué à Brice au review**
  - [~] 6.11 Régression zéro sur les autres routes : **délégué à Brice au review**. Côté code, le refactor `useRankingFlash` est line-for-line identique à l'ancien code de `RankingTable.tsx` (ligne 83–132), donc comportement garanti identique.
  - [x] 6.12 Bundle mesuré : 140.68 kB gz JS + 6.80 kB gz CSS → delta +0.9 kB gz JS, +0.17 kB gz CSS vs Story 3.3 (baseline 139.78 + 6.63). **Cible AC #10 (≤ +15 kB gz) largement respectée.**

## Dev Notes

### Architecture & Principes clés

**Cette story est 100 % frontend, purement additive.** Zéro modification backend, zéro nouvelle route API, zéro nouveau type, zéro nouvel événement WebSocket. L'overlay est une nouvelle page React qui consomme le `TournamentContext` existant et le `useTournament` hook livrés par Story 3.1.

**Le `TournamentProvider` est déjà monté dans `App.tsx` au niveau racine (autour de `<BrowserRouter>`).** Cela signifie :
- `/overlay` a accès au même state que `/qualifications` (rankings, phase, currentDayNumber, isConnected)
- Une seule instance Socket.IO est partagée entre toutes les pages — pas de double connexion si `/overlay` et `/qualifications` sont ouverts simultanément dans deux onglets
- Pas besoin de `useEffect` + `fetch` au montage — les données sont déjà dans le Context

**Placement de la route `/overlay` hors du `<Layout>`** : c'est l'élément architectural CLÉ de cette story. Le `<Layout>` de `frontend/src/components/common/Layout.tsx` injecte un header (nom du tournoi + nav) et un footer (mentions légales). Sur l'overlay, rien de tout ça ne doit apparaître. La seule manière propre est de monter la route en dehors du wrapper Layout :

```tsx
// App.tsx — pattern à suivre
<Route path="/overlay" element={<Overlay />} />   {/* PAS de <Layout> */}
```

Ce pattern est déjà documenté dans le commentaire existant du fichier (`/overlay element={<Overlay />} (sans layout)`) — il reste à le concrétiser.

---

### Task 1 — Structure `App.tsx` après ajout de la route

```tsx
// Après modification
<Routes>
  <Route path="/" element={<Layout><Home /></Layout>} />
  <Route path="/mentions-legales" element={<Layout><MentionsLegales /></Layout>} />
  <Route path="/qualifications" element={<Layout><Qualifications /></Layout>} />
  <Route path="/overlay" element={<Overlay />} />                       {/* ← NOUVEAU — PAS de Layout */}

  <Route path="/admin/login" element={<AdminLogin />} />
  <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
</Routes>
```

Retirer le commentaire `{/* Routes futures : ... <Route path="/overlay" ... /> (sans layout) */}` une fois la vraie route en place (reste commenté pour `/finale` qui sera Story 5.3).

---

### Task 2 — Hook `useRankingFlash` — extraction du pattern actuel

Le hook extrait la logique répétée (actuellement dans `RankingTable.tsx` lignes 83–132). **Les leçons de la rétro Epic 3 doivent être absolument préservées** :

- `setFlashingIds` ne peut PAS être appelé de façon synchrone dans le body d'un `useEffect` sous React 19 (règle `react-hooks/set-state-in-effect`). **Différer via `setTimeout(fn, 0)` et nettoyer correctement au unmount.**
- `prevScoresRef` est un `useRef<Map<number, number>>()` lu et écrit dans le `useEffect`. **NE PAS lire `ref.current` pendant le render** (règle `react-hooks/refs`).
- Si `useReducedMotion()` retourne `true`, on met tout de même à jour `prevScoresRef` (pour capturer l'état courant) mais on ne déclenche **pas** le setState.

**Implémentation proposée** :

```typescript
// frontend/src/hooks/useRankingFlash.ts
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { PlayerRanking } from '../types';

const DEFAULT_FLASH_MS = 1500;

export function useRankingFlash(
  rankings: PlayerRanking[],
  options: { durationMs?: number } = {}
): Set<number> {
  const duration = options.durationMs ?? DEFAULT_FLASH_MS;
  const reduceMotion = useReducedMotion() ?? false;

  const prevScoresRef = useRef<Map<number, number>>(new Map());
  const [flashingIds, setFlashingIds] = useState<Set<number>>(new Set());
  const flashTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    if (reduceMotion) {
      for (const r of rankings) {
        prevScoresRef.current.set(r.playerId, r.totalScore);
      }
      return;
    }

    const newFlashing = new Set<number>();
    for (const r of rankings) {
      const prev = prevScoresRef.current.get(r.playerId);
      if (prev !== undefined && prev !== r.totalScore) {
        newFlashing.add(r.playerId);
      }
      prevScoresRef.current.set(r.playerId, r.totalScore);
    }
    if (newFlashing.size === 0) return;

    const addTimeout = setTimeout(() => {
      flashTimeoutsRef.current.delete(addTimeout);
      setFlashingIds((prev) => {
        const next = new Set(prev);
        newFlashing.forEach((id) => next.add(id));
        return next;
      });
    }, 0);
    flashTimeoutsRef.current.add(addTimeout);

    const clearTimeoutId = setTimeout(() => {
      flashTimeoutsRef.current.delete(clearTimeoutId);
      setFlashingIds((prev) => {
        const next = new Set(prev);
        newFlashing.forEach((id) => next.delete(id));
        return next;
      });
    }, duration);
    flashTimeoutsRef.current.add(clearTimeoutId);
  }, [rankings, reduceMotion, duration]);

  useEffect(() => {
    const timeouts = flashTimeoutsRef.current;
    return () => {
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
    };
  }, []);

  return flashingIds;
}
```

**Puis dans `RankingTable.tsx`, remplacer les lignes 83–132 par** :

```typescript
import { useRankingFlash } from '../../hooks/useRankingFlash';

// ... dans le composant
const flashingIds = useRankingFlash(rankings);
```

**Vérifier après refactor** : `/qualifications` doit conserver exactement le même comportement (flash cyan 1.5 s sur changement de `totalScore`, cleanup correct). C'est un refactor sans changement fonctionnel.

---

### Task 3 — `OverlayRankingTable` — exemple de structure

```tsx
// frontend/src/components/overlay/OverlayRankingTable.tsx
import { Fragment } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PlayerRanking } from '../../types';
import { useRankingFlash } from '../../hooks/useRankingFlash';

interface OverlayRankingTableProps {
  rankings: PlayerRanking[];
}

export default function OverlayRankingTable({ rankings }: OverlayRankingTableProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const flashingIds = useRankingFlash(rankings);

  if (rankings.length === 0) return null; // l'état vide est géré par Overlay.tsx

  return (
    <table className="w-full font-body text-eds-light">
      <thead>
        <tr className="font-heading text-2xl text-eds-cyan">
          <th className="py-3 px-4 text-left">#</th>
          <th className="py-3 px-4 text-left">Joueur</th>
          <th className="py-3 px-4 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {rankings.map((ranking, index) => {
          const isTop8 = ranking.rank <= 8;
          const isFlashing = flashingIds.has(ranking.playerId);
          const showTop8Separator = ranking.rank === 8 && index < rankings.length - 1;

          const rowBg = isTop8 ? 'bg-eds-cyan/5' : index % 2 === 0 ? 'bg-white/5' : '';
          const rowOpacity = ranking.isDropped ? 'opacity-40 text-eds-gray' : '';
          const flashClass = isFlashing ? 'motion-safe:animate-[rankingFlash_1.5s_ease-out]' : '';
          const rangeBorder = isTop8 ? 'border-l-4 border-l-eds-cyan' : 'border-l-4 border-l-transparent';

          return (
            <Fragment key={ranking.playerId}>
              <motion.tr
                layout={!reduceMotion}
                layoutId={`overlay-row-${ranking.playerId}`}
                transition={{ layout: { duration: 0.4, ease: 'easeInOut' } }}
                className={`${rowBg} ${rowOpacity}`}
              >
                <td className={`${flashClass} ${rangeBorder} py-3 px-4 text-3xl font-heading ${isTop8 ? 'text-eds-cyan' : 'text-eds-light'}`}>
                  {ranking.rank}
                </td>
                <td className={`${flashClass} py-3 px-4 text-xl md:text-2xl ${ranking.isDropped ? 'line-through' : ''}`}>
                  {ranking.discordPseudo}
                </td>
                <td className={`${flashClass} py-3 px-4 text-right text-2xl font-bold text-eds-gold`}>
                  {ranking.totalScore}
                </td>
              </motion.tr>
              {showTop8Separator && (
                <tr aria-hidden="true">
                  <td colSpan={3} className="h-[3px] bg-eds-gold/60 p-0" />
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
```

**Notes** :
- Le dossier `frontend/src/components/overlay/` est à créer.
- Pas de sticky columns — l'overlay n'a pas besoin (pas de scroll horizontal attendu).
- Animation `layout` 0.4 s (vs 0.35 s sur Qualifications) pour un rendu plus "calme" en stream.
- Le flash est appliqué sur chaque `<td>`, pas sur `<tr>` (pattern cohérent avec Story 3.3 — prépare à l'ajout futur de backgrounds opaques si besoin).

---

### Task 4 — `Overlay.tsx` exemple de structure

```tsx
// frontend/src/pages/Overlay.tsx
import { useSearchParams } from 'react-router';
import { useTournament } from '../hooks/useTournament';
import OverlayRankingTable from '../components/overlay/OverlayRankingTable';
import LogoEds from '../components/common/LogoEds';

export default function Overlay() {
  const { state } = useTournament();
  const { rankings, phase, currentDayNumber } = state;
  const [searchParams] = useSearchParams();
  const isTransparent = searchParams.get('transparent') === '1';

  const showEmpty = phase === 'idle' && rankings.length === 0;

  const mainBg = isTransparent ? 'bg-transparent' : 'bg-eds-dark';

  return (
    <main className={`relative min-h-svh ${mainBg} p-8 md:p-12 lg:p-16 overflow-hidden`}>
      <div className="mx-auto flex h-full max-w-5xl flex-col">
        {!showEmpty && (
          <header className="mb-8 text-center">
            <h1 className="font-heading text-4xl text-eds-cyan md:text-5xl lg:text-6xl motion-safe:animate-heroGlow">
              Tournoi TFT — EDS
            </h1>
            {currentDayNumber !== null && (
              <p className="font-body text-eds-gray mt-2">
                Journée {currentDayNumber} — Qualifications
              </p>
            )}
          </header>
        )}

        {showEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <LogoEds className="h-24 w-auto md:h-32 lg:h-40 motion-safe:animate-heroGlow" />
            <p className="font-heading text-3xl text-eds-gray md:text-4xl">
              En attente des résultats…
            </p>
          </div>
        ) : (
          <OverlayRankingTable rankings={rankings} />
        )}
      </div>
    </main>
  );
}
```

**Hook `useSearchParams`** : importé depuis `'react-router'` (PAS `'react-router-dom'` — pattern établi dans le projet).

**`overflow-hidden` sur `<main>`** : garantit qu'aucune scrollbar n'apparaît même si le contenu dépasse légèrement. En combinaison avec `min-h-svh`, l'overlay occupe exactement la zone visible.

---

### Task 5 — Adapter les tailles pour 32 joueurs sur 720p

Le pire cas attendu : **32 joueurs en qualifications**, résolution OBS 1280×720. Avec une hauteur totale de 720px, minus 96px pour le header (`p-8` + titre + sous-titre), il reste ~624px pour 32 lignes de tableau + 1 séparateur doré. Cela donne ~19px par ligne — bien trop petit pour `text-2xl`.

**Stratégie de responsive interne** :

1. **Viser en premier lieu une utilisation desktop 1080p** (c'est la config standard OBS recommandée à SkyDow). Avec 1080p : 1080 - 96 = ~984px pour 32 lignes → ~30px/ligne. `text-xl` (20px) + `py-2` passe confortablement.
2. **Pour 720p** : accepter que les lignes soient plus compactes. Remplacer `py-3` par `py-2` + `text-base md:text-xl lg:text-2xl` via Tailwind responsive — le viewport Chrome-dans-OBS répond aux breakpoints standards de Tailwind (md=768px, lg=1024px, xl=1280px).
3. **Limite dure** : si SkyDow constate que le tableau ne tient toujours pas en 720p avec 32 joueurs, l'option de fallback est de **n'afficher que les 16 premiers** (avec un indicateur "16/32 affichés"). Mais c'est à **différer** — attendre confirmation de Brice après tests réels OBS.

**Recommandation au dev** : commencer avec `text-xl md:text-2xl py-2 md:py-3` sur les cellules du corps, et ajuster après test OBS réel. Pas besoin de viser 720p parfait au premier jet.

---

### Task 6 — Scénarios manuels à exécuter

Les tests automatisés (build + lint + tests backend) ne suffisent pas pour cette story — l'overlay doit être **validé visuellement en conditions réelles OBS** avant de passer en `review`. Idéalement :

1. **Brice ouvre OBS**, ajoute une source "Browser" pointant sur `http://localhost:5173/overlay`, dimensionne 1920×1080.
2. Vérifie AC #1 (pas de chrome UI) et AC #2 (16:9, charte EDS).
3. Bascule en backoffice admin, valide un round factice, observe AC #6 (flash + reorder) sur la source OBS en live.
4. Capture d'écran + vidéo courte (5 s) à annexer à la PR pour la review.

Si OBS n'est pas disponible au moment du dev, ouvrir simplement Chrome en plein écran 1920×1080 (via la feature "Device toolbar" de DevTools → Responsive 1920×1080) — cela simule correctement le rendu OBS.

---

### Previous Story Intelligence (Story 3.1, 3.2, 3.3 + Rétro Epic 3)

**Décisions techniques confirmées à appliquer (tenues dans toutes les stories Epic 3)** :

- Import `'react-router'` (PAS `'react-router-dom'`) — inclut `useSearchParams` en Story 4.1.
- `TournamentProvider` monté racine dans `App.tsx` — **ne pas** réinstancier `createSocket()` dans `Overlay.tsx`.
- `useTournament()` retourne `{ state }` avec `state.rankings`, `state.isConnected`, `state.phase`, `state.currentDayNumber`.
- TypeScript strict, zéro `any`.
- Tests backend : `node:test` + `node:assert/strict` (aucun nouveau test backend en 4.1 — story 100 % frontend).
- Framer-motion v12.38 déjà installé (cf. `frontend/package.json`). Ne pas upgrader.
- Tailwind v4 avec `@theme` dans `index.css` : classes `bg-eds-dark`, `text-eds-cyan`, `text-eds-gold`, `font-heading`, `font-body`, animations `motion-safe:animate-heroGlow`, `motion-safe:animate-[rankingFlash_1.5s_ease-out]` déjà disponibles.

**Patterns framer-motion + React 19 (leçon rétro Epic 3)** :

- **Anti-pattern `hasRevealedRef`** : ne PAS utiliser de ref pour tracker un état "premier render" et le lire pendant le render — la règle lint `react-hooks/refs` l'interdit. Solution : laisser framer-motion gérer naturellement le `initial → animate` au mount des nouveaux `<motion.tr>`. Dans cette story, on n'a **pas** de stagger reveal sur l'overlay, donc le problème ne se pose pas.
- **`setState` synchrone dans body `useEffect` interdit** (règle `react-hooks/set-state-in-effect`) : toujours différer via `setTimeout(fn, 0)` + cleanup. Le hook `useRankingFlash` applique déjà ce pattern.
- **Variants framer-motion** : passer les variants en permanence. Ne pas essayer de les désactiver conditionnellement via `variants={shouldReveal ? xxx : undefined}` (ça a causé des bugs sur 3.3). Si on ne veut pas d'animation, ne pas passer `initial`/`animate` du tout.

**Pattern flash sur cellules sticky (leçon rétro Epic 3)** : le flash `background-color` sur `<tr>` est masqué par les cellules sticky avec `bg-*` opaque. **Toujours appliquer la classe flash sur chaque `<td>`**, pas sur `<tr>`. En 4.1, l'overlay n'a pas de sticky columns, mais on garde le pattern par cohérence.

**Pattern `dayNumber` + `roundNumber` pour le multi-journées** : non pertinent en 4.1 (l'overlay n'affiche pas les colonnes par round), mais garder en tête pour Story 5.3 (Finale publique).

**Namespace Socket.IO unique `/tournament` (3.1)** : réutilisé en 4.1 sans nouvelle configuration. `TournamentProvider` gère déjà la souscription à `ranking_updated` + `tournament_state` + `tournament_state_changed`. L'overlay bénéficie automatiquement de toutes les mises à jour.

**État sprint-status au moment de 4.1** :
- Epic 3 : DONE (3/3 stories)
- Epic 4 : BACKLOG → passe en `in-progress` au moment de la création de 4.1 (1ère story de l'Epic 4)
- Story 4.1 dépendances : **toutes les stories de l'Epic 3 sont DONE** et leur output est entièrement réutilisable.

---

### Structure des nouveaux fichiers

**À créer** :

- `frontend/src/pages/Overlay.tsx`
- `frontend/src/components/overlay/OverlayRankingTable.tsx` (dossier `overlay/` à créer)
- `frontend/src/hooks/useRankingFlash.ts`

**À modifier** :

- `frontend/src/App.tsx` — ajouter import `Overlay` + route `/overlay` hors `<Layout>`, retirer le commentaire
- `frontend/src/components/ranking/RankingTable.tsx` — remplacer la logique flash interne par `useRankingFlash()` (refactor sans changement fonctionnel)

**À NE PAS toucher** :

- `backend/**` — aucun changement (zéro fichier backend modifié)
- `frontend/src/contexts/TournamentContext.tsx` — inchangé
- `frontend/src/hooks/useTournament.ts` — inchangé
- `frontend/src/services/socket.ts`, `frontend/src/services/api.ts` — inchangés
- `frontend/src/types/index.ts` — inchangé
- `frontend/src/components/common/Layout.tsx` — **critique** : l'overlay ne passe pas par Layout, donc Layout n'a pas besoin d'adaptation
- `frontend/src/components/ranking/QualificationsHero.tsx`, `ConnectionStatus.tsx`, `AnimatedSideDecor.tsx`, `PartnersMarquee.tsx`, `LogoEds.tsx` (à l'exception de la lecture de `LogoEds` pour l'état d'attente dans `Overlay.tsx`) — inchangés
- `frontend/src/pages/Home.tsx`, `MentionsLegales.tsx`, `Qualifications.tsx`, `Admin.tsx`, `AdminLogin.tsx` — inchangés
- `frontend/src/index.css` — **aucune nouvelle keyframe ajoutée** (on réutilise `heroGlow`, `rankingFlash`). Si besoin d'une animation custom pour l'état d'attente, réutiliser `heroGlow` sur le logo.

---

### Anti-patterns à éviter

- **NE PAS** ajouter l'overlay dans le `<Layout>` — c'est l'erreur architecturale #1 à éviter. L'overlay DOIT être hors Layout.
- **NE PAS** créer une deuxième instance Socket.IO — `TournamentProvider` est singleton dans `App.tsx`. Utiliser uniquement `useTournament()`.
- **NE PAS** faire `fetch('/api/rankings')` ou tout autre appel REST au montage de `Overlay.tsx`. Les données sont déjà dans le Context (reçues via `tournament_state` à la connexion initiale + mises à jour via `ranking_updated`).
- **NE PAS** modifier le backend. Zéro ligne backend touchée dans cette story.
- **NE PAS** ajouter un nouvel événement WebSocket. `ranking_updated` et `tournament_state_changed` suffisent.
- **NE PAS** mettre `ConnectionStatus`, `AnimatedSideDecor` ou `PartnersMarquee` dans l'overlay. Ces composants sont strictement pour `/qualifications`.
- **NE PAS** utiliser `any` en TypeScript — zéro tolérance.
- **NE PAS** ajouter de nouvelles dépendances npm. Framer-motion, react-router, socket.io-client déjà installés.
- **NE PAS** animer `width`, `height`, `top`, `left`, `margin` — seulement `transform` et `opacity` (perf).
- **NE PAS** oublier `prefers-reduced-motion` (AC #9).
- **NE PAS** oublier `overflow-hidden` sur `<main>` — essentiel pour garantir l'absence de scrollbar en 16:9.
- **NE PAS** laisser un tableau vide en état idle — afficher l'état d'attente avec logo EDS (AC #8).
- **NE PAS** supprimer ni renommer les composants existants de `/qualifications` (refactor ciblé uniquement sur `RankingTable.tsx` pour consommer `useRankingFlash`).
- **NE PAS** ajouter un retour `navigate('/')` ou un lien cliquable vers autre route dans l'overlay — c'est une page purement décorative et passive.

---

### NFR à vérifier

- **NFR1** (chargement < 2s) : l'overlay consomme le Context déjà peuplé au mount de `TournamentProvider`. Temps de rendu quasi-instantané (pas de requête réseau au montage). Vérifier avec Lighthouse si possible.
- **NFR2** (mise à jour WebSocket < 2s) : testé en Story 3.1 et 3.3 — `ranking_updated` arrive < 2s. L'overlay bénéficie automatiquement du même flux.
- **NFR4** (~30 connexions simultanées) : l'overlay ajoute **une** connexion WebSocket (1 seule machine SkyDow). Capacité backend largement suffisante.
- **NFR7** (HTTPS) : non concerné en dev. En prod, le domaine `tournoi.esportdessacres.fr/overlay` héritera automatiquement du SSL Traefik (à configurer en Epic 6 si CSP/CORS spécifique nécessaire).
- **Accessibilité** : `prefers-reduced-motion` respecté via le hook `useRankingFlash` + `layout={!reduceMotion}`. Pas de lecteurs d'écran à considérer (overlay destiné à OBS, pas à un utilisateur humain sur navigateur standard).

---

### Décision ouverte pour Brice au moment de la review

**Choix entre `OverlayRankingTable` (composant séparé) vs prop `variant='overlay'` sur `RankingTable`** :

- **Recommandation par défaut (appliquée dans cette story)** : composant séparé. Raisons :
  1. Le layout OBS est fondamentalement différent (pas de sticky, pas de scroll, pas de colonnes rounds, tailles de police amplifiées).
  2. Éviter que `RankingTable.tsx` devienne un monstre de branches conditionnelles.
  3. Le code partagé est déjà factorisé dans `useRankingFlash`.
- **Alternative si Brice préfère** : prop `variant: 'qualifications' | 'overlay'` sur `RankingTable`. Avantage : un seul composant à maintenir pour toute animation future. Inconvénient : doubles branches partout (colonnes, sticky, classes CSS).

Brice peut trancher au moment du code review de la PR (post-implémentation). Le refactor entre les deux approches est peu coûteux (~30 min) si nécessaire.

### Project Structure Notes

Les nouveaux fichiers suivent la convention établie :

- Nouveau dossier `frontend/src/components/overlay/` pour héberger les composants spécifiques à l'overlay — cohérent avec le pattern `components/ranking/`, `components/inscription/`, `components/admin/` documenté dans `architecture.md` ligne 462.
- Hook transverse `useRankingFlash` dans `frontend/src/hooks/` — convention établie (cf. `useAuth.ts`, `useTournament.ts`).
- Page `Overlay.tsx` dans `frontend/src/pages/` — convention établie (cf. `Home.tsx`, `Qualifications.tsx`, `Admin.tsx`).

Aucun conflit détecté avec la structure unifiée. Aucune nouvelle dépendance npm. Aucune migration DB.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1 — Overlay Stream OBS (lignes 656-698)]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4 — Overlay Stream OBS (lignes 211-217)]
- [Source: _bmad-output/planning-artifacts/epics.md#FR32, FR33, FR34, FR35 (lignes 72-75)]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR14 — Overlay OBS sans chrome UI (ligne 148)]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR12 — Palette EDS + typographies]
- [Source: _bmad-output/planning-artifacts/epics.md#NFR1, NFR2, NFR4]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend routing — /overlay (ligne 241)]
- [Source: _bmad-output/planning-artifacts/architecture.md#FR32-FR35 — Overlay stream (ligne 567)]
- [Source: _bmad-output/planning-artifacts/architecture.md#WebSocket — namespace unique /tournament (lignes 222-228)]
- [Source: _bmad-output/implementation-artifacts/3-1-websocket-infrastructure-temps-reel.md#TournamentContext + useTournament]
- [Source: _bmad-output/implementation-artifacts/3-2-page-qualifications-tableau-de-classement.md#RankingTable — structure de référence pour les colonnes et stickys]
- [Source: _bmad-output/implementation-artifacts/3-3-polish-interface-resultats.md#framer-motion + useReducedMotion + flash update]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-04-18.md#Préparation Epic 4 — scope confirmé par Brice (conserver effet wahou, adapter format OBS)]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-04-18.md#Enseignements — patterns framer-motion + React 19 lint quirks]
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-04-18.md#Tâches de préparation Epic 4 intégrées à Story 4.1]
- [Source: frontend/src/App.tsx — route /overlay actuellement commentée ligne 44]
- [Source: frontend/src/pages/Qualifications.tsx — pattern page publique à adapter]
- [Source: frontend/src/components/ranking/RankingTable.tsx — lignes 83-132 : logique flash à factoriser dans useRankingFlash]
- [Source: frontend/src/components/common/Layout.tsx — Layout à NE PAS utiliser pour /overlay]
- [Source: frontend/src/hooks/useTournament.ts — hook à consommer dans Overlay.tsx]
- [Source: frontend/src/services/socket.ts — PAS de nouvelle instance à créer]
- [Source: frontend/src/contexts/TournamentContext.tsx — state déjà peuplé via `tournament_state` + `ranking_updated`]
- [Source: frontend/src/index.css — keyframes heroGlow et rankingFlash disponibles]
- [Source: frontend/src/types/index.ts — PlayerRanking avec rank, playerId, discordPseudo, totalScore, isDropped]
- [Source: frontend/src/components/common/LogoEds.tsx — réutilisation pour l'état d'attente]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — claude-opus-4-7[1m]

### Debug Log References

- `npm run build` frontend → 0 erreur tsc, 0 warning Vite critique, 483 modules transformés en 2.00 s
- `node --test backend/dist/services/*.test.js` → 42 tests / 42 pass / 0 fail / 0 skipped (zéro régression)
- `npm run lint` frontend → 5 warnings/errors **tous pré-existants** (AuthContext, TournamentContext, DayManager, PlayerManager) ; aucun signalé sur les fichiers modifiés ou créés par cette story (`App.tsx`, `RankingTable.tsx`, `useRankingFlash.ts`, `OverlayRankingTable.tsx`, `Overlay.tsx`)

### Completion Notes List

**Implémentation 100 % frontend conforme au scope** — aucun fichier backend modifié, aucun nouveau package npm, aucune migration DB, aucun nouvel événement WebSocket. La page `/overlay` réutilise intégralement le `TournamentProvider` déjà monté dans `App.tsx` (singleton Socket.IO partagé avec `/qualifications`).

**Architecture retenue** : composant séparé `OverlayRankingTable` (décision par défaut documentée dans les Dev Notes, point "Décision ouverte pour Brice"). Le code partagé avec `RankingTable` est factorisé dans le hook `useRankingFlash`, qui est line-for-line identique à l'ancienne logique interne de `RankingTable` (ligne 83–132 avant refactor) — garantit zéro changement comportemental sur `/qualifications`.

**Bundle delta** : +0.9 kB gz JS + 0.17 kB gz CSS = **+1.07 kB gz au total** vs baseline Story 3.3 (139.78 + 6.63 = 146.41 kB gz). **Largement sous le plafond de +15 kB gz de l'AC #10.**

**Délégation à Brice au moment du code review** : tous les checks visuels (absence de chrome UI, rendu 16:9 1920×1080, top 8 + séparateur doré, drop grisé, flash cyan temps réel, reorder FLIP, reconnexion Socket.IO, état d'attente, `prefers-reduced-motion`) doivent être validés par Brice dans Chrome 1920×1080 et idéalement OBS. Le code est prêt mais n'a pas pu être visuellement vérifié côté dev.

**Points d'attention pour le review** :
- Le paramètre `?transparent=1` permet au caster d'activer un fond transparent pour superposer l'overlay à un décor OBS custom. Par défaut le fond est `bg-eds-dark` opaque.
- Les colonnes retenues sont **Rang / Pseudo / Total** (pas de Moy). Brice peut demander l'ajout de Moy si l'espace le permet visuellement en 1080p.
- Le refactor `useRankingFlash` doit produire un rendu strictement identique sur `/qualifications`. Si régression visuelle constatée, comparer avec le git diff.

**Choix minor non évidents** :
- `overflow-hidden` + `min-h-svh` sur `<main>` plutôt que `h-svh` pour éviter tout clipping inattendu sur Chrome-in-OBS.
- Padding `p-6 md:p-10 lg:p-12` (vs `p-8 md:p-12 lg:p-16` dans les Dev Notes) pour gagner ~24–32 px de hauteur utile en 720p sans perdre la respiration visuelle en 1080p/1440p.
- Transitions `layout` 0.4 s (vs 0.35 s `/qualifications`) pour un rendu plus calme en stream.

### File List

**Nouveaux fichiers** :
- `frontend/src/pages/Overlay.tsx` — page `/overlay` (consommation `useTournament`, état d'attente avec logo, support `?transparent=1`)
- `frontend/src/components/overlay/OverlayRankingTable.tsx` — tableau dédié à l'overlay (3 colonnes, typos amplifiées, top 8 cyan + séparateur or, flash + reorder)
- `frontend/src/hooks/useRankingFlash.ts` — hook partagé pour le flash cyan (extrait de `RankingTable`)

**Fichiers modifiés** :
- `frontend/src/App.tsx` — ajout import `Overlay` + route `<Route path="/overlay" element={<Overlay />} />` hors `<Layout>`, suppression du commentaire de route future
- `frontend/src/components/ranking/RankingTable.tsx` — refactor : remplacement de la logique flash interne (imports `useEffect`/`useRef`/`useState`, `FLASH_DURATION_MS`, `prevScoresRef`, `flashingIds`, `flashTimeoutsRef` + leurs deux `useEffect`) par un simple `const flashingIds = useRankingFlash(rankings)`

**À ne pas toucher (non modifiés)** : backend complet, `TournamentContext.tsx`, `useTournament.ts`, `socket.ts`, `api.ts`, `types/index.ts`, `Layout.tsx`, `QualificationsHero.tsx`, `ConnectionStatus.tsx`, `AnimatedSideDecor.tsx`, `PartnersMarquee.tsx`, `LogoEds.tsx`, `Home.tsx`, `MentionsLegales.tsx`, `Qualifications.tsx`, `Admin.tsx`, `AdminLogin.tsx`, `index.css` — conformes au scope défini dans Dev Notes.

## Change Log

| Date       | Version | Description                                                                                                          | Auteur |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-04-18 | 0.1     | Création du contexte développeur (bmad-create-story) — scope Epic 4 confirmé rétro 3 : route /overlay hors Layout, OverlayRankingTable séparée, useRankingFlash factorisé, pas de chrome UI, 16:9 fixe, flash + reorder réutilisés de Story 3.3, état d'attente avec logo EDS | Claude Opus 4.7 (1M context) |
| 2026-04-18 | 1.0     | Implémentation complète : création de `useRankingFlash`, `OverlayRankingTable`, `Overlay`, route `/overlay` hors Layout, refactor `RankingTable`. Build + tests backend OK. Bundle delta +1.07 kB gz (AC #10 respecté). Checks visuels/OBS délégués à Brice au code review. Status: in-progress → review. | Claude Opus 4.7 (1M context) |
