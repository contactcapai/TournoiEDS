# Story 1.4 : Mentions Legales RGPD

Status: done

## Story

As a **visiteur**,
I want **consulter les mentions legales et la politique de confidentialite du site**,
So that **je sais comment mes donnees personnelles sont traitees, conformement au RGPD**.

## Acceptance Criteria

1. **Given** je suis sur n'importe quelle page du site **When** je cherche les mentions legales **Then** un lien vers les mentions legales est visible dans le footer du site

2. **Given** je clique sur le lien des mentions legales **When** la page s'affiche **Then** les mentions legales incluent : identite du responsable de traitement (EDS), finalite de la collecte (gestion du tournoi), donnees collectees (pseudo Discord, pseudo Riot, email), duree de conservation, droits des joueurs (acces, rectification, suppression)

3. **Given** je consulte les mentions legales sur mobile **When** la page se charge **Then** le contenu est lisible et correctement formate

## Tasks / Subtasks

- [x] Task 1 : Creer la page MentionsLegales (AC: #2, #3)
  - [x] 1.1 Creer `frontend/src/pages/MentionsLegales.tsx`
  - [x] 1.2 Structurer le contenu en sections : identite du responsable, finalite, donnees collectees, duree de conservation, droits des joueurs, contact
  - [x] 1.3 Appliquer le style charte EDS (titres en `font-heading text-eds-cyan`, corps en `font-body text-eds-light`, fond `bg-eds-dark`)
  - [x] 1.4 S'assurer que le contenu est lisible sur mobile (responsive)

- [x] Task 2 : Enregistrer la route dans App.tsx (AC: #1)
  - [x] 2.1 Importer `MentionsLegales` dans `frontend/src/App.tsx`
  - [x] 2.2 Decommenter et activer la route `/mentions-legales` wrappee dans `<Layout>`

- [x] Task 3 : Verifier le lien footer existant (AC: #1)
  - [x] 3.1 Confirmer que le `<Link to="/mentions-legales">` dans `Layout.tsx` (ligne 56-60) fonctionne correctement avec la nouvelle route
  - [x] 3.2 NE PAS modifier `Layout.tsx` — le lien est deja en place

- [x] Task 4 : Validation (AC: #1, #2, #3)
  - [x] 4.1 Verifier que `npm run build` passe sans erreur
  - [x] 4.2 Tester la navigation : clic sur "Mentions legales" dans le footer → page affichee
  - [x] 4.3 Verifier le responsive mobile (texte lisible, pas de scroll horizontal)

## Dev Notes

### Architecture & Patterns a suivre

- **Route** : `/mentions-legales` — route publique wrappee dans `<Layout>`, conformement au commentaire dans `App.tsx` ligne 22
- **Pattern page** : meme structure que `Home.tsx` — composant fonctionnel exportant du JSX avec classes Tailwind
- **Pas de backend** : cette story est 100% frontend — page statique, aucun appel API
- **Pas de nouvelle dependance** : aucune lib a installer

### Etat actuel du code (ce qui existe deja)

**Footer avec lien vers mentions legales :**
Le fichier `frontend/src/components/common/Layout.tsx` (lignes 56-60) contient deja le lien :
```tsx
<Link
  to="/mentions-legales"
  className="mt-1 inline-block font-body text-xs text-eds-gray/60 hover:text-eds-cyan transition-colors"
>
  Mentions legales
</Link>
```
Ce lien pointe vers `/mentions-legales` mais la route et la page n'existent pas encore. **NE PAS modifier Layout.tsx.**

**Route commentee dans App.tsx :**
La route est deja prevue en commentaire (ligne 22) :
```tsx
{/* <Route path="/mentions-legales" element={<Layout><MentionsLegales /></Layout>} /> */}
```
Il suffit de decommenter cette ligne et d'ajouter l'import du composant.

**App.tsx — pattern d'import et de route :**
```tsx
import { BrowserRouter, Routes, Route } from 'react-router';
import Layout from './components/common/Layout';
import Home from './pages/Home';
// Ajouter : import MentionsLegales from './pages/MentionsLegales';
```

### Contenu des mentions legales (texte a utiliser)

Le contenu doit couvrir les exigences du RGPD pour un site collectant pseudo Discord, pseudo Riot et email. Voici la structure et le contenu a utiliser :

**1. Identite du responsable de traitement**
- Association : Esport des Sacres (EDS)
- Siege : Reims, France
- Contact : contact@esportdessacres.fr (ou email de contact EDS)

**2. Finalite de la collecte**
- Les donnees sont collectees dans le cadre de l'organisation du tournoi TFT Esport des Sacres
- Les pseudos Discord et Riot sont necessaires pour identifier les joueurs dans le tournoi
- L'email est utilise pour communiquer des informations relatives au tournoi

**3. Donnees collectees**
- Pseudo Discord
- Pseudo Riot
- Adresse email

**4. Base legale**
- Consentement du joueur lors de l'inscription volontaire au tournoi

**5. Duree de conservation**
- Les donnees sont conservees pour la duree du tournoi et supprimees dans un delai raisonnable apres la fin de l'edition (maximum 6 mois)

**6. Droits des joueurs (RGPD articles 15-21)**
- Droit d'acces : obtenir une copie de ses donnees
- Droit de rectification : corriger ses donnees
- Droit de suppression : demander la suppression de ses donnees
- Pour exercer ces droits : contacter l'association par email

**7. Hebergement**
- Frontend : Hostinger (hebergeur web)
- Backend et base de donnees : VPS en France

**8. Cookies**
- Le site n'utilise pas de cookies de tracking ou publicitaires
- Seuls des cookies techniques necessaires au fonctionnement sont utilises (le cas echeant)

### Tailwind v4 — classes disponibles

Les classes personnalisees EDS sont definies via `@theme` dans `frontend/src/index.css` :
- Fond : `bg-eds-dark`
- Titres : `font-heading text-eds-cyan` ou `text-eds-gold`
- Corps : `font-body text-eds-light`
- Texte secondaire : `text-eds-gray`
- Accents : `text-eds-cyan`, `text-eds-gold`

NE PAS modifier `index.css`. NE PAS creer de fichier `tailwind.config.ts`.

### Structure de la page (guide visuel)

```tsx
// frontend/src/pages/MentionsLegales.tsx
export default function MentionsLegales() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-heading text-3xl text-eds-cyan mb-8">
        MENTIONS LEGALES & POLITIQUE DE CONFIDENTIALITE
      </h1>
      {/* Sections avec h2 en font-heading text-eds-gold, paragraphes en font-body text-eds-light */}
      {/* Section 1 : Responsable de traitement */}
      {/* Section 2 : Finalite de la collecte */}
      {/* Section 3 : Donnees collectees */}
      {/* Section 4 : Base legale */}
      {/* Section 5 : Duree de conservation */}
      {/* Section 6 : Droits des joueurs */}
      {/* Section 7 : Hebergement */}
      {/* Section 8 : Cookies */}
    </main>
  );
}
```

### UX Design Requirements

- **UX-DR1** : Dark mode par defaut — fond `bg-eds-dark`
- **UX-DR13** : Responsive — le contenu doit etre lisible sur mobile
- **UX-DR12** : Charte EDS — typographies Bebas Neue (titres) + Roboto (corps), palette EDS

### Anti-patterns a eviter

- NE PAS creer de composant complexe — c'est une page statique avec du texte
- NE PAS installer de librairie (react-markdown, etc.) — du JSX brut suffit
- NE PAS modifier `Layout.tsx` — le lien footer existe deja
- NE PAS modifier `index.css` — les classes EDS sont deja configurees
- NE PAS ajouter de route backend — cette story est 100% frontend
- NE PAS creer de fichier de traduction / i18n — contenu en francais directement dans le JSX
- NE PAS copier le style exact de Home.tsx pour les sections — cette page est du texte continu, pas des sections hero/cards

### Previous Story Intelligence (Story 1.3)

**Decisions techniques confirmees :**
- Tailwind v4 avec `@tailwindcss/vite` — classes EDS disponibles via `@theme`
- React Router v7 avec import depuis `'react-router'` (pas `'react-router-dom'`)
- Express 5 cote backend, Prisma 7
- Pattern de page : composant fonctionnel export default, pas de CSS supplementaire

**Correctifs appliques dans story 1.3 (lecons) :**
- Fallback API URL doit pointer vers le port 3001 (`http://localhost:3001`)
- Gestion d'erreurs globales : utiliser un state dedie plutot que d'assigner au premier champ

**Fichiers existants crees par stories precedentes :**
- `frontend/src/pages/Home.tsx` — page d'accueil avec hero + inscription + reglement
- `frontend/src/components/common/Layout.tsx` — layout avec header, nav et footer
- `frontend/src/components/inscription/InscriptionForm.tsx` — formulaire d'inscription
- `frontend/src/services/api.ts` — service API (fetch natif)
- `frontend/src/types/index.ts` — types TypeScript partages
- `frontend/src/App.tsx` — routes React Router v7
- `frontend/src/index.css` — config Tailwind v4 avec @theme EDS

### Project Structure Notes

- La page `MentionsLegales.tsx` va dans `frontend/src/pages/` — conformement a la convention du projet [Source: architecture.md#Structure Patterns > Frontend]
- Le nom du fichier est en PascalCase : `MentionsLegales.tsx` [Source: architecture.md#Naming Patterns]
- Aucun nouveau dossier a creer

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4 - Mentions Legales RGPD]
- [Source: _bmad-output/planning-artifacts/prd.md#FR38 - Mentions legales RGPD]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR9 - Mentions legales RGPD affichees]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns]
- [Source: docs/UX-DESIGN.md#Charte graphique]
- [Source: frontend/src/components/common/Layout.tsx#Footer - lien mentions legales existant]
- [Source: frontend/src/App.tsx#Route commentee mentions-legales]
- [Source: _bmad-output/implementation-artifacts/1-3-inscription-des-joueurs.md#Completion Notes]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

Aucun probleme rencontre.

### Completion Notes List

- Task 1 : Page `MentionsLegales.tsx` creee avec 8 sections RGPD completes (responsable, finalite, donnees, base legale, duree, droits, hebergement, cookies). Style charte EDS applique (titres `font-heading text-eds-gold`, corps `font-body text-eds-light`, liens `text-eds-cyan`). Layout responsive avec `max-w-4xl px-4`.
- Task 2 : Import de `MentionsLegales` ajoute dans `App.tsx`. Route `/mentions-legales` activee et wrappee dans `<Layout>`. Commentaire de la route supprime du bloc "Routes futures".
- Task 3 : Lien footer dans `Layout.tsx` (lignes 56-60) confirme fonctionnel — `<Link to="/mentions-legales">` pointe vers la route active. Layout.tsx non modifie.
- Task 4 : `npm run build` passe sans erreur (tsc + vite build). Serveur dev lance pour verification visuelle.

### Change Log

- 2026-04-16 : Implementation complete de la story 1.4 — page mentions legales RGPD creee, route activee, build valide
- 2026-04-16 : Patch code review applique — titre H1 responsive corrige (break-words + text-2xl/sm:text-3xl)

### File List

- `frontend/src/pages/MentionsLegales.tsx` (nouveau)
- `frontend/src/App.tsx` (modifie — import + route)

### Review Findings

- [x] [Review][Patch] Responsive: risque de débordement du H1 sur mobile (mot long) [frontend/src/pages/MentionsLegales.tsx:L5] — corrige: text-2xl mobile + sm:text-3xl + break-words
- [x] [Review][Defer] Sécurité: adresse email en clair sans protection anti-spam [frontend/src/pages/MentionsLegales.tsx:L19] — deferred, pre-existing
