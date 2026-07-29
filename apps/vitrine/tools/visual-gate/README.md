# `visual-gate` — les portes que lint, typecheck, build et Lighthouse ne franchissent pas

> Posé à la **rétro de l'Epic 2** (2026-07-29), action A5. Cet outillage a été écrit au
> fil des Stories 2.8 et 2.10 dans un répertoire temporaire — il a trouvé **3 des
> 7 défauts** de l'inventaire ci-dessous, puis il allait disparaître avec la session.
> Une porte qui n'existe que le jour où on l'écrit ne protège que ce jour-là.

## Pourquoi ça existe

L'Epic 2 s'est terminé avec un constat chiffré : **sept défauts réels ont coexisté avec
CI verte et Lighthouse 100/100**.

| Défaut | Latence | Ce que les portes disaient |
|---|---|---|
| Header `sticky` qui ne colle pas | **9 stories** | CI verte, Lighthouse 100/100 |
| Cible tactile 26px pour une convention à 44 | 8 stories | `target-size` **passe** (la norme n'exige que 24) |
| Bordure 2,61:1 pour un seuil de 3:1 | 5 stories | aucun audit ne teste le contraste non textuel |
| Faux-gras synthétisé | 9 stories | aucun audit concerné |
| Bloc figé **invisible** en bas de page | — | texte présent dans le DOM, a11y 100/100 |
| Débordement horizontal rogné **en silence** | ouvert | aucun audit de largeur au périmètre retenu |
| Classe CSS inexistante → `undefined` | — | **lint, typecheck ET build verts** |

Le point commun n'est pas la négligence, c'est la **catégorie** : nos portes testent la
**compilation** et une **conformité normative**. Aucune ne teste le **rendu** ni le
**comportement**. C'est exactement là que vivent ces défauts.

Détail : `00 référence/pieges/dette-invisible.md`.

## La porte

```bash
pnpm --filter vitrine build
pnpm --filter vitrine start          # dans un autre terminal
pnpm --filter vitrine gate           # ⇐ sort en code 1 si une garde tombe
```

Trois gardes, sur **3 pages × 7 largeurs** :

1. **Débordement horizontal** (dette R14) — **balayage par élément** : chaque boîte
   contre le viewport (décoratifs `aria-hidden` exclus, tolérance 2px).
   🔴 **Surtout PAS `scrollWidth === clientWidth`** : `overflow-x: clip` empêche la
   zone défilable de croître, donc ce témoin est **structurellement aveugle** — un
   bloc de 3000px dans un viewport de 800px lui renvoie 800/800 (prouvé par
   `gate:selftest`). Deux stories ont rapporté « 21/21 ✅ » sur cette base : un vert
   qui ne mesurait rien.
2. **Header sticky** (dette R19) — on **défile**, puis on relève la position réelle.
   `position: sticky` présent dans le CSS ne prouve rien.
3. **Classes fantômes** — aucun `class` ne doit contenir le littéral `undefined`.

⚠️ **À exécuter sur le build de PRODUCTION**, pas sur `next dev`.

## Les instruments (relevés, pas verdicts)

```bash
node tools/visual-gate/measure.mjs  <baseUrl> avant.json   # instantané complet
node tools/visual-gate/compare.mjs  avant.json apres.json  # comparaison stricte
node tools/visual-gate/shoot.mjs    <baseUrl> captures/    # captures pleine page
```

- **`measure.mjs`** — relève conteneurs centraux, titres (graisse), liens fléchés,
  boutons outline, texte du `<main>`, débordement, header sticky, classes fantômes,
  nœuds par sous-arbre.
- **`compare.mjs`** — comparaison **stricte** de deux instantanés. C'est l'outil d'un
  refactor censé être invisible : en Story 2.10, **0 écart sur 21 combinaisons**.
- **`shoot.mjs`** — captures pleine page. La géométrie **ne voit pas les couleurs** :
  une perte de `background` seule passerait `compare.mjs`. En Story 2.10, **9 captures
  identiques bit pour bit** ont prouvé le refactor au sens littéral.

## 🔴 Avant de croire un « 0 écart »

`00 référence/pieges/instrument-non-valide.md` — un instrument de mesure est **du code
non testé promu au rang d'autorité**. Celui-ci a été **faux trois fois** avant de servir
(prédicats trop larges, compteur non déterministe, bruit d'animation).

**Deux réflexes :**

```bash
pnpm --filter vitrine gate:selftest   # ⇐ les 3 détecteurs voient-ils encore un défaut ?
```

- **`gate:selftest`** confronte les détecteurs à une page synthétique qui porte les trois
  défauts. Il ne dépend d'aucun serveur. **C'est lui qui a démontré, le jour de son
  écriture, que le détecteur de débordement était aveugle.** À rejouer après toute
  modification de `probe.mjs`.
- Pour un refactor censé être invisible : exécuter `measure.mjs` **deux fois sur un code
  inchangé** et exiger `compare.mjs` → 0 écart. C'est ce run-là qui autorise à lire un
  « 0 écart » ultérieur comme une preuve.

## Conventions internes

- **Zéro dépendance** : CDP pur, `WebSocket` natif de Node 22. Rien dans le lockfile.
  Chrome est celui de la machine (`CHROME_PATH` pour le surcharger).
- Les éléments sont identifiés par **chemin DOM** (indices d'enfants) et par **invariant**
  (`max-width: 1160px`), **jamais** par nom de classe compilé — le hash change à chaque
  édition du fichier source.
- Les classes CSS Modules compilées portent le **nom de leur fichier** :
  `Wrap-module__FrvmEW__wrap` → on matche `Wrap:wrap`, jamais la chaîne entière.
- **Mouvement réduit émulé** partout : sinon une animation d'entrée encore en vol rend
  la mesure non déterministe.

## ⚠️ À faire évoluer avec le site

`GATE_PAGES` liste les pages couvertes (défaut : `/`, `/l-asso`, `/animations`).
**Toute nouvelle page publique doit y être ajoutée** — une page absente de cette liste
n'est couverte par aucune de ces portes, **en silence**. Les Epics 3 à 5 en ajoutent au
moins trois (`/agenda`, `/partenaires`, et la passerelle tournoi).

```bash
GATE_PAGES="/,/l-asso,/animations,/agenda" pnpm --filter vitrine gate
```
