# Portes visuelles

**Trois portes, et elles sont INDICATIVES.** Une porte rouge ouvre une question, elle n'arrête
pas une story. Le parc est gelé : on n'en ajoute pas.

> Le 2026-08-15, 17 portes (11 500 lignes) ont été supprimées. C'étaient des tests déguisés en
> programmes : elles coûtaient plus cher à maintenir et à débugger que les défauts qu'elles
> trouvaient, et elles se sont révélées fausses plus souvent que le code qu'elles mesuraient.
> Ce qui méritait de survivre est devenu des tests `node:test` dans `src/lib/*.test.ts`.

## Utilisation

```bash
GATE_BASE=https://staging.esportdessacres.fr pnpm --filter vitrine gate
GATE_BASE=https://staging.esportdessacres.fr pnpm --filter vitrine gate:links
GATE_BASE=https://staging.esportdessacres.fr pnpm --filter vitrine gate:admin
```

`GATE_BASE` vise l'hôte réel. On ne lance plus de serveur local depuis le 2026-08-13 : les
défauts qui comptent (SSO hors `localhost`, permissions du volume médias) sont **invisibles en
local**, portes vertes.

## Ce que chacune couvre

| Porte | Objet |
|---|---|
| **`gate`** | Débordement horizontal, header sticky, débordement de texte — toutes les pages publiques × 7 largeurs |
| **`gate:links`** | Clique et déplace le focus **pour de vrai** ; compare la position de la page |
| **`gate:admin`** | Les routes `/admin` refusent bien un visiteur non authentifié |

## Pourquoi `gate` mérite de survivre

`globals.css` pose `overflow-x: clip`. Un bloc qui déborde est donc **rogné en silence** : pas
de scrollbar, pas d'erreur, rien à l'écran. C'est le seul défaut de ce projet qui soit
invisible **par construction**, pour l'œil comme pour le typecheck.

⚠️ Ne jamais mesurer ce débordement par `documentElement.scrollWidth === clientWidth` : `clip`
empêche la zone défilable de croître, donc le témoin reste égal même quand un bloc déborde
(prouvé : bloc de 3000 px dans un viewport de 800 px → 800/800). La mesure correcte est un
balayage **par élément**, ce que fait `gate.mjs`.

⚠️ Ne jamais repasser `clip` à `hidden` : `body` redeviendrait un conteneur de défilement, et
le header cesserait d'être sticky.

⚠️ Ajouter toute nouvelle page publique à `GATE_PAGES` dans `config.mjs` — une page absente
n'est couverte par rien, en silence.

## Fichiers

`gate.mjs` · `links-check.mjs` · `admin-check.mjs` — les trois portes.
`cdp.mjs` (pilotage Chrome) · `config.mjs` (pages et largeurs) · `probe.mjs` (sondes injectées)
· `measure.mjs` et `shoot.mjs` (outils d'appoint, hors porte).
