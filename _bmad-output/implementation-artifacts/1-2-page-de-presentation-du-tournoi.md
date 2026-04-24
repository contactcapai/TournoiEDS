# Story 1.2 : Page de Presentation du Tournoi

Status: review

## Story

As a **visiteur**,
I want **consulter la page de presentation du tournoi avec les dates, le format, le cash prize et le reglement**,
So that **je peux decouvrir le tournoi et decider de m'inscrire**.

## Acceptance Criteria

1. **Given** je suis un visiteur sur la page d'accueil **When** la page se charge **Then** je vois une hero section avec le nom du tournoi en Bebas Neue Bold **And** les informations essentielles sont visibles immediatement : dates des journees, format (qualifications + finale), cash prize **And** le fond est en dark mode (#29265B) avec les accents cyan et or de la charte EDS

2. **Given** je suis sur la page d'accueil **When** je cherche le reglement **Then** le reglement est accessible via un accordeon ou un lien clairement visible **And** le contenu du reglement inclut le format, le bareme de points et la condition de victoire en finale

3. **Given** je consulte la page depuis un mobile **When** la page se charge **Then** le contenu est lisible et navigable sans scroll horizontal **And** les informations essentielles restent visibles sans devoir scroller excessivement

4. **Given** je consulte la page depuis un desktop **When** la page se charge **Then** la mise en page exploite l'espace disponible **And** le chargement initial est inferieur a 2 secondes

## Tasks / Subtasks

