---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
status: complete
completedAt: '2026-04-15'
totalEpics: 6
totalStories: 20
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - docs/UX-DESIGN.md
  - docs/CONTEXTE-PROJET.md
---

# Tournoi TFT EDS - Epic Breakdown

## Overview

Ce document fournit le decoupage complet en epics et stories pour le projet Tournoi TFT EDS, decomposant les exigences du PRD, du UX Design et de l'Architecture en stories implementables.

## Requirements Inventory

### Functional Requirements

**Inscription des joueurs**
- FR1 : Un joueur peut s'inscrire au tournoi via un formulaire (pseudo Discord, pseudo Riot, email)
- FR2 : Un joueur peut voir une confirmation de son inscription apres soumission
- FR3 : L'admin peut voir la liste complete des joueurs inscrits
- FR4 : L'admin peut ajouter manuellement un joueur
- FR5 : L'admin peut retirer un joueur inscrit avant le debut du tournoi (absent)

**Gestion des lobbies**
- FR6 : Le systeme peut repartir aleatoirement les joueurs en lobbies de 8 pour le Round 1
- FR7 : Le systeme peut redistribuer les joueurs en lobbies selon le classement (systeme suisse) pour les rounds suivants
- FR8 : Le systeme peut gerer des lobbies incomplets (7 joueurs ou moins) quand le nombre total n'est pas un multiple de 8
- FR9 : L'admin peut visualiser la composition de chaque lobby avant de lancer un round

**Saisie et calcul des resultats**
- FR10 : L'admin peut saisir le placement (1-8) de chaque joueur pour chaque lobby d'un round
- FR11 : Le systeme calcule automatiquement les points selon le bareme (1er = 8 pts, 8e = 1 pt)
- FR12 : Le systeme calcule le score cumule de chaque joueur sur l'ensemble des rounds
- FR13 : Le systeme calcule les tiebreakers (nombre de top 1, nombre de top 4, resultat derniere game)
- FR14 : L'admin peut valider un round pour declencher la mise a jour du classement
- FR15 : Le systeme calcule la moyenne de points par round pour chaque joueur

**Gestion du tournoi (jour J)**
- FR16 : L'admin peut demarrer une journee de qualification
- FR17 : L'admin peut enchainer un nombre illimite de rounds par journee de qualification — fin manuelle via bouton (pas de limite dure)
- FR18 : L'admin peut marquer un joueur comme "drop" en cours de journee
- FR19 : Un joueur droppe est retire des lobbies suivants mais conserve ses points acquis
- FR20 : Le classement est cumule sur les 3 journees de qualification

**Finale**
- FR21 : Le systeme identifie les 8 joueurs qualifies (top 8 du classement cumule)
- FR22 : L'admin peut demarrer la phase finale avec les 8 qualifies en un seul lobby
- FR23 : Le systeme detecte automatiquement la condition de victoire (top 1 + >= 20 points cumules)
- FR24 : L'admin peut enchainer des rounds illimites en finale jusqu'a ce qu'un joueur remplisse la condition de victoire

**Affichage public temps reel**
- FR25 : Un visiteur peut consulter la page de presentation du tournoi (dates, format, cash prize, reglement)
- FR26 : Un visiteur peut consulter le classement des qualifications en temps reel
- FR27 : Le classement affiche pour chaque joueur : pseudo, placements par round, points par round, score total, tiebreakers, moyenne
- FR28 : Un visiteur peut consulter le tableau de la finale en temps reel
- FR29 : La page finale affiche un indicateur de progression vers la condition de victoire pour chaque finaliste
- FR30 : Les pages publiques se mettent a jour instantanement quand l'admin valide un round
- FR31 : Les pages publiques sont consultables sur mobile

**Overlay stream**
- FR32 : Le caster peut afficher une vue overlay (`/overlay`) dans OBS comme source navigateur
- FR33 : L'overlay affiche le classement sans elements d'interface (chrome UI)
- FR34 : L'overlay est optimise pour un affichage 16:9 avec polices lisibles a distance
- FR35 : L'overlay se met a jour instantanement quand l'admin valide un round

**Administration et securite**
- FR36 : L'admin peut se connecter au backoffice via un login simple (identifiant/mot de passe)
- FR37 : Le backoffice est accessible uniquement aux utilisateurs authentifies
- FR38 : Le site affiche les mentions legales RGPD

### NonFunctional Requirements

- NFR1 : Pages publiques et overlay — chargement initial < 2 secondes
- NFR2 : Mise a jour temps reel (WebSocket) — < 2 secondes apres validation admin
- NFR3 : Saisie placements backoffice — latence < 200ms
- NFR4 : Capacite — ~30 connexions WebSocket simultanees en lecture, 1 admin en ecriture
- NFR5 : Backoffice protege par authentification (identifiant/mot de passe)
- NFR6 : Mots de passe admin stockes hashes (jamais en clair)
- NFR7 : Communications chiffrees via HTTPS (certificat SSL via Traefik)
- NFR8 : Donnees personnelles des joueurs (email) non exposees publiquement
- NFR9 : Mentions legales RGPD affichees
- NFR10 : Disponibilite continue pendant toute la duree d'une journee de tournoi (~4-6 heures)
- NFR11 : Persistance immediate en base PostgreSQL (pas de cache volatile)
- NFR12 : Backup manuel de la base avant chaque journee de tournoi

### Additional Requirements

**Starter Template / Init Projet :**
- Le projet utilise un monorepo avec deux packages : `frontend/` et `backend/`
- Frontend : Vite 8 + React 19 + TypeScript (template officiel `react-ts`)
- Backend : Express + Prisma 7 + Socket.IO + TypeScript (setup manuel)
- Base de donnees : PostgreSQL 17 existant (conteneur `postgresql-zvmf`)

**Infrastructure & Deploiement :**
- Backend deploye en Docker sur VPS avec Traefik (sous-domaine `api-tournoi.esportdessacres.fr`)
- Frontend build statique deploye sur Hostinger (sous-domaine `tournoi.esportdessacres.fr`)
- Reseau Docker externe `postgresql-zvmf_default` pour acceder au PG partage
- CORS configure pour accepter uniquement le domaine frontend

**Authentification :**
- JWT stateless avec expiration 24h
- Hashage bcrypt pour le mot de passe admin
- Middleware Express sur toutes les routes `/api/admin/*`

