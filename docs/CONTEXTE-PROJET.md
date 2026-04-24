# Tournoi TFT — Esport des Sacres (EDS)

## Résumé

Site web autonome pour organiser des tournois TFT (Teamfight Tactics) au sein de l'association Esport des Sacres (Reims). Le site remplace un fichier Excel avec macros VBA actuellement utilisé pour gérer les tournois. Il comprend 3 pages publiques + un backoffice admin.

## L'association

- **Esport des Sacres (EDS)** — association esport fondée en 2022 à Reims
- Site actuel : esportdessacres.fr (non lié à ce projet)
- Équipes : EVA, TFT, Street Fighter, Rocket League
- Contact : esportdessacres@gmail.com
- Réseaux : Discord, Instagram, LinkedIn, X

## Format du tournoi

Le tournoi se reproduit à chaque nouveau set TFT (~tous les 4 mois). Une édition = 4 dates, un dimanche sur deux :

- **3 journées de qualification** (ex: 17 mai, 31 mai, 14 juin)
- **1 finale** (ex: 28 juin)

### Qualifications

- Max **32 joueurs** inscrits
- Un match TFT = **8 joueurs** (1 lobby)
- 32 joueurs = **4 lobbies** simultanés
- Nombre de rounds par journée libre (l'admin termine la journée via le bouton "Terminer la journee")
- **Journée 1, Round 1 (J1R1)** : **seule** répartition aléatoire (`generateRandomLobbies`). Tous les autres rounds (J1R2+, J2R1+, J3R1+) utilisent le système suisse.
- **Système suisse** : trie les joueurs actifs selon le **classement cumulé multi-journées** (toutes journées qualif validées confondues), puis répartit en lobbies. Tiebreakers : top1Count, top4Count, lastGameResult.
- Classement cumulé sur les 3 journées → les **top 8** sont qualifiés pour la finale

### Barème de points (qualifications et finale)

| Place dans le lobby | Points |
|---------------------|--------|
| 1er | 8 |
| 2e | 7 |
| 3e | 6 |
| 4e | 5 |
| 5e | 4 |
| 6e | 3 |
| 7e | 2 |
| 8e | 1 |

### Tiebreakers (en cas d'égalité de score)

1. Nombre de top 1
2. Nombre de top 4
3. Résultat de la dernière game

### Finale

- **8 joueurs** qualifiés = **1 seul lobby fixe** sur tous les rounds (les mêmes 8 joueurs s'affrontent à chaque round, pas de redistribution).
- Même barème de points
- **Rounds illimités** : la finale continue tant que personne n'a gagné
- **Condition de victoire** : faire un **top 1** après avoir accumulé au moins **20 points** (seuil inclusif `>= 20`). Détection automatique côté backend lors de la validation du round → `Day.status = 'completed'` + diffusion WebSocket du `winner` à tous les clients.
- Aucun bouton "Régénérer les lobbies" en finale (lobby fixe). Backend défensif via garde `FINALE_LOBBY_IS_FIXED`.

### Cash prize (saison 1)

- Qualifications : 10€ pour le 1er de chaque journée (3 × 10€ = 30€)
- Finale : 50€ (1er) / 30€ (2e) / 20€ (3e) / 10€ (4e)
- Total : 140€ par édition, versé par virement bancaire

## Structure du site — 3 pages publiques

### Page 1 : Présentation + Inscription

- Présentation rapide du tournoi (format, dates, cash prize)
- Formulaire d'inscription : **pseudo Discord** + **pseudo Riot Games** + **email**
- Règlement (intégré ou lien)
- Prochaines dates

### Page 2 : Tableau des résultats (qualifications)

- Classement en temps réel pendant le tournoi
- Pour chaque joueur : pseudo, placement par round, points par round, score total, tiebreakers (top 1, top 4, dernière game), moyenne
- Mise à jour live quand l'admin saisit les résultats dans le backoffice
- Classement cumulé sur les 3 journées de qualification

### Page 3 : Finale

- Les 8 finalistes
- Tableau des résultats round par round
- Indicateur de progression vers la condition de victoire (points cumulés + a fait top 1 ?)
- Classement final

## Backoffice (admin)

Interface réservée aux organisateurs pour gérer le tournoi le jour J.

### Gestion des éditions

- Créer une nouvelle édition (une par set TFT)
- Réinitialiser les inscriptions pour la nouvelle édition
- Conserver l'historique des éditions précédentes

### Gestion des joueurs

- Voir la liste des inscrits (pseudo Discord, pseudo Riot, email)
- Gérer les drops (abandon en cours de tournoi)
- Ajout manuel si besoin

### Gestion du tournoi (jour J)

1. **Démarrer une journée** (qualification ou finale)
2. **J1R1** : génération aléatoire des lobbies. **Tous les autres rounds qualif** (y compris J2R1, J3R1) : tri suisse selon le classement cumulé multi-journées.
3. **Saisir les placements** : l'admin entre le classement (1-8) de chaque joueur après la game
4. **Valider le round** : points calculés automatiquement, classement mis à jour
5. **Rounds suivants** : le système redistribue les joueurs dans les lobbies selon le classement cumulé (système suisse)
6. Répéter jusqu'à la fin de la journée
7. **Finale** : même flux mais lobby unique fixe (pas de génération/régénération possible). Le système détecte automatiquement la victoire (top 1 + ≥ 20 points cumulés finale) lors de la validation du round et clôture la finale.

### Gestion des drops

- Marquer un joueur comme "drop" en cours de journée
- Le joueur est retiré des lobbies suivants
- Ses points acquis restent au classement

## Hors scope (MVP)

- Pas d'intégration avec esportdessacres.fr
- Pas de profils joueurs avancés
- Pas d'intégration API Riot Games
- Pas de système de paiement
- Pas de chat / forum

## Équipe orga

| Pseudo | Rôle |
|--------|------|
| Soulsiegfried (Brice) | Orga principal, dev du site, trésorerie |
| SkyDow | Cast, règlement, gestion bracket jour J |
| Geffreys | Conseil format, orga |
| Simon | Orga |

## Fichier de référence

Le fichier Excel `Tournoi Suisse hebdo GRG 145.xlsx` contient la logique métier actuelle avec 5 onglets :

1. **Liste des joueurs** — inscription (pseudo Riot + Discord), config (nb joueurs, taille lobbies, nb lobbies), macros VBA pour générer les poules
2. **Placement & score** — tableau principal avec placements par round, points, score total, tiebreakers, drops, moyenne (jusqu'à 48 joueurs, 6 rounds)
3. **TAS** (Tableau d'Assemblage Suisse) — logique de redistribution des joueurs dans les lobbies entre les rounds
4. **Finale** — même structure que le tableau principal, pour la phase finale (8 joueurs, jusqu'à 8 rounds)
5. **Calcul des points** — barème (1er=8pts → 8e=1pt) et définition des tiebreakers
