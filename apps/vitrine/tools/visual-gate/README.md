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

**Quatre** gardes, sur **5 pages × 7 largeurs** — soit **140 contrôles** (compte à jour au
2026-08-05 ; il ne bouge que si une page publique est ajoutée à `config.mjs` **ou** si une
garde s'ajoute) :

> 🔴 **CE BLOC A ÉTÉ PÉRIMÉ PENDANT UNE STORY, ET CLAUDE.md DIT QU'IL FAIT FOI.** Il annonçait
> encore « Trois gardes … 105 contrôles » alors que la Story 6.10 avait livré le 4ᵉ contrôle
> et que `gate.mjs` faisait déjà `controles += 4`. Corrigé au cadrage de la **Story 6.11**,
> qui ne pouvait pas déclarer « 140 inchangé » contre un document qui disait 105.
> ⇒ **Le compte se relit ICI et se re-vérifie contre `gate.mjs` à chaque story** — pas de
> mémoire (`00 référence/pieges/cadrage-perime.md`).

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
4. **Débordement de TEXTE dans sa propre boîte** (dette R38, Story 6.10) — `scrollWidth >
   clientWidth` **PAR ÉLÉMENT**, sur les feuilles de texte. La garde ① balaie les BOÎTES,
   or une boîte **ne grandit pas** quand un mot insécable dépasse : c'est le texte qui
   déborde d'elle, et `overflow-x: clip` le rogne en silence. Elle a trouvé un défaut
   **dormant depuis la Story 3.2** (titre d'événement rogné de 7px à 320px sur `/`).

⚠️ **À exécuter sur le build de PRODUCTION**, pas sur `next dev`.

## Les portes comportementales

Une porte par surface dont le défaut ne se voit **ni au build, ni à l'œil** :

```bash
pnpm --filter vitrine gate:carousel      # carrousel des temps forts (3.3)
pnpm --filter vitrine gate:marquee       # bandeau de logos (4.1)
pnpm --filter vitrine gate:lightbox      # galerie scrapbook (4.3)
pnpm --filter vitrine gate:images        # toutes les images servies répondent (4.3)
pnpm --filter vitrine gate:solicitation  # formulaire + modale (5.1) — ⛔ REFUSE de s'exécuter hors boucle locale
pnpm --filter vitrine gate:links         # tous les liens du site (5.5)
pnpm --filter vitrine gate:admin         # frontière de sécurité du back-office (6.1)
pnpm --filter vitrine gate:agenda        # surface de saisie « agenda » (6.3) — ⚠️ écrit en base, en transaction ANNULÉE
pnpm --filter vitrine gate:galerie       # surface « galerie » (6.4) — ⚠️ écrit en base ET SUR LE DISQUE, et nettoie
pnpm --filter vitrine gate:partenaires   # surface « partenaires » (6.5) — ⚠️ écrit en base ET SUR LE DISQUE, et nettoie
pnpm --filter vitrine gate:ateliers      # surface « ateliers » (6.9) — ⚠️ écrit en base, en transaction ANNULÉE
pnpm --filter vitrine gate:membres       # surface « membres » (6.10) — ⚠️ écrit en base ET SUR LE DISQUE, et nettoie
pnpm --filter vitrine gate:sollicitations # surface « sollicitations » (6.11) — ⚠️ écrit en base, et nettoie
pnpm --filter vitrine gate:reglages      # surface « réglages » (6.13) — ⚠️ écrit en base, et RESTAURE
pnpm --filter vitrine gate:reseaux       # déclenchement n8n (6.7) — fabrique son PROPRE faux n8n
pnpm --filter vitrine gate:contrat-env   # contrat des variables d'environnement (7.4)
pnpm --filter vitrine gate:tournois      # surface « tournois » (9.1) — ⚠️ écrit en base, et nettoie
```

> ⚠️ **Cette liste s'arrêtait à `gate:galerie` (6.4) jusqu'au 2026-08-05**, puis à
> `gate:reglages` (6.13) **jusqu'au 2026-08-14** — trois portes de plus manquaient à l'appel
> (`reseaux`, `contrat-env`, `tournois`). **Deuxième désalignement du même tableau**, ce qui
> confirme le diagnostic au lieu de l'infirmer : une liste alignée à la main se désaligne à
> l'ajout suivant. **La relire contre `package.json`**, seule source qui ne peut pas mentir :
> `node -e "console.log(Object.keys(require('./apps/vitrine/package.json').scripts).filter(s=>/^gate/.test(s)))"`

### ⛔ La seule porte qui a un effet SORTANT — et qui le refuse désormais

`gate:solicitation` **soumet le formulaire public pour de vrai**, donc `submitSolicitation`
appelle `notifySolicitation` : **3 e-mails réels par exécution** (garde ③ = 1 envoi valide,
garde ④ = resoumissions jusqu'au rate-limit, `RATE_LIMIT_MAX = 3` / 60 s) vers l'adresse de
contact **lue en base**. Mesuré le **2026-08-14** : **18 e-mails** dans la boîte de
l'association, en 6 exécutions, plus **9 lignes** restées en base — son `finally` nettoie via
`DATABASE_URL` de `.env.local`, qui pointe le Postgres local qu'on ne lance plus.

🔴 **Aucune ligne de code n'a changé le jour où c'est devenu vrai.** En local,
`GMAIL_APP_PASSWORD` est absente ⇒ le transport lève, et l'INSERT est **découplé** de l'envoi
⇒ l'échec était **silencieux**. La règle du 2026-08-13 (« le rendu se regarde sur staging ») a
pointé la même porte vers un hôte au SMTP configuré. ⇒ **Une porte à effet sortant doit
refuser l'environnement qu'elle ne sait pas rendre muet**, sans quoi c'est la configuration
d'exécution qui décide, en silence, si elle est inoffensive.

Elle refuse donc toute cible dont le `hostname` n'est pas la boucle locale (égalité exacte —
un `includes("localhost")` laisserait passer `localhost.attaquant.fr`). Dérogation explicite,
volontairement absente de `package.json` :

```bash
SOLICITATION_AUTORISER_ENVOI_REEL=1 node tools/visual-gate/solicitation-check.mjs <url>
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
ADMIN_AUTOTEST=1 pnpm --filter vitrine gate:admin           # ⇐ contre-épreuve de la porte du back-office
AGENDA_AUTOTEST=1 pnpm --filter vitrine gate:agenda         # ⇐ contre-épreuve de la porte de saisie
GALERIE_AUTOTEST=1 pnpm --filter vitrine gate:galerie       # ⇐ contre-épreuve de la porte de galerie
REGLAGES_AUTOTEST=1 pnpm --filter vitrine gate:reglages     # ⇐ contre-épreuve de la porte des réglages
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

---

## `gate:admin` — la frontière de sécurité du back-office (Story 6.1)

**Onzième instrument.** Elle répond à une question qu'aucune autre porte ne pose : *une
route d'administration est-elle réellement fermée à quelqu'un qui n'est pas connecté ?*

🔴 **Elle parle HTTP nu, sans aucun cookie** — et c'est ce qui la distingue. `gate` et
`gate:links` pilotent un navigateur, donc un contexte qui *pourrait* porter une session et
rendre la mesure fausse sans le dire. Ici, aucune session n'est possible : pas de faux vert.

Sept gardes : ① les routes `/admin/*` redirigent vers le login · ② la garde couvre le
**sous-arbre** et non une liste de routes connues (une route inexistante est éprouvée
exprès) · ③ **aucun contenu d'administration dans le corps servi** · ④ un cookie de session
**forgé** est refusé — la garde valide la session, elle ne teste pas la présence d'un cookie
· ⑤ `/admin/login` répond 200 (sinon le back-office est murré par une boucle de
redirection) · ⑥ `/api/auth/*` n'est pas avalée par le matcher (sinon le flux OAuth ne peut
pas revenir) · ⑦ les 5 pages publiques et `/medias/[filename]` répondent 200 **sans cookie**
(non-régression FR28).

### Ce qu'elle a trouvé, et que rien d'autre n'a vu

**① `/api/auth/csrf` répondait 500.** L'adaptateur Drizzle est construit paresseusement
(le `db` du projet est un Proxy, et le build doit rester sûr sans `DATABASE_URL`). La
première version de ce Proxy n'implémentait que le piège `get` — or Auth.js vérifie la
complétude de l'adaptateur par un test d'**appartenance** (`"createUser" in adapter`), qui
déclenche le piège `has`. Résultat : `MissingAdapterMethods`, tout le flux OAuth mort.
**Lint, typecheck, `next build` et les six autres gardes étaient verts.**

**② Une garde de `layout` n'arrête pas le rendu de la `page` enfant.** Mesuré en
débranchant volontairement le matcher : la réponse était un `307 → /admin/login` en bonne et
due forme, **et son corps portait le tableau de bord entier** sérialisé en charge RSC. Next
rend l'arbre de segments en parallèle. ⇒ chaque page d'administration porte désormais sa
propre garde, et la garde ③ de cette porte existe pour ça.

### Contre-épreuve

`ADMIN_AUTOTEST=1` présente à la porte une route qu'on **sait ouverte** (`/admin/login`)
comme si elle devait être protégée : si les gardes sont réelles, elles échouent. La preuve
plus forte reste manuelle et a été faite à la livraison — débrancher le matcher **et** la
garde de page, puis constater que la porte voit la fuite.

⚠️ **Deux exemptions, imprimées à chaque exécution** : le chemin **authentifié** (il exige un
aller-retour Discord avec un humain devant l'écran de consentement) et l'**apparence** du
shell (gate visuel de Brice — la passe 1 ne s'outille pas). Une porte verte ne veut donc pas
dire « tout est couvert ».

---

## `gate:agenda` — la surface de saisie « agenda » (Story 6.3)

**Douzième instrument**, et le premier qui garde une surface d'**écriture**. Deux moitiés,
parce que les deux risques ne se mesurent pas au même endroit :

| Moitié | Ce qu'elle interroge | Comment |
|---|---|---|
| **A** | ce que le serveur **sert à un inconnu** | HTTP nu, **sans aucun cookie** — 6 routes d'agenda, aucun marqueur d'administration dans le corps, et **aucun événement non publié** dans le HTML des 5 pages publiques |
| **B** | ce que la **base refuse** et ce que les **contrats** garantissent | écritures qui doivent **ÉCHOUER** contre le Postgres de dev, plus `eventInputSchema` et `date-paris.ts` exercés directement |

🔴 **Écrite en TypeScript et exécutée par `tsx`** — comme `gate:galerie` depuis la 6.4, et
contrairement aux onze portes écrites en `.mjs`. Ce n'est
pas une coquetterie : la moitié B doit exercer **les vrais modules**. Une porte qui
réimplémenterait leurs règles en JS validerait sa propre copie et resterait verte le jour
où le produit divergerait — c'est exactement `pieges/garde-nominale.md`.

🔴 **Elle procède par `INSERT`, jamais par `UPDATE`.** Un `UPDATE` sur une table vide
affecte zéro ligne, ne déclenche aucun `CHECK`, et rendrait un **vert qui ne mesure rien**.
Chaque écriture vit dans une transaction **`ROLLBACK`** : rien n'est laissé derrière.

### Ce qu'elle a trouvé, et que rien d'autre n'a vu

🔴 **`event_has_venue` NE TENAIT PAS DEPUIS LA STORY 3.1.** Écrite
`bar_id is not null or length(btrim(venue_name)) > 0`, elle s'évaluait à `FALSE OR NULL`
→ **`NULL`** quand les deux colonnes étaient nulles — c'est-à-dire dans le cas **exact**
qu'elle existait pour interdire. Or **un `CHECK` qui vaut `NULL` PASSE** (logique ternaire
SQL : il n'échoue que sur `FALSE`). Mesuré :
`INSERT INTO event (title, starts_at) VALUES ('…', now())` était **accepté**.

Trois epics, sept portes vertes, et personne ne l'a vu — parce que Zod l'attrapait au
point de saisie et que le rendu masque proprement une ligne sans lieu. C'est précisément
ce que la doctrine de `schema.ts` dit de ne **pas** supposer : un `UPDATE` direct, une
restauration de sauvegarde ou une migration de données ne passent par aucun Zod.
Corrigé par `coalesce(…, 0)` (migration `0007`) et **re-mesuré**.

⇒ **Réflexe transposable : tout `CHECK` qui combine deux colonnes NULLABLES doit être rendu
explicitement null-safe.** Les autres contraintes du schéma ont été vérifiées une par une —
elles n'ont pas ce défaut, soit parce que leur colonne est `notNull`, soit parce qu'elles
portent une branche `is null` explicite.

### Contre-épreuve

`AGENDA_AUTOTEST=1` présente **à chaque garde** un cas qu'elle doit voir : une route
ouverte donnée pour protégée, une écriture valide donnée pour devant échouer, un
aller-retour de date comparé à une valeur fausse, une heure pathologique donnée pour
normale. Si la porte reste verte, elle ne mesure rien.

⚠️ **Trois exemptions, imprimées à chaque exécution** (elles étaient quatre : celle du rendu
**« déjà passé »** est partie avec la dette **R34**, soldée par la Story 6.4, **dans le même
commit que le correctif** — leçon R33 ②). Une porte verte ne veut donc pas dire « tout est
couvert ».

---

## `gate:galerie` — la surface « galerie » (Story 6.4)

**Treizième instrument**, et le premier qui garde une surface qui **écrit sur un disque**.
Toutes les autres portes mesurent une réponse ou une valeur ; celle-ci mesure en plus un
**effet de bord sur le système de fichiers**.

```bash
pnpm --filter vitrine gate:galerie
```

Deux moitiés, parce que les deux risques ne se mesurent pas au même endroit :

- **A — HTTP nu, sans aucun cookie** : les quatre routes de galerie redirigent, et le HTML
  **servi** ne contient aucun marqueur d'administration ;
- **B — écritures qui doivent ÉCHOUER**, contre la base **et le volume réels** : SVG,
  fichier au contenu illisible, format hors liste, `alt` invisible / trop court / trop long,
  légende de 61 caractères, noms interdits par le `CHECK` (dont `axjpg`, le piège
  d'échappement à deux étages).

🔴 **LA GARDE PROPRE À CETTE PORTE EST LE DÉCOMPTE DES FICHIERS DU VOLUME.** « Une écriture
refusée ne laisse aucun octet » ne se lit dans **aucune** réponse HTTP : il faut compter les
fichiers avant, et recompter après. La porte écrit aussi une image nominale (pour prouver
qu'elle n'est pas verte en refusant tout), vérifie que le nom généré satisfait la liste
blanche, puis **nettoie derrière elle et le vérifie**.

⚠️ Elle s'exécute avec **`--conditions=react-server`**, et sans ce drapeau elle **ne démarre
pas** : `src/server/medias/` commence par `import "server-only"`, un paquet qui **lève** hors
du graphe serveur de React. L'issue facile aurait été de recopier la logique d'`ecrireMedia`
dans la porte — elle aurait alors validé **sa propre copie** (`pieges/garde-nominale.md`).

### Trois défauts d'INSTRUMENT trouvés en la prouvant rouge

1. **`MEDIA_DIR` n'était pas dans l'environnement de la porte** (elle n'est pas Next, personne
   n'y charge `.env.local`) ⇒ `ecrireMedia` refusait **tout**, y compris le cas nominal ;
2. **la garde « brouillon non servi » était un FAUX VERT** : la seule photo non publiée de la
   base de dev n'a **pas de fichier** sur le volume, donc le 404 obtenu ne prouvait rien du
   filtre `is_published`. La porte **pose le fichier témoin** avant de mesurer, et le retire ;
3. 🔴 **la garde de la route média d'admin ACCUSAIT LE PRODUIT** — 3ᵉ occurrence de cette
   famille sur le projet. Elle exigeait un `404` et rapportait « un octet d'image a été servi
   sans session » sur un **307**. Faux deux fois : le proxy redirige **avant** que la route ne
   s'exécute, et une redirection vers la connexion est un refus correct. La garde porte
   désormais sur ce qui compte — **qu'aucun octet d'image ne sorte** — et accepte les deux refus.

### Contre-épreuve

`GALERIE_AUTOTEST=1` présente à chaque garde un cas qu'elle doit voir : une route ouverte
donnée pour protégée, un AVIF valide donné pour devant échouer, une ligne valide donnée pour
devant être refusée par la base, une description correcte donnée pour invisible.

🔴 **Et elle a été prouvée ROUGE sur un défaut RÉEL, pas seulement en autotest** : en
débranchant la vérification de contenu d'`ecrireMedia`, le **SVG est accepté et stocké en
`.png`** (XSS stocké servi depuis notre origine) et le GIF passe. Vérification remise, porte
verte, volume rendu à son compte initial.

⚠️ **Six exemptions déclarées en sortie**, dont deux qui méritent d'être connues : cette porte
ne peut pas voir qu'un `alt` est **PERTINENT** (Lighthouse non plus — il ne voit qu'un `alt`
NON VIDE), ni que la **même image** a été téléversée deux fois (`filename` est unique, le
CONTENU ne l'est pas).

---

## `gate:partenaires` — la surface « partenaires » (Story 6.5)

**Quatorzième instrument**, et le premier qui garde une écriture qui **TRANSFORME** le
fichier. `gate:galerie` mesure qu'un fichier accepté est bien arrivé ; la galerie conserve
l'original. Ici le serveur le **réécrit** (redimensionnement dans la boîte canonique,
ré-encodage en WebP) : mesurer l'arrivée ne suffit plus, il faut mesurer **ce qu'il est
devenu**.

```bash
pnpm --filter vitrine gate:partenaires
PARTENAIRES_AUTOTEST=1 pnpm --filter vitrine gate:partenaires   # contre-épreuve
```

Deux moitiés, comme `gate:agenda` et `gate:galerie` :

| | Ce qu'elle mesure |
|---|---|
| **A** — HTTP nu, **sans aucun cookie** | 4 routes d'administration gardées et sans fuite · la route de logos d'admin qui ne sert jamais d'image · 6 traversées (`..`, `%00`, séparateurs Windows) qui rendent 404 et **jamais 500** · l'optimiseur qui refuse `/admin/medias/logos/**` **par le motif** · aucun partenaire non publié dans le HTML de `/` ni de `/partenaires` |
| **B** — la base, le volume et les contrats | 10 écritures SQL qui doivent **ÉCHOUER** (les 5 contraintes de la `0009`) · 7 valeurs que Zod doit refuser + 2 qu'il doit accepter · les deux sens du préfixe de `lib/logos.ts` · le **normaliseur `sharp` exercé lui-même** sur 5 cas · 3 refus qui ne doivent laisser **aucun octet** · le **cycle de vie d'un fichier** (+1 à l'écriture, +1 −1 au remplacement, −1 au retrait) · le **ménage**, qui est une garde |

### Ce qu'elle a trouvé, et que rien d'autre n'a vu

🔴 **`resize({ height })` NE BORNE PAS LA LARGEUR.** Mesuré : une bannière **4000 × 96 ressort
4000 × 96**, avec son poids d'origine, pour un rendu de **4,5 px de haut** dans la tuile. Ni
`gate` (`overflow-x: clip` rogne en silence), ni Lighthouse, ni le contraste ne le verraient.
C'est le défaut sur lequel cette porte a été **prouvée rouge** avant d'être livrée.

### Deux défauts d'INSTRUMENT trouvés en la prouvant

1. **Elle ne rendait aucun verdict — elle se bloquait.** Les cas SQL utilisaient la connexion
   externe **à l'intérieur** de `sql.begin(…)`, sur un pool `max: 1` : la transaction tenait la
   seule connexion, l'`insert` en attendait une autre. Interblocage. Chaque cas reçoit
   désormais `tx` en paramètre.
2. **Elle polluait le volume qu'elle mesurait.** `sharp(<chemin>)` garde un handle ouvert : le
   `unlink` du ménage échouait ensuite avec `EBUSY` sous Windows, et la porte laissait **3
   fichiers** derrière elle — en restant **verte**. Elle lit désormais un Buffer, et le ménage
   est devenu la **garde ⑬** : elle échoue si le volume ne revient pas à son compte de départ.
   ⚠️ C'est la 11ᵉ occurrence de `pieges/instrument-non-valide.md` sur ce projet.

### Contre-épreuve

`PARTENAIRES_AUTOTEST=1` présente à chaque garde un cas qu'elle **doit** voir (une route
ouverte là où elle attend une route gardée, une écriture valide là où elle attend un refus,
une image déjà conforme là où elle attend une transformation). **32 gardes** ont vu leur cas —
l'instrument mesure quelque chose.

⚠️ **Six exemptions déclarées en sortie**, dont deux qui méritent d'être connues : cette porte
ne peut pas voir qu'une **catégorie est juste au sens FR33** (ranger sous « soutien » une
collectivité qu'on espère seulement convaincre passe toutes les gardes techniques), ni qu'un
**logo est lisible sur `--navy`** — un logo blanc sur fond blanc aussi.

---

## `gate:ateliers` — la surface « ateliers » (Story 6.9)

**Quinzième instrument**, et le premier dont le risque central n'est **ni un fichier, ni une
date** : c'est un **ORDRE** et une **ABSENCE**.

```bash
pnpm --filter vitrine gate:ateliers
ATELIERS_AUTOTEST=1 pnpm --filter vitrine gate:ateliers   # contre-épreuve
```

⚠️ **Elle n'a PAS besoin de `--conditions=react-server`**, contrairement à `gate:galerie` et
`gate:partenaires` : elle n'importe rien de `src/server/` (aucun média, donc aucun
`server-only`). C'est une conséquence directe du fait que cette surface est en **texte pur**.
Ne pas ajouter le drapeau « par symétrie » — il masquerait le jour où un import serveur s'y
glisserait.

Deux moitiés, comme les trois portes de surface qui la précèdent :

| | Ce qu'elle mesure |
|---|---|
| **A** — HTTP nu, **sans aucun cookie** | 4 routes d'administration gardées (dont l'**aperçu**, qui rend les brouillons) et sans fuite de contenu dans le corps servi |
| **B** — la base, les contrats et le RENDU | 10 écritures SQL qui doivent **ÉCHOUER** (les 3 contraintes de la `0010` + l'enum + les `NOT NULL`) · 6 contre-épreuves qui doivent **PASSER**, dont les valeurs **pile à la borne** · 11 cas de `workshopInputSchema` exercé lui-même · la **parité base ↔ Zod** lue dans le texte des contraintes · l'**ordre total** mesuré par relectures · l'**absence** des colonnes de tarif/durée/effectif · aucun brouillon dans le HTML de `/animations` · les 3 familles et la phrase de clôture **servies** · le **repli de ligne** mesuré dans un vrai navigateur à 320 et 412px · le **ménage**, qui est une garde |

**49 gardes vertes** au merge.

### Ce qu'elle a trouvé, et que rien d'autre n'aurait vu

🔴 **On ne peut PAS mesurer la null-safety d'un `CHECK` par une écriture.** La porte a été
prouvée rouge en retirant la branche `is null` de `workshop_summary_valide` — et **seule la
garde ⑧ est passée au rouge**. La contre-épreuve ⑦ (« summary explicitement `NULL` ») est
restée **verte**, et c'est logique, donc grave : avec la contrainte cassée,
`CHECK (length(btrim(NULL)) > 0 …)` vaut `NULL`, donc **passe**, donc l'écriture est acceptée,
donc la contre-épreuve est satisfaite. **Le défaut rend la contre-épreuve aveugle par
construction.**

C'est exactement le défaut `event_has_venue` (Story 3.1), qui a survécu **trois epics et sept
portes vertes**. La seule façon de le voir est de **LIRE le texte de la contrainte**
(`pg_get_constraintdef`), ce que fait la garde ⑧ et elle seule. ⚠️ Ne jamais la supprimer en la
croyant redondante avec ⑥/⑦.

🔴 **L'ABSENCE se garde, ou elle se perd.** La garde ⑩ lit le schéma **réel** de la base et
échoue si une colonne de tarif, de durée ou d'effectif y apparaît. C'est la seule règle de
cette story qu'aucune relecture ne tiendra dans six mois : quelqu'un ajoutera « juste une
durée, c'est pratique », et la page bascule d'une offre d'**utilité sociale** (FR10) à un
catalogue de prestations sans qu'aucune autre porte ne le dise.

🔴 **`gate` NE VOIT PAS UN DÉBORDEMENT DE TEXTE À L'INTÉRIEUR DE SA PROPRE BOÎTE.** Les trois
champs d'un atelier sont bornés, mais **rien n'exige un espace**. Mesuré : un intitulé de 80
caractères insécables donnait, à 320px, **248px de boîte pour 2006px de texte — 1758px de
débordement**, et `pnpm --filter vitrine gate` est restée **VERTE**. Ce n'est pas un défaut de
`gate` : elle balaie les **boîtes**, or la boîte du `<li>` ne grandit pas — c'est le **texte**
qui déborde d'elle. Le témoin juste est `element.scrollWidth > element.clientWidth`, **par
élément** — à ne pas confondre avec le témoin INTERDIT du projet
(`documentElement.scrollWidth === clientWidth`), aveugle sous `overflow-x: clip`. La garde ⑬ le
mesure dans un vrai navigateur ; la limitation **générale** de `gate.mjs` est la dette **R38**.

⚠️ **Et le premier témoin de cette garde était FAUX** : un titre en
`mots-separes-par-des-traits-d-union` — le navigateur le coupait proprement, **le trait d'union
est une occasion de coupure en CSS**. L'instrument mesurait un cas qui n'en était pas un et
rendait un faux vert. Des lettres nues, et rien d'autre.

### Contre-épreuve

`ATELIERS_AUTOTEST=1` présente à chaque garde un cas qu'elle **doit** voir. **21 gardes** ont
vu le leur.

🔴 **Et l'autotest DÉCLARE ce qu'il ne prouve pas**, en sortie : **quatre gardes** (② fuite,
④ enum ↔ code, ⑦ contre-épreuves, ⑫ ménage) n'ont **pas** de cas d'auto-validation, chacune
pour un motif écrit. Une auto-validation qui ne déclare pas sa propre couverture laisse croire
que toutes les gardes sont éprouvées — c'est la forme la plus discrète de
`pieges/instrument-non-valide.md`.

⚠️ **Cinq exemptions déclarées en sortie**, dont une qui mérite d'être connue : la garde ⑩
interdit une **colonne** de tarif, elle ne peut rien contre « 50 € la séance » **tapé dans le
champ de description**. Seul le rappel du formulaire couvre ce cas.


---

## `gate:membres` — la 16ᵉ porte (Story 6.10)

`pnpm --filter vitrine gate:membres` · auto-validation : `MEMBRES_AUTOTEST=1 …`

⚠️ Elle exige `--conditions=react-server` (contrairement à `gate:ateliers`) : elle importe
`src/server/medias/`, qui commence par `import "server-only"` — un paquet qui **lève** hors du
graphe serveur. C'est la conséquence directe du fait que cette surface écrit des **fichiers**.

| | Ce qu'elle mesure |
|---|---|
| **A** — HTTP nu, **sans aucun cookie** | 4 routes d'administration gardées (dont l'**aperçu**, qui rend les brouillons) et sans fuite de contenu · **aucun membre non publié** dans le HTML des 5 pages publiques |
| **B** — la base, les contrats, le volume et le RENDU | 11 écritures SQL qui doivent **ÉCHOUER** (les 3 `CHECK` de la `0011` + les `NOT NULL`), **dont le piège du point** (`/medias/portraits/axwebp`) · 3 contre-épreuves qui doivent **PASSER**, dont les valeurs **pile à la borne** et `portrait IS NULL` · la **parité base ↔ Zod lue dans le TEXTE des contraintes** · l'**ABSENCE** de toute colonne d'effectif (FR16), lue dans le schéma réel · l'**ordre total** mesuré par relectures · 10 cas de `memberInputSchema` + 4 de `estCheminPortraitValide`, exercés **eux-mêmes** · le **normaliseur `sharp` exercé lui-même** sur 4 cas · le **cycle de vie du volume** · le **ménage**, qui est une garde · la **sémantique unifiée de `texteOptionnel`** sur les 3 schémas (dette R37) |

### Ce qu'elle ajoute aux quatre autres portes de surface

Elle est la première dont l'objet est une **donnée personnelle**. Deux gardes n'existent nulle
part ailleurs :

- **le portrait d'un membre NON PUBLIÉ** ne doit pas être servi — c'est la photo de quelqu'un
  que l'association n'a pas choisi de publier ;
- **⑭ la dette R37** : trois copies de `texteOptionnel` avaient divergé en silence pendant trois
  stories — `event.ts` **refusait** ce que `partner.ts` et `workshop.ts` **acceptaient** sur une
  chaîne de 300 caractères invisibles. La 6.10 les a unifiées ; cette garde ré-exerce les
  **trois** schémas sur la même valeur et exige le même verdict. Sans elle, la ligne se serait
  refermée sur une correction que **rien ne surveille** — or R37 disait précisément *« aucune
  porte ne voit ces divergences »*.

### Ce qu'elle a trouvé, et que rien d'autre n'aurait vu

- la **bannière 4000 × 96** ressort **320 × 8**, donc **bornée ET signalée comme filet** : la
  leçon centrale de la 6.5 (`resize({ height })` ne borne pas la largeur) tient aussi pour les
  portraits, et elle est mesurée sur les dimensions de **sortie**, jamais sur la réussite de
  l'appel ;
- une source **900 × 1200** ressort **240 × 320** : `fit: "inside"` conserve TOUJOURS le ratio.
  Le recadrage carré appartient au **rendu** (`object-fit: cover`), où il est réversible —
  jamais au fichier, où il serait définitif.

### Un défaut d'INSTRUMENT, payé une seconde fois avant d'être corrigé

Sa première version utilisait le pool externe **à l'intérieur** de `sql.begin`, sur un pool
`max: 1` : l'unique connexion étant tenue par la transaction, la seconde requête attendait une
connexion qui ne se libérerait jamais. **La porte ne rendait alors aucun verdict — elle se
BLOQUAIT**, ce qui est le pire des états : ni vert, ni rouge, juste une commande qui ne rend
jamais la main. C'est exactement le défaut payé par `gate:partenaires` en 6.5. Corrigé en
passant la **transaction** à chaque exécuteur, ce qui rend l'erreur impossible à refaire.

### Ce que l'auto-validation NE prouve pas

Trois gardes n'ont pas de cas d'auto-validation, et la porte **le dit en sortie** : ② (la route
témoin ne porte aucun marqueur d'administration — lui en présenter un demanderait d'en fabriquer
un faux), ⑤ (les contre-épreuves sont déjà l'inverse de ④), ⑪ (son cas d'échec est une fuite
réelle de fichiers, qu'on ne provoque pas exprès sur un volume qu'on sauvegarde).

---

## `gate:sollicitations` — la 17ᵉ porte (Story 6.11)

```bash
pnpm --filter vitrine gate:sollicitations
SOLLICITATIONS_AUTOTEST=1 npx tsx --conditions=react-server tools/visual-gate/sollicitations-check.mts
```

**33 gardes**, autotest **29**, **5 exemptions déclarées**. ⚠️ Elle **écrit en base** (4ᵉ dans
ce cas) : toutes ses lignes portent un marqueur dans `name`, sont supprimées en `finally`, et
**le décompte final le vérifie** — un compte qui ne revient pas à l'identique fait sortir la
porte en code 1, quel que soit l'état des gardes.

### Ce qu'elle a de propre : son objet est une donnée personnelle **de tiers**

`gate:membres` (6.10) gardait déjà de la donnée personnelle — des prénoms d'**adhérents**,
couverts par la clause des statuts. Ici ce sont le nom, l'adresse e-mail et le message libre de
collectivités, d'écoles et d'entreprises qui n'ont aucun lien avec l'association et n'ont
consenti qu'à **recevoir une réponse**. La garde ③ insère un témoin dont l'e-mail et le message
sont des chaînes uniques, puis interroge le **HTML servi** sans aucun cookie.

Cinq gardes n'existent nulle part ailleurs :

- **⑦ l'ordre est TOTAL** — elle fabrique le cas de la dette **R31** (deux lignes au **même**
  `created_at`, ce qu'un double-clic produit), lit deux fois, et vérifie **à la fois** que
  l'ordre est stable **et** qu'il suit bien `id DESC`. Un tri stable mais faux passerait le
  premier contrôle seul ;
- **⑨ la bascule n'écrit QUE `is_processed`** — le nom, l'e-mail, le type et le message ont été
  saisis par un **visiteur** : les rendre modifiables serait falsifier une demande reçue ;
- **⑪ aucune colonne d'ordre manuel** — l'**absence** est le livrable. Les cinq autres surfaces
  ont un `sort_order` ; ici l'ordre est chronologique, il appartient aux faits ;
- **⑯ `cleanText` neutralise les caractères sans largeur, et la règle n'existe qu'UNE fois** —
  garde posée après la revue, qui a établi que `cleanText` ne faisait qu'un `.trim()` alors
  qu'un commentaire de la Story 6.9, **sur une page publique**, affirmait le contraire. Elle
  éprouve **six** cas, dont une contre-épreuve indispensable : un **emoji à ZWJ doit SURVIVRE**
  (U+200D porte du sens) — sans elle, un durcissement corromprait des valeurs légitimes ;
- **⑬ la valeur de `GMAIL_APP_PASSWORD` ne part jamais dans le HTML** — l'écran dit que les
  notifications ne partent pas (dette **R32**), mais il le **mesure** sur l'environnement au
  lieu de l'écrire en dur, et le risque de ce montage est de rendre le secret lui-même.

### 🔴 Deux gardes LISENT le source, et c'est assumé

⑧ (« tout export commence par `requireAdmin()` ») et ⑨ portent sur du code dont l'**effet**
exige une session, que cette porte n'a pas. Les lire est le seul témoin disponible — même
raisonnement que la leçon la plus chère de l'Epic 6 : *quand l'écriture est aveugle, on LIT le
texte*. La limite est **déclarée en sortie** : un `requireAdmin()` présent ne prouve pas qu'il
est atteint, c'est le gate visuel qui l'exerce.

### Trois défauts d'INSTRUMENT trouvés en la prouvant — tous accusant le produit

17ᵉ, 18ᵉ et 19ᵉ occurrences de `00 référence/pieges/instrument-non-valide.md`. **Les croire
aurait fait « corriger » du code juste**, et l'un des trois aurait fait supprimer le
commentaire qui porte la règle :

1. **⑥b accusait Zod** de laisser passer un e-mail de 255 caractères. Le cas en faisait
   **252** (`repeat(247) + "@b.fr"`) : il était **sous** la borne, donc correctement accepté.
   La longueur d'un cas de borne se **calcule**, elle ne s'estime pas.
2. **⑫ accusait la description** de la section de promettre « Voir le rendu avant de publier ».
   Elle lisait le **commentaire** qui explique précisément pourquoi cette description ne le dit
   pas. Même classe que le balayage de classes fantômes de la 6.10 (5 faux positifs sur des
   stories mergées). Corrigé en retirant les lignes de commentaire avant de chercher.
3. **⑫b accusait une route `apercu/` d'exister**, sur la foi d'un `307`. Or le matcher
   `/admin/:path*` du proxy **redirige avant tout routage** : il ne discrimine rien, un `307`
   ne prouve ni l'existence ni l'absence — et `apercu` serait de toute façon capté par le
   segment `[id]`. L'absence d'une route **se lit sur le disque**, pas en HTTP.

### Ce que l'auto-validation NE prouve pas

Deux gardes n'ont pas de cas d'auto-validation, et la porte **le dit en sortie** : ② (la route
témoin ne porte aucun marqueur d'administration — lui en présenter un demanderait d'en
fabriquer un faux, donc de valider une chaîne inventée plutôt que la garde), ⑤ (la
contre-épreuve est déjà l'inverse de ④ ; l'inverser à son tour reviendrait à ré-exécuter ④).

## `gate:reglages` — la 18ᵉ porte (Story 6.13)

```bash
pnpm --filter vitrine gate:reglages
REGLAGES_AUTOTEST=1 npx tsx --conditions=react-server tools/visual-gate/reglages-check.mts
```

**37 gardes**, autotest **27**, **9 exemptions déclarées**. ⚠️ Elle **écrit en base** (5ᵉ dans ce
cas), et c'est la seule dont le ménage est une **RESTAURATION** et non une suppression : la table
`site_setting` n'a qu'**une** ligne, celle du site. La porte relève son état d'entrée, la modifie,
puis la remet et **la relit champ par champ** — une divergence fait sortir en code 1 quel que soit
l'état des gardes. Même traitement pour les événements qu'elle dépublie temporairement (voir ⑨).

### Ce qu'elle a de propre : elle mesure un aller-retour **écriture → site public**

Les six autres portes de surface gardent une saisie et son rendu **sur la page de cette surface**.
Ici, ce qui est écrit dans `site_setting` ressort dans le **header et le footer des 5 pages
publiques**. La garde ③ écrit donc réellement en base puis va **lire le HTML servi** des cinq
pages ; la garde ④ fait l'inverse — elle remet les colonnes à `NULL` et vérifie qu'il ne reste
**aucun** lien (ni `href`, ni focus, ni annonce « nouvel onglet »), parce que cette story rend le
défaut **R2** atteignable **par la saisie**.

Cinq gardes n'existent nulle part ailleurs :

- **① les 7 `CHECK` sont LUS**, pas éprouvés par une écriture. La table a **cinq colonnes
  nullables**, donc cinq occasions de refaire `event_has_venue` (un `CHECK` qui vaut `NULL`
  **passe**, et il a survécu à trois epics). La garde exige la chaîne `IS NULL` dans le texte de
  chacune des cinq ;
- **② le singleton tient** — une seconde ligne est refusée. Sans elle, « table à ligne unique » ne
  serait qu'une intention, et le chrome du site pourrait changer d'une requête à l'autre ;
- **⑤ ligne ABSENTE ⇒ repli honnête, pas une 500** — elle supprime la ligne et vérifie que les
  5 pages répondent `200` **et** servent l'e-mail de repli. C'est une limite **déclarée** de
  `lireReglages()`, donc une limite à éprouver ;
- **⑥ l'e-mail SAISI n'est pas l'identité SMTP** — le fait le plus dangereux de la story. Rendre
  `contact_email` saisissable pendant qu'il servait d'`auth.user` à nodemailer aurait cassé l'envoi
  **en silence** (le découplage de la 5.1 fait qu'une sollicitation serait persistée et notifiée à
  personne) ;
- **⑧ ABSENCE : aucune colonne de texte libre** dans `site_setting`. « Ajoute donc le titre du
  site tant qu'on y est » est la demande la plus naturelle du monde, et c'est exactement ce que
  l'arbitrage du 2026-07-29 a écarté (colonnes typées, NFR8) et ce que Q6 interdit.

### 🔴 Deux gardes LISENT le source, et c'est déclaré

⑥ (identité SMTP) et ⑦ (« tout export commence par `requireAdmin()` ») portent sur du code dont
l'**effet** exige soit une session, soit un envoi SMTP réel — or **aucun message n'a jamais été
émis sur ce projet** (dette **R32**). Les lire est le seul témoin disponible ; la limite est
déclarée en sortie.

### 🔴 La garde ⑨ FABRIQUE son cas — sinon elle ne couvrirait qu'un tiers du correctif

La dette **R33 ③** porte sur **trois** mentions « Discord » en prose : l'aside d'`/agenda`
(toujours rendu), l'état vide d'`/agenda` et l'état vide du hub de `/`. Les deux derniers ne se
rendent **que s'il n'y a aucun événement à venir publié** — jamais sur une base peuplée. La porte
dépublie donc les événements à venir le temps de la mesure, relève leurs identifiants, et **ne
republie que ceux-là** (la base porte des brouillons légitimes). Sans ce détour, deux fichiers CSS
sur trois n'auraient reçu **aucune** mesure, dont `EventHub.module.css`, que rien d'autre ne touche.

⚠️ Et c'est elle qui a prouvé la porte **ROUGE avant le correctif** : le souligné était posé sur la
classe de base, donc rendu **au repos** sur un élément inerte. La garde ⑥ de `gate:links` ne mesure
que le **survol** — elle était structurellement aveugle à ce défaut.

### Cinq défauts d'INSTRUMENT trouvés en la prouvant

20ᵉ à 24ᵉ occurrences de `00 référence/pieges/instrument-non-valide.md`. **Trois accusaient le
produit, un était un faux négatif, un était une erreur de syntaxe :**

1. **① accusait le `CHECK` de l'e-mail** de ne pas contenir `[[:space:]]`. Le motif s'écrit
   `[^[:space:]@]` : la classe POSIX y est toujours précédée d'un `[^`, jamais d'un `[`. MESURÉ :
   `position('[[:space:]]' in …)` → **0**, `position('[:space:]' in …)` → **104**. L'aiguille
   cherchait une chaîne qui ne peut exister dans **aucun** texte de contrainte.
2. **⑥ accusait `client.ts`** de lire les réglages. Elle tombait sur les **deux lignes de
   commentaire** qui expliquent précisément pourquoi le compte SMTP n'est *pas*
   `site_setting.contact_email` — la porte accusait le texte qui porte la règle qu'elle garde.
   Même classe que le finding de la 6.11 qui aurait fait supprimer un commentaire pour faire taire
   sa propre garde. Le seul témoin qui distingue « lit » de « parle de » est l'**import**.
3. **⑨ était un FAUX NÉGATIF, et c'est le plus grave des cinq.** Son prédicat retirait l'annonce
   lecteur d'écran par une regex à parenthèses échappées — écrite dans un **littéral de gabarit
   JS**, où un antislash-parenthèse s'évalue en parenthèse nue. Le navigateur recevait un **groupe
   de capture** : « Discord (nouvel onglet) » devenait « Discord () », jamais égal à « Discord ».
   La garde concluait « aucune mention en prose » et **s'exemptait elle-même**. C'est le **même
   piège d'échappement à deux étages** que le point du motif SQL (6.5, 6.10) — cette fois retourné
   contre l'instrument. Parade : on ne bricole plus de chaîne, on retire le `.sr-only` du **DOM
   cloné** (classe globale, donc non hachée).
4. **une erreur de syntaxe** : un commentaire cité entre accents graves **à l'intérieur** du
   littéral de gabarit envoyé au navigateur le refermait. Elle n'a jamais rendu de verdict — elle
   a fait échouer la transformation, ce qui est la forme la moins coûteuse d'instrument faux.
5. **la couverture elle-même** : ⑨ ne mesurait qu'**une** des trois occurrences de R33 ③, et
   s'exemptait proprement des deux autres. Une exemption honnête reste une exemption : c'est ce
   qui a conduit à faire fabriquer les états vides par la porte.

---

## `gate:reseaux` — la 19ᵉ porte (Story 6.7)

```bash
pnpm --filter vitrine gate:reseaux
RESEAUX_AUTOTEST=1 pnpm --filter vitrine gate:reseaux   # auto-validation de l'instrument
```

**26 gardes · 9 éprouvées par autotest · 17 déclarées NON éprouvées · 5 exemptions.**
⚠️ Elle n'exige **pas** de serveur Next : elle importe le produit et fabrique son propre
service tiers. Elle a besoin de `DATABASE_URL` (garde ⑪, lecture d'`information_schema`).

### Ce qu'elle a de propre : elle **fabrique le service tiers** qu'elle mesure

Toutes les autres portes de surface observent quelque chose qui existe déjà (une page servie,
une table, un fichier). Celle-ci démarre un **serveur HTTP sur `127.0.0.1`** qui joue n8n, y
pointe `N8N_WEBHOOK_URL`, appelle la **vraie** `publierEvenement()` et lit le **corps
réellement reçu**. C'est ce qui la range du côté de `gate:links` (qui clique vraiment) et non
du côté d'une relecture de source : un instrument qui relirait `n8n.ts` pour vérifier que « le
jeton est bien en en-tête » validerait sa propre lecture du code, pas l'octet émis.

Trois comportements du faux n8n, et chacun est une garde : **accepte** (200), **refuse** (500),
et **muet** — celui-ci n'envoie jamais de réponse, ce qui est le seul moyen d'éprouver que le
délai explicite existe. Sans lui, l'attente serait celle du système (~2 min).

### 🔴 C'est la porte qui a dicté une décision du PRODUIT, pas l'inverse

Une première version de `server/integrations/n8n.ts` refusait `http://` **sans exception** —
transposition littérale du `requireTLS` de la Story 5.1. En écrivant la porte, la conséquence
est apparue : plus **aucun POST réel** n'était émettable vers un faux n8n local sans fabriquer
un certificat auto-signé et désarmer la vérification TLS du processus, c'est-à-dire sans
remplacer une **mesure d'effet** par une **lecture de source**.

C'est le mécanisme exact de la dette **R32** : une garde correcte sur le papier qui rend le
maillon **invérifiable**, donc jamais vérifié. Et la règle ② de
`00 référence/pieges/integration-tierce.md` dit l'inverse — *« choisir le transport vérifiable
dans l'environnement de développement »*.

⇒ Exemption **de boucle locale uniquement**, justifiée par le modèle de menace (sur `127.0.0.1`
le paquet ne quitte pas la machine : il n'y a aucun intermédiaire à qui le cacher), et dont la
garde ⑥ éprouve les **huit bords** — dont **deux pièges de SUFFIXE** :
`http://localhost.attaquant.fr` et `http://127.0.0.1.attaquant.fr` sont des hôtes **publics**
dont le nom commence par celui de la boucle locale.

### 🔴 Sa couverture d'auto-validation est CALCULÉE, jamais énumérée

`gate:ateliers` avait posé la règle — *« un autotest muet sur sa propre couverture laisse croire
qu'il couvre tout »* — et sa parade était une **liste écrite à la main** des gardes non
éprouvées. Cette liste a été **fausse dès la première exécution ici** : elle annonçait **quatre**
gardes sans cas d'auto-validation, il y en avait **dix-sept**.

Puis, en la corrigeant, l'explication rédigée juste en dessous — « les trois familles », garde
par garde — s'est trouvée **désalignée d'une garde (⑥b)** au premier lancement suivant. Deux
fois le même défaut, dans le même fichier, en dix minutes.

⇒ La liste est désormais **dérivée** (une garde qui n'a produit qu'un `ok` en autotest est une
garde à qui l'on n'a présenté aucun cas d'échec), et le texte qui l'accompagne ne **recopie
aucun identifiant** — il ne décrit que des *raisons*. C'est le défaut de `app/admin/_sections.ts`
et de la liste de portes de `CLAUDE.md` §4, transposé à un instrument : *une énumération alignée
à la main se désaligne à l'ajout suivant.*

### Ce qu'elle garde et que rien d'autre ne voit

| # | Garde | Pourquoi rien d'autre ne la voit |
|---|---|---|
| ① | un POST réel part, et son corps satisfait `publicationPayloadSchema` **exporté par le produit** | aucune porte n'émet de requête sortante |
| ①b | **exactement une** requête (aucune reprise automatique) | un `POST` rejoué publierait **deux fois** |
| ② | la **valeur** du jeton n'est jamais dans le corps ; elle est dans l'en-tête | un corps part dans les **données d'exécution** que n8n conserve et affiche |
| ③ | le corps ne porte **que** les 12 clés du contrat, et **aucune arobase** | le message quitte le périmètre RGPD du site |
| ④ | un refus (500) rend une phrase **sans** code HTTP, URL ni nom de fonction | on mesure la **chaîne rendue**, pas le code qui la produit |
| ⑤ | un webhook **muet** rend la main dans le délai déclaré par le produit | sinon l'attente est celle de l'OS (~2 min) |
| ⑥ | les 8 bords du transport, **suffixes compris** | `gate:links` ne connaît que les liens du rendu |
| ⑦ | variable absente **ou vide** ⇒ message actionnable, module **importable** | c'est ce qui tient `next build` sans secret, donc la CI |
| ⑧ | la date porte l'**offset réel de Paris**, et un `Z` est **refusé** avant le réseau | un `Z` ferait composer à n8n une annonce **fausse de deux heures** |
| ⑨ | **un seul** fichier de `src/` connaît `N8N_WEBHOOK_URL` (AR-API2) | ⚠️ lecture de source, déclarée |
| ⑩ | `requireAdmin()` en tête de chaque export ; l'action refuse elle-même un événement non publié | ⚠️ lecture de source, déclarée |
| ⑪ | **ABSENCE** : aucune colonne de « texte d'annonce » sur `event` | la composition vit dans n8n, pas en base |
| ⑫ | le workflow **versionné** n'a aucun nœud social, **aucun nœud désactivé**, aucun secret, et répond via `responseNode` | un nœud désactivé *ressemble* à une livraison — la forme que prend **R32** |

### Un défaut d'instrument évité par la mesure, pas par la relecture

La garde ⑫ a d'abord été écrite comme une recherche de la chaîne `discord` dans le fichier du
workflow. Elle tombait — sur le **commentaire qui déclare l'absence de ces nœuds**. C'est le
défaut trouvé en revue de la 6.11 **puis** de la 6.13 (*« la porte accuse le texte qui porte la
règle qu'elle garde »*), rencontré une troisième fois. Le témoin juste est le **type des
nœuds**, jamais le texte du fichier.

### Ce que l'auto-validation NE prouve pas

Dix-sept gardes n'ont aucun cas d'échec fabriqué, et la porte les **nomme en sortie**. Trois
familles : celles dont le cas d'échec *est déjà* un échec fabriqué (500, silence, variable
absente) — l'inverser reviendrait à valider le banc de mesure ; celles qui constatent une
**présence**, dont l'inverse est le cas nominal d'une autre garde du même bloc ; celles qui
lisent le workflow **versionné**, dont le faux cas demanderait un second fichier que personne
n'importe.

### 🔴 Et surtout : ce qu'elle ne mesure pas du tout

Elle s'arrête à **l'octet émis**. Qu'une annonce **paraisse** sur un réseau social n'est ni
mesuré ni livré — c'est le périmètre A1 arbitré par Brice, et la dette **R42**. Elle n'appelle
**jamais** le vrai webhook : une porte qui publierait pour se tester enverrait de vraies annonces
à chaque exécution. Le vrai appel est le **verify d'entrée**, fait à la main une fois, consigné
dans la story.
