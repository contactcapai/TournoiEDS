# `apps/vitrine/n8n/` — le workflow de publication réseaux, versionné

> Story 6.7 (FR23, AR-API2). Ce dossier ne contient **aucun secret** : le workflow ne porte
> qu'une *référence* de credential (identifiant + nom), jamais sa valeur.

## Pourquoi ici, et pas dans `packages/n8n-workflows/`

`00 référence/pieges/webhook-n8n.md` demande de versionner les workflows et suggère un paquet
partagé `packages/n8n-workflows`. **Arbitrage de Brice du 2026-08-07 : ici.** Motif : un paquet
pnpm entier — `package.json`, entrée de workspace, place dans le graphe Turborepo — pour **un
fichier JSON** qui n'a qu'un consommateur, `apps/vitrine/src/server/integrations/n8n.ts`, situé
à trois dossiers d'ici.

⚠️ **L'écart à la référence est assumé, et il est écrit là où on le lirait** : le jour où un
deuxième projet du monorepo aura un workflow n8n, ce dossier devra devenir ce paquet — pas avant.
C'est la doctrine « extraction au 2ᵉ consommateur » du projet, appliquée à un dossier.

## ✅ L'état réel, au soir du 2026-08-07 — **le n8n d'EDS EST INSTALLÉ (Story 7.1)**

| | |
|---|---|
| Instance | **`n8n.esportdessacres.fr`** — VPS de l'asso, image épinglée `n8nio/n8n:2.33.7`, UI derrière basic auth Traefik + login n8n, webhooks sur routeur dédié sans basic auth |
| Workflow | id `n6r0B6reFnRGizKa`, **ACTIF**, importé depuis ce dossier puis re-vérifié |
| Credential | « `x-eds-webhook-token` » (id `kQBTHL7BquUaPh2q`), créé à l'installation, jeton **neuf** |
| Verify d'entrée | ✅ **PAYÉ le 2026-08-07** (ex-AC12) : clic réel depuis le back-office → exécution n8n n°7 observée, corps reçu complet, `debut` avec offset `+02:00`, `social_posted_at` horodaté en base |
| ⚠️ Ignore Bots | **DÉCOCHÉ, et c'est une décision mesurée** — voir le piège ② ci-dessous |

⚠️ **Il ne PUBLIE toujours rien** : aucun nœud social (volets ③④ de R42 → Story 7.6).

*(L'état antérieur, conservé pour l'historique du cadrage : )*

## 🔴 L'état au matin du 2026-08-07 — AUCUNE instance n8n n'était encore la cible

**Décision de Brice du 2026-08-07 : l'association aura SON PROPRE n8n.** L'instance CapAI
(`n8n.srv1286894.hstgr.cloud`, partagée entre ~12 projets clients) **n'est pas la destination**,
et le motif est une question de gouvernance, pas de technique : les jetons d'API Instagram / X /
Discord de l'association n'ont pas à vivre sur l'instance d'un prestataire, sur un site dont tout
l'Epic 6 existe pour qu'il survive « sans dépendre d'une personne ».

Son argument de méthode, qui commande tout ce fichier : **« ça sert à rien de tester en local un
truc qui sera en ligne ensuite »**. Un verify d'entrée payé contre une instance qui ne sera jamais
celle de production ne prouve rien d'utile — il prouve un lien vers une adresse qui va changer.

| | |
|---|---|
| Instance cible | **le n8n d'Esport des Sacres — pas encore installé** |
| Instance CapAI | workflow `7sjGZp3kBvlVgpGu` **DÉSACTIVÉ** le 2026-08-07 (endpoint mort), objet dormant à supprimer ; credential `bYP83ma8hQG80vU5` idem |
| `N8N_WEBHOOK_URL` / `_TOKEN` | **absentes** — le back-office dit donc « la publication réseaux n'est pas configurée sur ce site », ce qui est **exactement vrai** |
| Chemin de webhook prévu | `eds-publication-evenement` |
| En-tête attendu | `x-eds-webhook-token` |

⚠️ **Le jeton sera REGÉNÉRÉ à l'installation.** Une valeur qui a existé sur une autre instance ne
se recycle pas.

### Ce que ça veut dire pour la Story 6.7