- [x] Task 1 : Installer React Router v7 et configurer le routing SPA (AC: #1, #4)
  - [x] 1.1 Installer `react-router` dans le frontend
  - [x] 1.2 Creer le composant `App.tsx` avec `BrowserRouter` et les routes (pour l'instant uniquement `/` → `Home`)
  - [x] 1.3 Preparer les routes futures en commentaire : `/qualifications`, `/finale`, `/overlay`, `/admin`, `/admin/login`

- [x] Task 2 : Creer la page Home avec la hero section (AC: #1)
  - [x] 2.1 Creer `src/pages/Home.tsx`
  - [x] 2.2 Implementer la hero section :
    - Titre du tournoi ("Tournoi TFT — Esport des Sacres") en `font-heading` (Bebas Neue), tres grand (`text-6xl` desktop, `text-4xl` mobile)
    - Sous-titre "Set 17 — Saison 2026" en `font-heading` plus petit
    - Fond `bg-eds-dark`, accents `text-eds-cyan` et `text-eds-gold` pour guider l'oeil
  - [x] 2.3 Afficher les informations essentielles immediatement visibles :
    - **Dates** : 3 journees de qualification (17 mai, 24 mai, 31 mai 2026) + finale
    - **Format** : qualifications (3 journees x 6 rounds, systeme suisse) + finale (top 8, lobby unique)
    - **Cash prize** : montant a definir par l'orga (placeholder si non communique)
  - [x] 2.4 Utiliser des cartes ou blocs visuels avec accents `eds-cyan` / `eds-gold` pour structurer les infos (UX-DR15)

- [x] Task 3 : Implementer la section reglement (AC: #2)
  - [x] 3.1 Creer un composant accordeon natif (element HTML `<details>/<summary>`) ou un composant React simple (pas de lib externe)
  - [x] 3.2 Contenu du reglement :
    - Format du tournoi (qualifications + finale)
    - Bareme de points (1er = 8 pts, 2e = 7 pts, ..., 8e = 1 pt)
    - Systeme suisse (redistribution par classement entre chaque round)
    - Condition de victoire en finale (top 1 + >= 20 points cumules)
    - Gestion des drops (retrait sans perte de points acquis)
    - Nombre maximum de rounds par journee (6)
  - [x] 3.3 Styler le reglement avec la charte EDS (fond leger `eds-dark` ou `eds-light/10`, bordures `eds-gray`)

- [x] Task 4 : Implementer le responsive (AC: #3, #4)
  - [x] 4.1 Mobile-first : la hero section et les infos essentielles sont lisibles sans scroll horizontal
  - [x] 4.2 Desktop : la mise en page utilise une grille (`grid` ou `flex`) pour exploiter l'espace
  - [x] 4.3 Tester sur viewports : 375px (mobile), 768px (tablette), 1280px+ (desktop)
  - [x] 4.4 Les informations critiques (dates, format, cash prize) restent au-dessus du fold sur mobile

- [x] Task 5 : Creer le layout commun (header/footer) (AC: #1, #3)
  - [x] 5.1 Creer `src/components/common/Layout.tsx` avec un header minimal (logo EDS ou nom du tournoi) et un footer
  - [x] 5.2 Le footer contient un lien vers les mentions legales (prepare pour Story 1.4)
  - [x] 5.3 Le layout wrappe toutes les pages publiques (pas l'overlay)
  - [x] 5.4 Le header inclut une navigation minimale : Accueil, Qualifications, Finale (liens vers routes futures, desactives ou grises pour l'instant)

- [x] Task 6 : Validation et performance (AC: #4)
  - [x] 6.1 Verifier que `npm run build` passe sans erreur
  - [x] 6.2 Verifier que la page s'affiche correctement dans le navigateur (`npm run dev`)
  - [x] 6.3 Verifier le rendu mobile (DevTools responsive)
  - [x] 6.4 S'assurer que le chargement initial est rapide (pas de dependances lourdes ajoutees)

## Dev Notes

### Architecture & Patterns a suivre

- **Route** : `/` → `pages/Home.tsx` (conformement a l'architecture : `Frontend Architecture > Routing`)
- **Router** : React Router v7 — installer `react-router` (v7 est le package unique, pas `react-router-dom` separement)
- **Layout** : le composant `Layout.tsx` dans `src/components/common/` wrap les pages publiques
- **Pas de backend requis** pour cette story — c'est une page de contenu statique
- **Pas d'appel API** — toutes les donnees (dates, format, reglement) sont hardcodees dans le frontend
- **Pas de WebSocket** — pas encore necessaire a ce stade

### Contenu du tournoi a afficher

Le contenu est base sur le PRD et le contexte projet :

```
Tournoi TFT — Esport des Sacres
Set 17 — Saison 2026

Dates :
- Journee 1 : Dimanche 17 mai 2026
- Journee 2 : Dimanche 24 mai 2026
- Journee 3 : Dimanche 31 mai 2026
- Finale : a confirmer

Format :
- Qualifications : 3 journees x 6 rounds max
- Systeme suisse (lobbies de 8, redistribution par classement)
- Finale : top 8 en lobby unique, rounds illimites

Condition de victoire (finale) :
- Terminer 1er d'un round AVEC >= 20 points cumules

Bareme de points :
- 1er = 8 pts, 2e = 7 pts, 3e = 6 pts, 4e = 5 pts
- 5e = 4 pts, 6e = 3 pts, 7e = 2 pts, 8e = 1 pt

Cash prize : [a definir par l'orga — utiliser un placeholder]
```

### Configuration Tailwind v4 — rappel critique

La story 1.1 a installe **Tailwind CSS v4** avec configuration CSS-first. Les classes personnalisees sont definies via `@theme` dans `frontend/src/index.css`, PAS dans un fichier `tailwind.config.ts` :

```css
@import "tailwindcss";

@theme {
  --color-eds-dark: #29265B;
  --color-eds-cyan: #80E2ED;
  --color-eds-gray: #787C86;
  --color-eds-light: #EDEFFD;
  --color-eds-gold: #DAB265;
  --color-eds-white: #FFFFFF;

  --font-heading: 'Bebas Neue', sans-serif;
  --font-body: 'Roboto', sans-serif;
}
```

Classes disponibles : `bg-eds-dark`, `text-eds-cyan`, `text-eds-gold`, `bg-eds-light`, `text-eds-gray`, `font-heading`, `font-body`.

### UX Design Requirements (obligatoires)

- **UX-DR1** : Dark mode par defaut — fond `bg-eds-dark`, deja configure
- **UX-DR2** : Hero section — titre en Bebas Neue Bold, infos essentielles visibles immediatement
- **UX-DR13** : Responsive — priorite desktop, mobile supporte pour pages publiques
- **UX-DR15** : Couleurs d'accent (cyan, or) pour guider l'oeil sur les elements importants
- **UX-DR16** : Reglement accessible — accordeon ou lien sur la page de presentation

### Anti-patterns a eviter

- NE PAS installer de librairie UI (shadcn, MUI, Chakra) — Tailwind natif suffit
- NE PAS installer de librairie d'accordeon — utiliser `<details>/<summary>` natif ou un composant React simple avec `useState`
- NE PAS creer de fichier CSS supplementaire — utiliser Tailwind classes uniquement
- NE PAS toucher a `tailwind.config.ts` — Tailwind v4 utilise `@theme` dans `index.css`
- NE PAS ajouter de dependance `react-router-dom` separement — `react-router` v7 inclut tout
- NE PAS modifier le schema Prisma ou le backend
- NE PAS utiliser `any` en TypeScript

### Previous Story Intelligence (Story 1.1)

**Etat actuel du frontend :**
- `App.tsx` contient un composant demo du design system (a remplacer par le router)
- `index.css` contient la config Tailwind v4 avec `@theme` (NE PAS modifier)
- `main.tsx` est le point d'entree React standard
- `index.html` charge deja Google Fonts (Bebas Neue + Roboto)
- Les dossiers `pages/`, `components/`, `hooks/`, `contexts/`, `services/`, `types/` existent avec des `.gitkeep`

**Decisions techniques de la Story 1.1 a respecter :**
- Tailwind v4 avec `@tailwindcss/vite` (pas PostCSS + Autoprefixer)
- Express 5 cote backend
- Prisma 7 avec client genere dans `src/generated/prisma`
- Socket.IO (pas `ws` natif) pour le temps reel (future story)

**Fichiers qui seront modifies :**
- `frontend/src/App.tsx` — remplacer le demo par le router
- `frontend/package.json` — ajout react-router

**Fichiers qui seront crees :**
- `frontend/src/pages/Home.tsx`
- `frontend/src/components/common/Layout.tsx`

### Project Structure Notes

- Les fichiers de cette story sont exclusivement dans `frontend/`
- `pages/Home.tsx` est la premiere vraie page — elle remplace le composant demo de `App.tsx`
- `components/common/Layout.tsx` est le premier composant commun — il sera reutilise par toutes les pages publiques
- Le composant accordeon pour le reglement peut etre inline dans `Home.tsx` ou extrait dans `components/common/Accordion.tsx` si reutilisable

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules]
- [Source: _bmad-output/planning-artifacts/prd.md#FR25 - Page presentation tournoi]
- [Source: docs/UX-DESIGN.md#Page 1 — Presentation + Inscription]
- [Source: _bmad-output/implementation-artifacts/1-1-init-projet-design-system-eds.md#Completion Notes]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

Aucun probleme rencontre durant l'implementation.

### Completion Notes List

- **Task 1** : React Router v7 installe (`react-router` package unique). `App.tsx` reconfigure avec `BrowserRouter` et `Routes`. Routes futures preparees en commentaire.
- **Task 2** : Page `Home.tsx` creee avec hero section complete — titre Bebas Neue, sous-titre, set/saison, grille 3 colonnes (Dates, Format, Cash Prize) avec cartes stylisees cyan/gold.
- **Task 3** : Section reglement implementee avec composant accordeon React natif (`useState`). 6 sections : format, bareme (grille visuelle), systeme suisse, victoire finale, drops, nombre de rounds.
- **Task 4** : Responsive mobile-first integre : `text-4xl`→`text-6xl`→`text-8xl`, grille 1→3 colonnes, bareme 4→8 colonnes. Pas de scroll horizontal.
- **Task 5** : Layout commun avec header (logo + nav Accueil/Qualifications/Finale) et footer (copyright + lien mentions legales). Nav links futurs desactives (grises).
- **Task 6** : Build OK (1.33s), lint 0 erreur, dev server OK (620ms). Bundle 238KB (76KB gzip). Aucune dependance lourde.

### Change Log

- 2026-04-15 : Implementation complete de la Story 1.2 — page de presentation du tournoi avec hero, infos essentielles, reglement accordeon, layout commun, responsive
- 2026-04-15 : Addressed code review findings — 1 patch resolved (accessibilite AccordionItem: aria-expanded, aria-controls, role region), 1 deferred (mobile nav hamburger)

### File List

- `frontend/package.json` — modifie (ajout dependance react-router)
- `frontend/src/App.tsx` — modifie (remplace demo par BrowserRouter + routes)
- `frontend/src/pages/Home.tsx` — cree (page d'accueil avec hero + reglement)
- `frontend/src/components/common/Layout.tsx` — cree (header + footer commun)

### Review Findings

- [x] [Review][Patch] Amélioration de l'accessibilité sur AccordionItem (attribut aria-expanded et aria-controls) [frontend/src/pages/Home.tsx:60]
- [x] [Review][Defer] Mobile Nav Menu potentiellement à l'étroit sur très petits écrans, envisager un menu hamburger plus tard [frontend/src/components/common/Layout.tsx:20] — deferred, pré-existant/optimisation future