**Temps reel :**
- Socket.IO pour WebSocket (reconnexion automatique native)
- Namespace `/tournament`
- Evenements : `ranking_updated`, `tournament_state_changed`, `round_validated`

**State Management Frontend :**
- React Context (`TournamentContext`, `AuthContext`)
- React Router v7 pour le routing SPA

**Styling :**
- Tailwind CSS avec configuration custom charte EDS

**Conventions de code :**
- TypeScript strict mode partout
- Tests co-localises avec les fichiers source
- Format reponse API standardise `{ data }` / `{ error: { code, message } }`

### UX Design Requirements

- UX-DR1 : Dark mode par defaut — fond bleu nuit `#29265B`, ambiance esport/gaming propre et lisible
- UX-DR2 : Hero section page d'accueil — titre en Bebas Neue Bold, infos essentielles visibles immediatement (dates, format, cash prize)
- UX-DR3 : Formulaire d'inscription — 3 champs (pseudo Discord, pseudo Riot, email) avec CTA clair et visible
- UX-DR4 : Tableau de classement — lignes alternees, police genereuse lisible a distance, colonnes : rang, pseudo, placements par round, score total, tiebreakers
- UX-DR5 : Mise en valeur du top 8 — zone de qualification visualisee par couleur d'accent ou bordure distincte
- UX-DR6 : Indicateur visuel des drops — joueurs droppes grises ou barres dans le tableau
- UX-DR7 : Indicateur de progression condition de victoire — barre de progression ou indicateur (points >= 20 + top 1)
- UX-DR8 : Animation/mise en valeur du vainqueur — mise en avant forte en ocre/or `#DAB265` quand un joueur remplit la condition
- UX-DR9 : Saisie rapide des placements backoffice — dropdown ou systeme de clic rapide, optimise pour la vitesse
- UX-DR10 : Vue d'ensemble d'un round — voir tous les lobbies + tous les joueurs d'un coup dans le backoffice
- UX-DR11 : Gros boutons d'actions cles backoffice — "Generer les lobbies", "Valider le round", "Marquer drop"
- UX-DR12 : Configuration Tailwind charte EDS — palette de couleurs (#29265B, #80E2ED, #787C86, #EDEFFD, #DAB265, #FFFFFF) + typographies (Bebas Neue + Roboto via Google Fonts)
- UX-DR13 : Responsive — priorite desktop, mobile supporté pour pages publiques, backoffice desktop-only, overlay 16:9 fixe
- UX-DR14 : Overlay OBS — sans chrome UI, sans navigation, polices lisibles a distance, format 16:9
- UX-DR15 : Couleurs d'accent (cyan `#80E2ED`, or `#DAB265`) utilisees pour guider l'oeil sur les elements importants
- UX-DR16 : Reglement accessible — accordeon ou lien sur la page de presentation

### FR Coverage Map

- FR1 : Epic 1 — Inscription joueur via formulaire
- FR2 : Epic 1 — Confirmation d'inscription
- FR3 : Epic 2 — Liste des joueurs inscrits (admin)
- FR4 : Epic 2 — Ajout manuel joueur (admin)
- FR5 : Epic 2 — Retrait joueur absent (admin)
- FR6 : Epic 2 — Repartition aleatoire lobbies Round 1
- FR7 : Epic 2 — Redistribution systeme suisse
- FR8 : Epic 2 — Gestion lobbies incomplets
- FR9 : Epic 2 — Visualisation composition lobbies
- FR10 : Epic 2 — Saisie placements
- FR11 : Epic 2 — Calcul automatique points
- FR12 : Epic 2 — Score cumule
- FR13 : Epic 2 — Calcul tiebreakers
- FR14 : Epic 2 — Validation round
- FR15 : Epic 2 — Calcul moyenne
- FR16 : Epic 2 — Demarrer journee qualification
- FR17 : Epic 2 — Enchainer un nombre illimite de rounds par journee (fin manuelle)
- FR18 : Epic 2 — Marquer drop
- FR19 : Epic 2 — Drop : retrait lobbies + conservation points
- FR20 : Epic 2 — Classement cumule 3 journees
- FR21 : Epic 5 — Identification top 8 qualifies
- FR22 : Epic 5 — Demarrer finale lobby unique
- FR23 : Epic 5 — Detection condition de victoire
- FR24 : Epic 5 — Rounds illimites finale
- FR25 : Epic 1 — Page presentation tournoi
- FR26 : Epic 3 — Classement qualifications temps reel
- FR27 : Epic 3 — Affichage complet classement (pseudo, rounds, tiebreakers, moyenne)
- FR28 : Epic 5 — Tableau finale temps reel
- FR29 : Epic 5 — Indicateur progression condition de victoire
- FR30 : Epic 3 — Mise a jour instantanee via WebSocket
- FR31 : Epic 1 — Pages publiques consultables sur mobile
- FR32 : Epic 4 — Vue overlay /overlay dans OBS
- FR33 : Epic 4 — Overlay sans chrome UI
- FR34 : Epic 4 — Overlay optimise 16:9
- FR35 : Epic 4 — Overlay mise a jour instantanee
- FR36 : Epic 2 — Login admin
- FR37 : Epic 2 — Backoffice protege par auth
- FR38 : Epic 1 — Mentions legales RGPD

## Epic List

### Epic 1 : Site Vitrine & Inscription des Joueurs
Les joueurs peuvent decouvrir le tournoi et s'inscrire en ligne.
Init monorepo, schema Prisma, config Tailwind charte EDS, page de presentation (dates, format, cash prize, reglement), formulaire d'inscription 3 champs, mentions legales RGPD. Responsive mobile pour les pages publiques.
**FRs couverts :** FR1, FR2, FR25, FR31, FR38
**UX-DRs :** UX-DR1, UX-DR2, UX-DR3, UX-DR12, UX-DR13, UX-DR15, UX-DR16

### Epic 2 : Backoffice Admin & Moteur de Tournoi
L'admin peut gerer integralement une journee de qualification depuis le backoffice.
Auth admin (JWT), gestion des joueurs inscrits (liste, ajout manuel, retrait, drops), generation des lobbies (aleatoire R1 + systeme suisse), saisie des placements, calcul automatique des points/tiebreakers/moyenne, validation des rounds, enchainement jusqu'a 6 rounds, classement cumule sur 3 journees.
**FRs couverts :** FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR36, FR37
**UX-DRs :** UX-DR9, UX-DR10, UX-DR11

### Epic 3 : Classement Temps Reel (Public)
Les joueurs et spectateurs voient le classement se mettre a jour en direct pendant le tournoi.
WebSocket (Socket.IO), page qualifications avec tableau de classement complet, mise a jour instantanee apres validation admin, mise en valeur du top 8, indication des drops, responsive mobile.
**FRs couverts :** FR26, FR27, FR30
**UX-DRs :** UX-DR4, UX-DR5, UX-DR6, UX-DR15

### Epic 4 : Overlay Stream OBS
Le caster affiche un overlay professionnel en direct dans OBS.
Page /overlay sans elements d'interface, format 16:9, polices lisibles a distance, mise a jour instantanee via WebSocket, charte EDS.
**FRs couverts :** FR32, FR33, FR34, FR35
**UX-DRs :** UX-DR14

### Epic 5 : Phase Finale
L'admin peut lancer et gerer la finale avec detection automatique du vainqueur.
Identification des 8 qualifies (top 8 cumule), lobby unique finale, rounds illimites, detection condition de victoire (top 1 + >= 20 pts), page finale publique avec progression vers la victoire, animation du vainqueur.
**FRs couverts :** FR21, FR22, FR23, FR24, FR28, FR29
**UX-DRs :** UX-DR7, UX-DR8

### Epic 6 : Deploiement & Go-Live
Le site est deploye en production et pret pour le dry-run du 10 mai.
Config Docker + Traefik backend VPS, deploiement frontend Hostinger, HTTPS, CORS, backup PostgreSQL, dry-run complet avec SkyDow sur OBS.
**NFRs couverts :** NFR1-NFR12

## Epic 1 : Site Vitrine & Inscription des Joueurs

Les joueurs peuvent decouvrir le tournoi et s'inscrire en ligne. Init monorepo, schema Prisma, config Tailwind charte EDS, page de presentation, formulaire d'inscription, mentions legales RGPD.

### Story 1.1 : Init Projet & Design System EDS

As a **developpeur**,
I want **initialiser le monorepo avec le frontend (Vite 8 + React 19 + TypeScript + Tailwind), le backend (Express + Prisma 7 + TypeScript), le schema Prisma initial et la configuration Tailwind charte EDS**,
So that **le socle technique est pret et le design system EDS est configurable des la premiere page**.

**Acceptance Criteria:**

**Given** le projet n'existe pas encore
**When** j'execute les commandes d'initialisation
**Then** le monorepo contient deux packages `frontend/` et `backend/` avec leurs dependances installees
**And** le frontend demarre avec `npm run dev` sans erreur
**And** le backend demarre avec `npm run dev` sans erreur

**Given** le frontend est initialise
**When** je consulte la configuration Tailwind
**Then** les couleurs EDS sont configurees (#29265B, #80E2ED, #787C86, #EDEFFD, #DAB265, #FFFFFF)
**And** les typographies Bebas Neue et Roboto sont chargees via Google Fonts
**And** le dark mode utilise `#29265B` comme fond par defaut

**Given** le backend est initialise
**When** je consulte le schema Prisma
**Then** le modele `Player` existe avec les champs : id, discordPseudo, riotPseudo, email, status, createdAt
**And** la connexion a PostgreSQL est configuree via variable d'environnement

**Given** les deux packages sont initialises
**When** je verifie la structure du projet
**Then** le frontend suit la structure : `src/pages/`, `src/components/`, `src/hooks/`, `src/contexts/`, `src/services/`, `src/types/`
**And** le backend suit la structure : `src/routes/`, `src/services/`, `src/middleware/`, `src/websocket/`, `src/types/`
**And** TypeScript est en mode strict des deux cotes

### Story 1.2 : Page de Presentation du Tournoi

As a **visiteur**,
I want **consulter la page de presentation du tournoi avec les dates, le format, le cash prize et le reglement**,
So that **je peux decouvrir le tournoi et decider de m'inscrire**.

**Acceptance Criteria:**

**Given** je suis un visiteur sur la page d'accueil
**When** la page se charge
**Then** je vois une hero section avec le nom du tournoi en Bebas Neue Bold
**And** les informations essentielles sont visibles immediatement : dates des journees, format (qualifications + finale), cash prize
**And** le fond est en dark mode (#29265B) avec les accents cyan et or de la charte EDS

**Given** je suis sur la page d'accueil
**When** je cherche le reglement
**Then** le reglement est accessible via un accordeon ou un lien clairement visible
**And** le contenu du reglement inclut le format, le bareme de points et la condition de victoire en finale

**Given** je consulte la page depuis un mobile
**When** la page se charge
**Then** le contenu est lisible et navigable sans scroll horizontal
**And** les informations essentielles restent visibles sans devoir scroller excessivement

**Given** je consulte la page depuis un desktop
**When** la page se charge
**Then** la mise en page exploite l'espace disponible
**And** le chargement initial est inferieur a 2 secondes

### Story 1.3 : Inscription des Joueurs

As a **joueur**,
I want **m'inscrire au tournoi via un formulaire simple de 3 champs**,
So that **je peux participer au tournoi en moins de 30 secondes, sans creer de compte**.

**Acceptance Criteria:**

**Given** je suis sur la page d'accueil
**When** je remplis le formulaire avec mon pseudo Discord, mon pseudo Riot et mon email, puis je valide
**Then** mon inscription est enregistree en base de donnees
**And** je vois une confirmation a l'ecran que mon inscription est prise en compte

**Given** je remplis le formulaire
**When** je laisse un champ obligatoire vide ou je saisis un email invalide
**Then** un message d'erreur clair s'affiche a cote du champ concerne
**And** l'inscription n'est pas envoyee

**Given** je suis deja inscrit avec le meme pseudo Discord
**When** je tente de m'inscrire a nouveau
**Then** un message m'informe que ce pseudo est deja inscrit
**And** aucun doublon n'est cree en base

**Given** le formulaire est affiche
**When** je le consulte
**Then** le CTA d'inscription est clairement visible et mis en valeur (couleur d'accent)
**And** les 3 champs sont labels clairement : pseudo Discord, pseudo Riot, email

**Given** le backend recoit une requete POST /api/players
**When** les donnees sont valides
**Then** un joueur est cree avec le statut "inscrit"
**And** la reponse suit le format standard `{ data: { id, discordPseudo, riotPseudo } }` (email non expose)

### Story 1.4 : Mentions Legales RGPD

As a **visiteur**,
I want **consulter les mentions legales et la politique de confidentialite du site**,
So that **je sais comment mes donnees personnelles sont traitees, conformement au RGPD**.

**Acceptance Criteria:**

**Given** je suis sur n'importe quelle page du site
**When** je cherche les mentions legales
**Then** un lien vers les mentions legales est visible dans le footer du site

**Given** je clique sur le lien des mentions legales
**When** la page s'affiche
**Then** les mentions legales incluent : identite du responsable de traitement (EDS), finalite de la collecte (gestion du tournoi), donnees collectees (pseudo Discord, pseudo Riot, email), duree de conservation, droits des joueurs (acces, rectification, suppression)

**Given** je consulte les mentions legales sur mobile
**When** la page se charge
**Then** le contenu est lisible et correctement formate

## Epic 2 : Backoffice Admin & Moteur de Tournoi

L'admin peut gerer integralement une journee de qualification depuis le backoffice. Auth admin, gestion joueurs, generation lobbies, saisie resultats, systeme suisse, drops, classement cumule.

### Story 2.1 : Authentification Admin

As a **admin (Brice)**,
I want **me connecter au backoffice via un login simple (identifiant/mot de passe)**,
So that **le backoffice est protege et accessible uniquement par moi**.

**Acceptance Criteria:**

**Given** je suis sur la page `/admin/login`
**When** je saisis un identifiant et mot de passe valides et je valide
**Then** un token JWT est genere avec une expiration de 24h
**And** je suis redirige vers le backoffice `/admin`

**Given** je suis sur la page `/admin/login`
**When** je saisis des identifiants incorrects
**Then** un message d'erreur s'affiche ("Identifiants incorrects")
**And** je reste sur la page de login

**Given** je ne suis pas authentifie
**When** je tente d'acceder a une route `/admin/*`
**Then** je suis redirige vers `/admin/login`

**Given** je suis authentifie
**When** je fais une requete vers `/api/admin/*`
**Then** le header `Authorization: Bearer <token>` est verifie par le middleware
**And** la requete est traitee normalement

**Given** mon token JWT a expire (>24h)
**When** je fais une requete vers `/api/admin/*`
**Then** je recois une erreur 401
**And** je suis redirige vers la page de login

**Given** le mot de passe admin est stocke en base
**When** je verifie le stockage
**Then** le mot de passe est hashe avec bcrypt (jamais en clair)

### Story 2.2 : Gestion des Joueurs Inscrits

As a **admin**,
I want **consulter, ajouter et retirer des joueurs inscrits**,
So that **je peux preparer la liste des participants avant le jour J**.

**Acceptance Criteria:**

**Given** je suis authentifie sur le backoffice
**When** j'accede a la section joueurs
**Then** je vois la liste complete des joueurs inscrits avec pseudo Discord, pseudo Riot, email et statut

**Given** je suis sur la liste des joueurs
**When** je clique sur "Ajouter un joueur" et remplis les 3 champs (pseudo Discord, pseudo Riot, email)
**Then** le joueur est cree en base avec le statut "inscrit"
**And** il apparait immediatement dans la liste

**Given** je suis sur la liste des joueurs
**When** je clique sur "Retirer" a cote d'un joueur avant le debut du tournoi
**Then** le joueur est marque comme "absent"
**And** il n'apparait plus dans la liste des joueurs actifs

**Given** j'ajoute un joueur avec un pseudo Discord deja existant
**When** je valide
**Then** un message d'erreur m'informe du doublon
**And** aucun joueur n'est cree

### Story 2.3 : Demarrer une Journee & Generer les Lobbies (Round 1)

As a **admin**,
I want **demarrer une journee de qualification et generer les lobbies du Round 1 aleatoirement**,
So that **les joueurs sont repartis en lobbies et peuvent commencer a jouer**.

**Acceptance Criteria:**

**Given** je suis sur le backoffice avec des joueurs inscrits
**When** je clique sur "Demarrer la journee"
**Then** une nouvelle journee de qualification est creee (Day)
**And** le premier round est initialise

**Given** une journee est demarree avec 28 joueurs actifs
**When** je clique sur "Generer les lobbies"
**Then** les joueurs sont repartis aleatoirement en lobbies de 8 maximum
**And** le systeme cree 3 lobbies de 8 et 1 lobby de 4

**Given** 32 joueurs actifs (multiple de 8)
**When** je genere les lobbies
**Then** 4 lobbies de 8 joueurs sont crees sans lobby incomplet

**Given** 15 joueurs actifs
**When** je genere les lobbies
**Then** le systeme cree 1 lobby de 8 et 1 lobby de 7
**And** aucun lobby n'a moins de joueurs que necessaire

**Given** les lobbies sont generes
**When** je consulte le round
**Then** je vois la composition de chaque lobby (numeros de lobby + liste des joueurs)
**And** la vue d'ensemble affiche tous les lobbies d'un coup (UX-DR10)
**And** le bouton "Generer les lobbies" est un gros bouton bien visible (UX-DR11)

### Story 2.4 : Saisie des Placements & Calcul des Points

As a **admin**,
I want **saisir les placements de chaque joueur et valider le round pour que les points soient calcules automatiquement**,
So that **le classement est mis a jour en moins de 5 minutes apres la fin d'un round**.

**Acceptance Criteria:**

**Given** les lobbies d'un round sont generes
**When** je saisis les placements pour un lobby
**Then** je peux attribuer un placement (1 a 8) a chaque joueur du lobby
**And** la saisie est rapide via dropdown ou clic rapide (UX-DR9)
**And** la latence de saisie est inferieure a 200ms

**Given** je saisis les placements d'un lobby
**When** j'attribue le meme placement a deux joueurs
**Then** un message d'erreur m'empeche de valider (chaque placement est unique dans un lobby)

**Given** un lobby de 7 joueurs (incomplet)
**When** je saisis les placements
**Then** seuls les placements 1 a 7 sont disponibles

**Given** tous les placements de tous les lobbies sont saisis
**When** je clique sur "Valider le round" (gros bouton — UX-DR11)
**Then** les points sont calcules automatiquement selon le bareme (1er = 8 pts, 8e = 1 pt)
**And** le score cumule de chaque joueur est mis a jour
**And** les tiebreakers sont calcules (nombre de top 1, nombre de top 4, resultat derniere game)
**And** la moyenne de points par round est calculee pour chaque joueur
**And** le round est marque comme valide

**Given** je tente de valider un round
**When** des placements manquent dans un ou plusieurs lobbies
**Then** la validation est bloquee avec un message indiquant les lobbies incomplets

### Story 2.5 : Systeme Suisse & Rounds Suivants

As a **admin**,
I want **generer les lobbies des rounds suivants selon le classement (systeme suisse) et enchainer jusqu'a 6 rounds**,
So that **les joueurs de niveau similaire s'affrontent progressivement, comme dans l'ancien Excel**.

**Acceptance Criteria:**

**Given** le round 1 est valide et le classement est calcule
**When** je clique sur "Generer les lobbies" pour le Round 2
**Then** les joueurs sont redistribues selon le systeme suisse : les mieux classes ensemble, les moins bien classes ensemble
**And** les lobbies respectent la taille maximale de 8 joueurs

**Given** le classement apres un round est : J1 (24pts), J2 (22pts), ..., J16 (5pts)
**When** je genere les lobbies suisse
**Then** le lobby 1 contient les joueurs classes 1 a 8
**And** le lobby 2 contient les joueurs classes 9 a 16

**Given** un nombre de joueurs non multiple de 8 (ex: 27)
**When** je genere les lobbies suisse
**Then** le dernier lobby est incomplet (ex: 3 joueurs)
**And** les joueurs les moins bien classes sont dans le lobby incomplet

**Given** j'ai termine autant de rounds que souhaite pour une journee
**When** je clique sur le bouton explicite "Terminer la journee" apres validation d'un round
**Then** la journee passe en statut "completed"
**And** plus aucun bouton "Generer les lobbies" n'apparait pour cette journee
**And** il n'y a pas de limite dure sur le nombre de rounds (la fin est manuelle, decidee par l'admin)

**Given** je suis au round 3
**When** je genere les lobbies du round 4
**Then** la redistribution utilise le classement cumule de tous les rounds precedents de la journee

### Story 2.6 : Gestion des Drops

As a **admin**,
I want **marquer un joueur comme "drop" en cours de journee**,
So that **le joueur est retire des rounds suivants sans perdre ses points acquis**.

**Acceptance Criteria:**

**Given** un joueur est actif dans la journee en cours
**When** je clique sur "Marquer drop" a cote de son nom (gros bouton — UX-DR11)
**Then** le joueur est marque avec le statut "drop"
**And** une confirmation est demandee avant validation

**Given** un joueur est marque "drop"
**When** les lobbies du round suivant sont generes
**Then** le joueur droppe n'est pas inclus dans les lobbies
**And** le nombre total de joueurs actifs est diminue d'un

**Given** un joueur est marque "drop"
**When** je consulte le classement
**Then** ses points acquis avant le drop sont conserves dans le classement
**And** sa moyenne est calculee sur les rounds effectivement joues

**Given** un joueur droppe etait dans un lobby de 8
**When** les lobbies suivants sont generes
**Then** la redistribution tient compte du nombre reduit de joueurs
**And** un lobby peut passer a 7 joueurs ou moins

### Story 2.7 : Classement Cumule Multi-Journees

As a **admin**,
I want **que le classement soit cumule sur les 3 journees de qualification**,
So that **la qualification pour la finale reflete la performance globale des joueurs sur toute la phase de qualifications**.

**Acceptance Criteria:**

**Given** la journee 1 est terminee avec des scores
**When** je demarre la journee 2
**Then** le classement affiche les scores cumules (journee 1 + journee 2)
**And** les tiebreakers sont recalcules sur l'ensemble des rounds joues

**Given** un joueur a joue la journee 1 (score: 30) et la journee 2 (score: 25)
**When** je consulte le classement apres la journee 2
**Then** son score total affiche 55
**And** sa moyenne est calculee sur le total de rounds joues sur les 2 journees

**Given** un joueur a droppe lors de la journee 1 apres 3 rounds
**When** il participe normalement a la journee 2 (6 rounds)
**Then** son score cumule inclut les 3 rounds de J1 + les 6 rounds de J2
**And** sa moyenne est calculee sur 9 rounds

**Given** les 3 journees de qualification sont terminees
**When** je consulte le classement final
**Then** les joueurs sont ordonnes par score total cumule
**And** en cas d'egalite, les tiebreakers departitionnent (top 1 > top 4 > derniere game)

## Epic 3 : Classement Temps Reel (Public)

Les joueurs et spectateurs voient le classement se mettre a jour en direct pendant le tournoi. WebSocket (Socket.IO), page qualifications avec tableau complet, mise a jour instantanee.

### Story 3.1 : WebSocket & Infrastructure Temps Reel

As a **visiteur (joueur ou spectateur)**,
I want **que les donnees du site se mettent a jour automatiquement sans recharger la page**,
So that **je vois les resultats en direct pendant le tournoi**.

**Acceptance Criteria:**

**Given** le backend est demarre
**When** un client se connecte au namespace Socket.IO `/tournament`
**Then** la connexion WebSocket est etablie
**And** le client recoit l'etat actuel du tournoi (classement, phase en cours)

**Given** l'admin valide un round dans le backoffice
**When** la validation est enregistree en base
**Then** le serveur broadcast l'evenement `ranking_updated` a tous les clients connectes
**And** le payload suit le format standardise `{ event, timestamp, data }`
**And** la mise a jour arrive en moins de 2 secondes apres validation

**Given** l'admin change la phase du tournoi (demarrage journee, fin journee)
**When** le changement est enregistre
**Then** le serveur broadcast l'evenement `tournament_state_changed`

**Given** un client est connecte via WebSocket
**When** la connexion est interrompue (perte reseau mobile)
**Then** Socket.IO tente automatiquement la reconnexion
**And** apres reconnexion, le client recoit l'etat actuel du classement

**Given** le frontend recoit un evenement WebSocket
**When** l'evenement est `ranking_updated`
**Then** le `TournamentContext` est mis a jour avec les nouvelles donnees
**And** tous les composants abonnes au contexte se re-rendent automatiquement

**Given** ~30 clients sont connectes simultanement
**When** l'admin valide un round
**Then** tous les clients recoivent la mise a jour sans degradation de performance

### Story 3.2 : Page Qualifications & Tableau de Classement

As a **joueur**,
I want **consulter le classement des qualifications en temps reel sur mon telephone**,
So that **je connais ma position et mon score entre deux rounds sans dependre du cast**.

**Acceptance Criteria:**

**Given** je suis sur la page `/qualifications`
**When** la page se charge
**Then** je vois un tableau de classement avec les colonnes : rang, pseudo, placements par round, points par round, score total, tiebreakers (top 1, top 4, derniere game), moyenne
**And** les joueurs sont ordonnes par score total decroissant puis tiebreakers

**Given** le tableau est affiche
**When** je regarde les 8 premiers joueurs
**Then** la zone top 8 est visuellement distinguee par une couleur d'accent ou bordure (UX-DR5)
**And** la separation entre le 8e et le 9e est clairement visible

**Given** un joueur est marque "drop"
**When** je consulte le tableau
**Then** la ligne du joueur droppe est grisee ou barree (UX-DR6)
**And** son score reste visible dans le classement

**Given** le tableau est affiche
**When** je verifie le style visuel
**Then** les lignes sont alternees pour faciliter la lecture (UX-DR4)
**And** la taille de police est genereuse, lisible a distance
**And** les couleurs d'accent (cyan, or) guident l'oeil sur les informations cles (UX-DR15)

**Given** l'admin valide un round pendant que je suis sur la page
**When** l'evenement `ranking_updated` arrive via WebSocket
**Then** le tableau se met a jour automatiquement sans rechargement
**And** les nouvelles positions et scores sont visibles instantanement

**Given** je consulte la page sur mobile
**When** la page se charge
**Then** le tableau est lisible sans scroll horizontal excessif
**And** les colonnes essentielles (rang, pseudo, score total) restent visibles
**And** les colonnes secondaires (placements par round) peuvent defiler horizontalement si necessaire

**Given** je consulte la page sur desktop
**When** la page se charge
**Then** toutes les colonnes sont visibles
**And** le chargement initial est inferieur a 2 secondes

## Epic 4 : Overlay Stream OBS

Le caster affiche un overlay professionnel en direct dans OBS. Page /overlay sans elements d'interface, format 16:9, mise a jour instantanee via WebSocket.

### Story 4.1 : Overlay Stream OBS

As a **caster (SkyDow)**,
I want **afficher une page overlay dans OBS qui montre le classement en direct, sans elements d'interface**,
So that **le stream donne une image professionnelle du tournoi EDS**.

**Acceptance Criteria:**

**Given** je configure OBS
**When** j'ajoute l'URL `/overlay` comme source navigateur
**Then** la page s'affiche correctement dans OBS
**And** aucun element d'interface n'est visible (pas de barre de navigation, pas de header, pas de footer, pas de scrollbar)

**Given** la page overlay est chargee
**When** je regarde l'affichage
**Then** le classement est affiche en format 16:9
**And** les polices sont grandes et lisibles a distance (taille adaptee au stream)
**And** la charte EDS est respectee (fond #29265B, accents cyan/or, typographies Bebas Neue + Roboto)

**Given** la page overlay est chargee
**When** je verifie le contenu affiche
**Then** le classement affiche : rang, pseudo, score total et informations cles
**And** le top 8 est visuellement distingue
**And** les joueurs droppes sont indiques visuellement

**Given** l'admin valide un round dans le backoffice
**When** l'evenement `ranking_updated` arrive via WebSocket
**Then** l'overlay se met a jour instantanement sans rechargement
**And** la transition est fluide (pas de flash blanc, pas de clignotement)

**Given** l'overlay est connecte via WebSocket
**When** la connexion est temporairement interrompue
**Then** Socket.IO reconnecte automatiquement
**And** l'overlay recupere l'etat actuel du classement sans intervention du caster

**Given** la page overlay est chargee dans OBS
**When** aucun round n'a encore ete valide
**Then** un etat d'attente est affiche (logo EDS ou message "En attente des resultats")
**And** pas d'ecran vide ou d'erreur

## Epic 5 : Phase Finale

L'admin peut lancer et gerer la finale avec detection automatique du vainqueur. Identification top 8, lobby unique, rounds illimites, condition de victoire, page finale publique.

### Story 5.1 : Qualification pour la Finale & Lancement

As a **admin**,
I want **identifier les 8 qualifies et lancer la phase finale en un seul lobby**,
So that **la finale demarre rapidement apres les qualifications sans manipulation complexe**.

**Acceptance Criteria:**

**Given** les 3 journees de qualification sont terminees
**When** je consulte le classement cumule dans le backoffice
**Then** les 8 premiers joueurs sont identifies comme qualifies pour la finale
**And** en cas d'egalite au 8e rang, les tiebreakers departitionnent

**Given** les 8 qualifies sont identifies
**When** je clique sur "Demarrer la finale"
**Then** une journee de type "finale" est creee
**And** un lobby unique de 8 joueurs est automatiquement genere avec les 8 qualifies
**And** le premier round de la finale est initialise

**Given** la finale est demarree
**When** je consulte le backoffice
**Then** le systeme indique clairement que nous sommes en phase finale
**And** la generation de lobbies n'est plus necessaire (lobby unique fixe)

### Story 5.2 : Rounds de Finale & Detection de Victoire

As a **admin**,
I want **enchainer des rounds de finale jusqu'a ce qu'un joueur remplisse la condition de victoire (top 1 + >= 20 points cumules)**,
So that **la finale se deroule fluidement avec une detection automatique du vainqueur**.

**Acceptance Criteria:**

**Given** un round de finale est en cours
**When** je saisis les placements des 8 finalistes et je valide le round
**Then** les points sont calcules selon le meme bareme (1er = 8 pts, 8e = 1 pt)
**And** le score cumule de la finale est mis a jour pour chaque joueur

**Given** un joueur a 22 points cumules en finale
**When** il termine 1er (top 1) d'un round
**Then** le systeme detecte automatiquement que la condition de victoire est remplie (top 1 + >= 20 pts)
**And** un message clair indique le vainqueur dans le backoffice
**And** la finale est marquee comme terminee

**Given** un joueur termine 1er d'un round mais a seulement 15 points cumules
**When** je valide le round
**Then** la condition de victoire n'est PAS declenchee
**And** la finale continue normalement au round suivant

**Given** un joueur a 25 points cumules mais termine 3e
**When** je valide le round
**Then** la condition de victoire n'est PAS declenchee (top 1 requis)
**And** la finale continue normalement

**Given** aucun joueur n'a rempli la condition apres un round
**When** je consulte le backoffice
**Then** je peux lancer un nouveau round sans limite (pas de maximum de rounds en finale)
**And** le lobby reste identique (les memes 8 joueurs)

### Story 5.3 : Page Finale Publique & Progression Victoire

As a **spectateur ou joueur**,
I want **suivre la finale en temps reel avec un indicateur de progression vers la condition de victoire**,
So that **je comprends ou en est chaque finaliste et quand la victoire se joue**.

**Acceptance Criteria:**

**Given** je suis sur la page `/finale`
**When** la finale est en cours
**Then** je vois un tableau avec les 8 finalistes : rang, pseudo, placements par round, score cumule finale

**Given** le tableau de la finale est affiche
**When** je regarde chaque finaliste
**Then** un indicateur de progression vers la condition de victoire est visible (UX-DR7)
**And** l'indicateur montre les points cumules par rapport au seuil de 20
**And** l'indicateur montre si le joueur a deja fait un top 1 en finale

**Given** un joueur remplit la condition de victoire
**When** le round est valide par l'admin
**Then** le vainqueur est mis en avant avec une animation ou une mise en valeur forte en or (#DAB265) (UX-DR8)
**And** le classement final est affiche

**Given** l'admin valide un round de finale
**When** l'evenement arrive via WebSocket
**Then** le tableau et les indicateurs de progression se mettent a jour instantanement

**Given** je consulte la page finale sur mobile
**When** la page se charge
**Then** le tableau et les indicateurs sont lisibles
**And** l'information essentielle (classement, progression victoire) reste accessible

**Given** la finale n'a pas encore commence
**When** je consulte la page `/finale`
**Then** un message indique que la finale n'est pas encore en cours
**And** la liste des 8 qualifies est affichee si les qualifications sont terminees

## Epic 6 : Deploiement & Go-Live

Le site est deploye en production et pret pour le dry-run du 10 mai. VPS Hostinger (Ubuntu 24.04, 76.13.58.249), Docker, Traefik, container PostgreSQL dedie, container nginx frontend, DNS Hostinger, HTTPS Let's Encrypt, backup, dry-run complet.

> **Contexte infra (decision retro Epic 5 2026-04-24)** : VPS Hostinger fraichement provisionne, rien d'installe. DNS `esportdessacres.fr` gere chez Hostinger (Brice a acces). Architecture retenue : **tout sur le meme VPS** (backend Node + PG + frontend nginx + Traefik). Pas d'hosting FTP separe.

### Story 6.1 : Preparation VPS + Deploiement Backend Docker & Traefik

As a **admin**,
I want **que le VPS Hostinger (Ubuntu 24.04) soit durci et que le backend + PostgreSQL soient deployes en Docker derriere Traefik**,
So that **l'API et le WebSocket sont accessibles en production via HTTPS sur `api-tournoi.esportdessacres.fr`, avec un socle infra reproductible et securise**.

**Pre-requis contextuels :**

- VPS Hostinger Ubuntu 24.04 neuf, IP `76.13.58.249`, acces `ssh root@76.13.58.249`
- Domaine `esportdessacres.fr` gere chez Hostinger (DNS accessible a Brice)
- Aucun service pre-installe (pas de Docker, Traefik, PG) — tout a bootstrapper sur un VPS propre

**Acceptance Criteria:**

**Given** le VPS est fraichement provisionne
**When** je durcis l'acces SSH et reseau
**Then** la connexion SSH par mot de passe root est desactivee (cle publique uniquement, `PermitRootLogin prohibit-password` ou `without-password`)
**And** une cle SSH publique est deposee pour l'acces maintenance (machine de dev de Brice)
**And** UFW est active avec uniquement les ports 22, 80 et 443 ouverts vers l'exterieur
**And** fail2ban est installe et actif (jail SSH activee)

**Given** le VPS est securise
**When** j'installe les dependances runtime
**Then** Docker Engine + Docker Compose v2 sont installes et actifs (`systemctl enable --now docker`)
**And** la documentation du mode d'acces (root vs utilisateur dedie au deploiement) est tracee dans `README.md`
**And** la version de Docker / Compose est capturee dans le runbook

**Given** Docker est operationnel
**When** je prepare le compose de production
**Then** un fichier `docker-compose.prod.yml` existe (ou equivalent) definissant au minimum : service Traefik v3, service PostgreSQL, service backend Node.js
**And** un reseau Docker dedie (ex: `tournoi-net`) connecte les services entre eux
**And** les secrets (`JWT_SECRET`, `DATABASE_URL`, password admin, etc.) sont fournis via `.env` non commite
**And** le PostgreSQL utilise un volume Docker persistant (ex: `tournoi-pg-data`) et n'est PAS expose sur l'Internet (uniquement accessible via le reseau Docker interne)

**Given** le compose est pret
**When** je lance `docker compose up -d`
**Then** Traefik demarre, ecoute sur 80/443, et reclame les certificats Let's Encrypt automatiquement (provider HTTP-01, env staging d'abord pour valider sans bruler les rate limits prod, puis bascule en prod)
**And** le container PG demarre et cree la base du projet
**And** le container backend Node.js demarre et se connecte au PG via le reseau Docker interne
**And** aucun container n'expose de port inutile sur 0.0.0.0

**Given** les containers tournent
**When** Traefik lit les labels du container backend
**Then** le sous-domaine `api-tournoi.esportdessacres.fr` est route vers le backend en HTTPS
**And** le certificat Let's Encrypt est genere automatiquement et renouvele seul
**And** HTTP (port 80) est redirige vers HTTPS (port 443) pour ce domaine

**Given** le DNS est configure
**When** je verifie la resolution
**Then** l'enregistrement DNS A `api-tournoi.esportdessacres.fr` pointe vers `76.13.58.249`
**And** la propagation est confirmee (dig/nslookup) avant d'emettre le certificat prod Let's Encrypt

**Given** le backend est route par Traefik
**When** le frontend (ou un client test) fait une requete depuis `https://tournoi.esportdessacres.fr`
**Then** le CORS accepte la requete (origine autorisee explicitement)
**And** les requetes depuis d'autres origines sont rejetees

**Given** le schema Prisma est pret
**When** je lance `npx prisma migrate deploy` dans le container backend
**Then** les tables sont creees dans le container PG
**And** le seed admin (identifiant + mot de passe hashe bcrypt) est insere
**And** les valeurs de seed sont lues depuis `.env` (pas hardcodees)

**Given** le backend est deploye
**When** je verifie l'etat de l'API de bout en bout
**Then** `GET /api/tournament/current` repond correctement en HTTPS sur `api-tournoi.esportdessacres.fr`
**And** la connexion WebSocket Socket.IO est fonctionnelle depuis un navigateur (handshake + namespace `/tournament`)

**Given** le backend est en production
**When** je prepare la strategie de backup
**Then** un script de backup PG (`pg_dump` depuis le container vers un dossier persistant hors volume Docker, ex: `/root/backups/`) est ecrit et documente
**And** le script est execute manuellement au moins une fois avec succes avant le dry-run
**And** la procedure de restauration (drop / restore) est testee sur une base locale
**And** les backups ne contiennent pas les secrets applicatifs (seulement les donnees du tournoi)

### Story 6.2 : Deploiement Frontend (Container nginx derriere Traefik)

As a **admin**,
I want **que le frontend soit servi par un container nginx sur le meme VPS que le backend, derriere Traefik, en HTTPS**,
So that **les joueurs et spectateurs accedent au site via `tournoi.esportdessacres.fr` sans dependre d'un hosting web separe**.

**Pre-requis contextuels :**

- Story 6.1 completee (VPS securise, Docker + Traefik + PG + backend operationnels)
- Domaine `esportdessacres.fr` gere chez Hostinger (DNS accessible a Brice)
- Frontend buildable localement (Vite, `dist/` ~148 kB gz apres Epic 5)

**Acceptance Criteria:**

**Given** le code frontend est pret
**When** je lance `npm run build` (localement ou sur le VPS)
**Then** le dossier `dist/` est genere avec les fichiers HTML/CSS/JS optimises
**And** la variable d'environnement `VITE_API_URL` pointe vers `https://api-tournoi.esportdessacres.fr` (via `.env.production` ou equivalent)

**Given** le build `dist/` est pret
**When** je prepare le container frontend
**Then** une image nginx minimale (`nginx:alpine`) sert `dist/` — soit via un volume bind, soit via une image multi-stage build (stage 1 `node:alpine` qui fait `npm ci && npm run build`, stage 2 `nginx:alpine` qui copie `dist/` dans `/usr/share/nginx/html`)
**And** la config nginx inclut le fallback SPA : `try_files $uri $uri/ /index.html;` pour que `/qualifications`, `/finale`, `/admin`, etc. soient accessibles directement par URL sans 404
**And** le container frontend est connecte au meme reseau Docker que Traefik (`tournoi-net` ou equivalent)

**Given** le container frontend est demarre
**When** Traefik lit ses labels
**Then** le domaine `tournoi.esportdessacres.fr` est route vers le container nginx en HTTPS
**And** le certificat Let's Encrypt est genere automatiquement (partage la meme config `certificatesResolvers` Traefik que Story 6.1)
**And** HTTP (port 80) est redirige vers HTTPS pour ce domaine

**Given** le DNS est configure
**When** je verifie la resolution
**Then** l'enregistrement DNS A `tournoi.esportdessacres.fr` pointe vers `76.13.58.249`
**And** la propagation est confirmee (dig/nslookup) avant d'emettre le certificat prod

**Given** le site est deploye
**When** un visiteur accede a `/qualifications`, `/finale` ou `/admin` directement par URL
**Then** la page se charge correctement (fallback SPA OK, pas de 404 nginx)

**Given** le site est deploye
**When** je verifie le chargement
**Then** la page d'accueil charge en moins de 2 secondes (desktop reseau standard)
**And** les polices Bebas Neue et Roboto se chargent correctement
**And** le design charte EDS s'affiche sans erreur
**And** les assets (logos partenaires WebP, fontes, icones) sont servis avec des headers de cache corrects (ex: `Cache-Control: public, max-age=31536000, immutable` pour les fichiers hashes Vite)

**Given** le backend et le frontend sont tous deux deployes
**When** le frontend fait des requetes vers `api-tournoi.esportdessacres.fr`
**Then** le CORS cote backend autorise explicitement `https://tournoi.esportdessacres.fr`
**And** la connexion WebSocket Socket.IO aboutit depuis le frontend
**And** aucun mixed-content warning n'apparait dans la console navigateur

**Given** une nouvelle version du frontend doit etre deployee
**When** je suis le workflow de deploiement documente
**Then** la procedure est reproductible (ex : option A — build local puis `scp` du `dist/` vers le VPS + `docker compose restart frontend` ; option B — `git pull` sur le VPS + `docker compose build frontend && docker compose up -d frontend`)
**And** le workflow retenu est documente dans `README.md` (section Deploy)
**And** le redeploiement nginx prend moins de 3 secondes (downtime perceptible minimal)

### Story 6.3 : Dry-Run & Validation Go-Live

As a **admin (Brice) et caster (SkyDow)**,
I want **realiser un dry-run complet du tournoi avant le 10 mai**,
So that **le site est valide de bout en bout et pret pour le jour J du 17 mai**.

**Acceptance Criteria:**

**Given** le frontend et le backend sont deployes en production
**When** je deroule un scenario complet de tournoi (inscription → lobbies → saisie → validation → classement → finale)
**Then** chaque etape fonctionne sans erreur
**And** le classement se met a jour en temps reel cote public

**Given** SkyDow configure OBS avec l'overlay `/overlay`
**When** je valide un round dans le backoffice
**Then** l'overlay se met a jour instantanement dans OBS
**And** l'affichage est professionnel en 16:9

**Given** un joueur consulte le classement sur mobile
**When** un round est valide
**Then** la mise a jour arrive en moins de 2 secondes
**And** le tableau est lisible sur ecran mobile

**Given** le dry-run simule une journee complete
**When** je verifie les performances
**Then** la saisie d'un round complet (4 lobbies × 8 joueurs) prend moins de 5 minutes
**And** aucune perte de donnees n'est constatee

**Given** le dry-run est termine
**When** je verifie la base de donnees
**Then** un backup manuel de PostgreSQL est realisable sans erreur
**And** la procedure de backup est documentee

**Given** le dry-run revele des problemes
**When** je les identifie
**Then** il reste au minimum 1 semaine avant le 17 mai pour corriger (dry-run au plus tard le 10 mai)