Tout le **côté site** est livré et mesuré : l'utilitaire unique, la Server Action, l'écran, la
trace en base, et les 26 gardes de `gate:reseaux` — **qui ne dépendent d'aucune instance**, parce
que la porte fabrique son propre n8n sur `127.0.0.1`. Ce travail reste vrai quelle que soit
l'instance retenue.

Ce qui est **déplacé au go-live** : l'installation de l'instance, l'import de ce workflow, et le
**verify d'entrée**. ⚠️ **Et il faut le dire franchement : ce report remet la Story 6.7 dans la
famille de R32** — un maillon entièrement écrit, jamais exercé, donc de **statut inconnu**. La
différence avec R32 est qu'ici c'est **écrit, routé et décidé** au lieu d'être découvert après
coup. Voir **R42** dans `deferred-work.md`.

## 🔴 Ce que ce workflow NE FAIT PAS — et c'est le livrable

Il **reçoit, authentifie, valide et accuse réception**. Il ne publie sur aucun réseau social.

**Les nœuds Instagram / X / Discord sont ABSENTS, jamais « désactivés ».** Un nœud désactivé
*ressemble* à une livraison : c'est exactement la forme que prend la dette **R32** (l'envoi SMTP
de la Story 5.1, entièrement câblé, jamais émis une seule fois). Leur absence est vérifiable
d'un coup d'œil sur la structure du workflow — cinq nœuds, aucun connecteur social.

Motif **mesuré**, pas supposé : aucun compte social de l'association n'est renseigné
(`site_setting.instagram_url` / `x_url` / `discord_url` sont vides, dette **R29**, gelée), donc
aucun identifiant d'API n'existe. ⇒ Dette **R42** dans `deferred-work.md`, avec son mode de
défaillance écrit.

## 🔴 Les deux pièges qui ont mordu en écrivant ce workflow

### ① L'URL de test et l'URL de production sont différentes, et la seconde n'existe que si le workflow est ACTIF

Doc n8n du nœud Webhook, lue le 2026-08-07 :

```
.../webhook-test/<chemin>   enregistrée seulement pendant « Listen for test event »
.../webhook/<chemin>        enregistrée quand le workflow est ACTIF
```

Un workflow désactivé rend donc **404** sur l'URL de production. Côté site, ce 404 remonte comme
« le service de publication a refusé l'annonce » — un symptôme qui ressemble à une panne alors
que c'est un **interrupteur**.

### ② 🔴 « Authorization data is wrong! » — LA CAUSE EST ÉTABLIE, ET CE N'ÉTAIT PAS LE CREDENTIAL

