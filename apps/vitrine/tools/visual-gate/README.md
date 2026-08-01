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

Trois gardes, sur **5 pages × 7 largeurs** — soit **105 contrôles** (compte à jour au
2026-08-01 ; il ne bouge QUE si une page publique est ajoutée à `config.mjs`) :

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

## Les portes comportementales

Une porte par surface dont le défaut ne se voit **ni au build, ni à l'œil** :

```bash
pnpm --filter vitrine gate:carousel      # carrousel des temps forts (3.3)
pnpm --filter vitrine gate:marquee       # bandeau de logos (4.1)
pnpm --filter vitrine gate:lightbox      # galerie scrapbook (4.3)
pnpm --filter vitrine gate:images        # toutes les images servies répondent (4.3)
pnpm --filter vitrine gate:solicitation  # formulaire + modale (5.1) — ⚠️ écrit en base, et nettoie
pnpm --filter vitrine gate:links         # tous les liens du site (5.5)
```

🔴 **`gate:links` mesure des EFFETS, pas des attributs** — c'est ce qui la distingue.
Le défaut R2 EST un défilement : le lire dans le DOM ne le mesure pas. Elle **clique
vraiment**, **déplace vraiment le pointeur**, **déplace vraiment le focus**, et compare
la position de la page avant/après. Six gardes : ① aucune ancre morte (`#content` en
liste blanche) · ② tout lien sortant est sûr, annoncé **et** visiblement signalé ·
③ un élément sans destination ne fait pas bouger la page au clic · ④ il n'est pas dans
le fil de focus (panneau mobile **ouvert** compris) · ⑤ il n'annonce pas « nouvel
onglet » · ⑥ il ne réagit pas au survol.
⚠️ Elle **DÉCLARE ses exemptions** en sortie (tuiles du mur partenaires) : une porte
verte ne doit jamais se lire « tout est couvert ».

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
  identiques bit pour bit** ont prouvé le refactor au sens littéral ; en Story 5.5,
  **15/15** sur 5 pages.
  ⚠️ **Ses pages venaient d'une liste EN DUR** jusqu'à la Story 5.5 — l'état du site à la
  2.10. Il n'avait jamais suivi `/agenda` ni `/partenaires`, donc il prouvait
  « invisible » sur 3 pages et **rien du tout sur les 2 autres, en silence**. Il lit
  désormais `config.mjs`, comme toutes les autres portes.

## 🔴 Avant de croire un « 0 écart »

`00 référence/pieges/instrument-non-valide.md` — un instrument de mesure est **du code
non testé promu au rang d'autorité**. Celui-ci a été **faux trois fois** avant de servir
(prédicats trop larges, compteur non déterministe, bruit d'animation).

**Deux réflexes :**

```bash
pnpm --filter vitrine gate:selftest                     # ⇐ les 3 détecteurs voient-ils encore un défaut ?
LINKS_DEBRANCHER_PIEGE=1 pnpm --filter vitrine gate:links   # ⇐ contre-épreuve de la porte des liens
```

🔴 **Le compte est passé à HUIT au moment de la Story 5.5** (« faux trois fois » ci-dessus
date de la 2.10). Deux occurrences récentes valent d'être connues, parce que dans les deux
cas **l'instrument ACCUSAIT LE PRODUIT** : `gate:solicitation` rapportait « Échap ne ferme
pas la modale » alors qu'aucune touche n'était envoyée (5.1), et la mesure d'apparition de
la 5.4 rapportait un bloc figé parce qu'elle relevait **en plein vol** sous
`scroll-behavior: smooth`. La 5.5 en a ajouté deux autres : `gate:links` rapportait
« le panneau mobile ne s'ouvre pas » **avant l'hydratation de React**, et sa garde
d'indication visible acceptait **n'importe quel svg décoratif** — donc la flèche de
maquette du CTA tournoi, ce qui la rendait **verte sur un vrai défaut R12**.

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

`PAGES` (dans `config.mjs`, surchargeable par `GATE_PAGES`) liste les pages couvertes.
Au 2026-08-01 : `/`, `/agenda`, `/partenaires`, `/l-asso`, `/animations` — les 5 pages
publiques du site. **Toute nouvelle page publique doit y être ajoutée** : une page absente
n'est couverte par aucune de ces portes, **en silence**.

🔴 **Le témoin de l'ajout est le COMPTE, et il s'inverse d'une story à l'autre** : il doit
AUGMENTER quand une page est ajoutée (84 → 105 en Story 4.2) et RESTER INCHANGÉ quand la
story n'en ajoute pas (105 en 4.3, 5.4, 5.5). Le déclarer **avant** de mesurer — un compte
inchangé après un ajout signale une erreur de configuration, pas un succès.

```bash
GATE_PAGES="/,/l-asso" pnpm --filter vitrine gate   # sous-ensemble, pour itérer vite
```