> ✅ **RE-MESURÉ ET RÉSOLU le 2026-08-07 sur l'instance d'EDS (Story 7.1). La cause réelle :
> l'option `Ignore Bots` du nœud Webhook.** Elle rejette en `403 « Authorization data is
> wrong! »` — **avant même de regarder le credential** — tout User-Agent que `isbot` classe
> robot : `curl`, `python-urllib`… **et `node`, l'UA du `fetch` de la vitrine elle-même.**
> Le message est LE MÊME que pour un mauvais jeton : le témoin ne distingue pas les deux causes.
>
> **L'instruction qui l'a coincée** (chaque hypothèse réfutée par une mesure) : champs du
> credential prouvés exacts (export CLI déchiffré) → en-tête prouvé intact jusqu'à n8n
> (workflow-écho) → credential prouvé résolu au runtime (montage HTTP Request → écho) →
> versions 2.20.9 **et** 2.33.7 identiques → **lecture du source** : le `throw` d'Ignore Bots
> précède `validateAuth`. Sonde en UA navigateur → **200**.
>
> ⇒ **Conséquences.** ① L'épisode CapAI (ex-R43) se requalifie : les **cinq** variantes
> d'écriture par l'API étaient sondées en `curl` — **l'écriture de credentials par l'API
> fonctionne** (prouvé sur EDS : créé, rattaché, déchiffré, utilisé). ② `Ignore Bots` est
> **DÉCOCHÉ** sur ce webhook, et ce n'est pas un affaiblissement : l'authentification est
> portée par le **jeton**, qu'aucun crawler n'a ; l'option n'ajoutait qu'un mode d'échec
> silencieux qui a coûté des heures sur **deux** instances — et elle aurait rejeté le
> **premier clic réel** d'un bénévole. ③ Un credential se crée indifféremment par l'interface
> ou par l'API ; seule règle conservée : **éprouver par un appel réel** après création.
>
> *(Mesure d'origine sur CapAI, conservée pour l'historique — relue aujourd'hui, elle était
> déjà compatible avec la vraie cause : )*

**Mesuré le 2026-08-07**, et c'est la variante « credentials » du piège `webhook-n8n.md` :

| Ce qui a été tenté par l'API publique | Résultat |
|---|---|
| `POST /credentials` avec `{name, value}` | `success: true` — puis **403 « Authorization data is wrong! »** à l'appel |
| `PATCH` du même credential, valeur identique | idem |
| Cycle **désactivation → réactivation** du workflow (hypothèse d'un cache) | idem |
| Valeur et nom d'en-tête **triviaux** (`x-api-key` / `diagnostic123`) | idem |
| Ajout de `useCustomAuth: false` (3ᵉ champ du schéma) | idem |
| `GET /credentials` (lecture) | **403 `NOT_SUPPORTED`** — l'API refuse aussi de *lire* |

⇒ **L'écriture est acceptée mais la donnée n'est pas exploitable par le nœud.** Quatre variantes
indépendantes, même verdict : ce n'est pas la valeur, c'est le chemin.

**Parade :** créer le credential **dans l'interface**, pas par l'API — champ **Name** =
`x-eds-webhook-token`, champ **Value** = le jeton généré à l'installation, puis **Save**. Puis
**éprouver l'authentification par un appel réel avant de croire quoi que ce soit** : un `403`
« Authorization data is wrong! » est le symptôme, et il ne se distingue pas d'un mauvais jeton.

⚠️ **C'est la parade littérale du piège** — *« re-vérifier manuellement chaque nœud après CHAQUE
import »* —, cette fois sur le credential plutôt que sur un paramètre de nœud.

## Ré-importer

`Workflows → Import from File → publication-reseaux.json`.

⚠️ **Après tout import, re-vérifier chaque nœud à la main** (paramètres, credentials, champs
d'entrée). L'import n8n **drope des paramètres en silence** — c'est le mode de défaillance
dominant de ce stack, vu dans **six projets CapAI**. La liste de ce qu'il faut retrouver :

- **Webhook** : `POST`, chemin `eds-publication-evenement`, *Authentication* = **Header Auth**
  (credential rattaché), *Respond* = **Using 'Respond to Webhook' Node**, et 🔴 **option
  *Ignore Bots* DÉCOCHÉE** — décision **mesurée** de la Story 7.1 : cochée, elle rejette l'UA
  `node` du `fetch` de la vitrine en `403` identique à un mauvais jeton (piège ② ci-dessus).
  La re-cocher casserait l'appelant réel **en silence**.
  🔴 **`Respond immediately` serait un défaut, pas une simplification** : le site recevrait `200`
  pour n'importe quel corps, y compris vide, et son verdict « annonce partie » deviendrait un
  **faux succès** (`00 référence/pieges/faux-succes.md`).
- **Valider le message** : le code doit contenir la vérification `version === 1`, `source ===
  'vitrine-eds'`, les cinq champs obligatoires, **et la règle de date**.
- **Message valide ?** : sortie **vraie** vers « accepté », **fausse** vers « refusé ».
- **Repondre — accepte / refuse** : codes **200** et **400**.

## ⚠️ Une règle vit en DEUX exemplaires, et les deux doivent bouger ensemble

La forme de la date — **ISO avec offset de Paris, jamais un `Z`** — est écrite ici *et* dans
`apps/vitrine/src/lib/schemas/publication.ts`. Ce ne sont pas deux copies d'un motif : ce sont
les deux extrémités d'un contrat, l'une en TypeScript et l'autre en JavaScript n8n, et aucune
porte de ce dépôt ne peut lire la seconde. `gate:reseaux` garde l'extrémité qu'elle peut
atteindre ; celle-ci se relit **à la main**, ici.

Motif : `2026-08-13T19:00:00+02:00` désigne le même instant que `2026-08-13T17:00:00.000Z`, mais
le second a perdu l'heure que les gens liront sur l'affiche. Un workflow qui compose
« rendez-vous à 17h00 » publierait une annonce **fausse de deux heures**, sur un réseau social,
là où plus aucune porte ne peut la voir.
