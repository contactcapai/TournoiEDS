---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain-skipped
  - step-06-innovation-skipped
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief.md
  - docs/CONTEXTE-PROJET.md
  - docs/UX-DESIGN.md
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 2
classification:
  projectType: web_app
  domain: esport_event_management
  complexity: low
  projectContext: greenfield
workflowType: 'prd'
---

# Product Requirements Document - Tournoi TFT EDS

**Author:** Brice
**Date:** 2026-04-15

## Executive Summary

L'Esport des Sacres (EDS), association esport rémoise, organise des tournois TFT (Teamfight Tactics) récurrents à chaque nouveau set (~tous les 4 mois). La gestion actuelle repose entièrement sur un fichier Excel avec macros VBA : inscriptions, répartition en lobbies, saisie des placements, classement et système suisse. Ce système est lent, fragile et inadapté au direct.

Ce projet est un **site web autonome** qui remplace cet Excel par une expérience propre et professionnelle. Les joueurs s'inscrivent en ligne, consultent le classement en temps réel sur leur téléphone, et le caster dispose d'un overlay dédié pour le stream. L'admin gère le tournoi depuis un backoffice rapide et fonctionnel.

**Utilisateurs cibles :** les joueurs (jusqu'à 32), l'organisateur principal (Brice), et le caster (SkyDow).

**Échéance critique :** le tournoi du Set 17 démarre le **17 mai 2026** — le site doit être opérationnel à cette date, sans retour possible à l'Excel.

### Ce qui rend ce projet spécial

Aucune plateforme de tournoi existante (Toornament, Start.gg, Battlefy, Challengermode) ne gère le **système suisse pour des lobbies de 8 joueurs**. Leur Swiss system est conçu pour du 1v1. Les organisateurs TFT retombent systématiquement sur Excel — ce projet résout un problème réel que personne ne couvre.

C'est un outil interne EDS, taillé sur mesure pour le format exact du tournoi, sans compromis ni fonctionnalités superflues. L'objectif est de donner à l'EDS une image professionnelle le jour J : un site fluide, un overlay propre, des joueurs autonomes — une vitrine du savoir-faire de l'association en organisation de tournois.

## Project Classification

- **Type de projet :** Web App MPA (multi-pages, temps réel via WebSocket, responsive, overlay stream)
- **Domaine :** Esport / Gestion d'événements de tournois
- **Complexité :** Faible — logique métier bien définie, pas de contraintes réglementaires lourdes, public restreint
- **Contexte projet :** Greenfield — construction from scratch

## Success Criteria

### Succès utilisateur

- Les joueurs consultent le classement en autonomie sur mobile pendant le tournoi, sans dépendre du cast
- L'inscription fonctionne sans friction (3 champs, pas de compte à créer)
- L'overlay stream est lisible et professionnel pour les spectateurs

### Succès business

- Le tournoi du **17 mai 2026** se déroule intégralement sur le site, sans retour à l'Excel
- Le site sert de **vitrine du savoir-faire EDS** en organisation de tournois
- Dry-run complet avant le **10 mai** (test end-to-end avec SkyDow sur OBS)

### Succès technique

- Mise à jour **instantanée** des résultats (WebSocket) — un seul utilisateur admin en écriture
- **Zéro perte de données** pendant le tournoi
- Saisie d'un round complet (4 lobbies × 8 joueurs) en **moins de 5 minutes**
- Le site supporte ~30 connexions simultanées en lecture (joueurs + spectateurs)

### Résultats mesurables

| Métrique | Cible |
|----------|-------|
| Tournoi 17 mai sans Excel | Oui/Non |
| Temps de saisie d'un round | < 5 minutes |
| Pertes de données | 0 |
| Dry-run validé avant le 10 mai | Oui/Non |
| Résultats visibles en temps réel côté joueur | < 2 secondes après validation admin |

## Product Scope & Développement phasé

### Stratégie MVP

**Approche :** MVP fonctionnel — remplacer l'Excel le jour J, point final. Pas d'expérimentation, pas de validation marché. Les utilisateurs sont acquis, le besoin est prouvé par des années d'utilisation de l'Excel.

**Ressources :** Développeur solo (Brice). Échéance fixe au 17 mai 2026, dry-run au 10 mai.

### MVP (Phase 1) — Feature Set

**Parcours utilisateurs couverts :**
- Joueur : inscription + consultation classement temps réel
- Admin : gestion complète du tournoi jour J (lobbies, saisie, drops)
- Caster : overlay OBS auto-refresh

**Capacités indispensables :**

| Capacité | Justification |
|----------|---------------|
| Page présentation + formulaire inscription | Point d'entrée joueurs, remplace Discord |
| Page qualifications avec classement temps réel | Autonomie joueurs + affichage cast |
| Page finale avec condition de victoire | Gestion de la phase finale |
| Overlay `/overlay` optimisé OBS | Le caster en dépend pour le stream |
| Backoffice : saisie placements | Action principale le jour J |
| Backoffice : génération lobbies (aléatoire + suisse) | Cœur de la logique métier |
| Backoffice : gestion drops/absents | Cas courant chaque tournoi |
| Calcul auto points + tiebreakers | Remplace les macros VBA |
| WebSocket temps réel | Mise à jour instantanée overlay + public |
| Login admin simple | Sécuriser le backoffice |
| Design charte EDS | Vitrine pro de l'association |
| RGPD : mentions légales | Conformité légale |
| Hébergement : frontend Hostinger, backend + PostgreSQL sur VPS Docker/Traefik | Infrastructure existante |

**Sans ces éléments, le produit ne remplace pas l'Excel → pas de MVP.**

### Post-MVP (Phase 2)

- Multi-tournois / historique des éditions
- Image du set TFT associée à chaque édition
- Création rapide d'une nouvelle édition à chaque set
- Statistiques joueurs sur plusieurs éditions

### Vision (Phase 3)

- Plateforme de gestion multi-tournois complète EDS
- Ouverture à d'autres formats de jeu (Street Fighter, Rocket League)
- Intégration API Riot Games
- Profils joueurs avancés

### Stratégie de mitigation des risques

**Risque technique — Système suisse :**
- Algorithme le plus complexe du projet : redistribuer les joueurs dans les lobbies selon le classement entre chaque round
- La logique existe déjà dans l'Excel (onglet TAS) → référence pour valider l'implémentation
- Mitigation : tester l'algo avec des données réelles des tournois précédents avant le dry-run

**Risque calendaire — Deadline fixe :**
- 1 mois de développement, développeur solo
- Le dry-run du 10 mai sert de filet de sécurité : 1 semaine de marge pour corriger les problèmes
- Règle de scope : si ce n'est pas testé avant le 10 mai, c'est post-MVP

**Risque opérationnel — Jour J :**
- Un seul admin en écriture → pas de conflit de données
- PostgreSQL sur VPS → données persistantes, pas de risque de perte comme avec un fichier local
- Fallback ultime : l'Excel reste disponible en dernier recours

## User Journeys

### Parcours 1 — Le joueur qui s'inscrit et suit le tournoi

**Personnage :** Kayn, 22 ans, joueur TFT Diamond, membre du Discord EDS.

**Scène d'ouverture :** Kayn clique sur le lien du site partagé sur Discord. Il découvre la page de présentation : dates, format, cash prize.

**Action :** Il remplit le formulaire (pseudo Discord, pseudo Riot, email) et valide. Confirmation affichée à l'écran. C'est fait en 30 secondes, pas de compte à créer.

**Le jour J :** Kayn joue ses games sur le client TFT. Entre deux rounds, il sort son téléphone et consulte la page Qualifications. Il voit son placement, son score cumulé, sa position au classement — mis à jour en temps réel dès que l'admin valide le round.

**Climax :** À la fin de la 3e journée de qualification, Kayn voit qu'il est 6e au classement général. Il est qualifié pour la finale — il le sait avant même que le caster l'annonce.

**Résolution :** Kayn suit la finale sur la page dédiée, voit la progression vers la condition de victoire. Expérience fluide, autonome, professionnelle.

### Parcours 2 — Le joueur qui drop en cours de journée

**Personnage :** Jinx, 19 ans, joueuse TFT inscrite au tournoi. Elle doit partir après le Round 3.

**Action :** L'admin la marque comme "drop" dans le backoffice. Jinx est retirée des lobbies suivants. Le dernier lobby passe de 8 à 7 joueurs. Le système redistribue normalement au round suivant.

**Résolution :** Les points acquis par Jinx restent au classement. Elle peut consulter sa position sur le site après coup. Aucun impact sur les autres joueurs.

### Parcours 3 — L'admin le jour du tournoi (Brice)

**Personnage :** Brice (Soulsiegfried), orga principal, seul à utiliser le backoffice le jour J.

**Scène d'ouverture :** Dimanche 17 mai, première journée de qualification. 28 joueurs inscrits. Brice ouvre le backoffice.

**Round 1 :** Brice démarre la journée. Il clique sur "Générer les lobbies" — le système répartit aléatoirement les 28 joueurs en 3 lobbies de 8 et 1 lobby de 4.

**Saisie :** La game est terminée. Brice saisit les placements (1-8) pour chaque joueur de chaque lobby. Il valide le round. Les points sont calculés automatiquement, le classement se met à jour instantanément côté public.

**Rounds suivants :** Brice clique sur "Générer les lobbies" pour le Round 2. Le système redistribue les joueurs selon le classement (système suisse). Il répète : saisie, validation, génération, jusqu'à 6 rounds.

**Cas limite — Drop :** Un joueur signale son départ sur Discord. Brice le marque "drop". Le dernier lobby passe à 7 joueurs.

**Cas limite — Absent :** Un joueur inscrit ne s'est pas présenté. Brice le retire manuellement avant de lancer le Round 1.

**Climax :** En moins de 5 minutes par round, tout est saisi et publié. Pas de stress, pas de macro qui plante.

### Parcours 4 — Le caster pendant le stream (SkyDow)

**Personnage :** SkyDow, caster officiel EDS, en direct sur Twitch.

**Setup :** SkyDow ajoute l'URL `/overlay` comme source navigateur dans OBS.

**Action :** L'overlay affiche le classement en temps réel, optimisé 16:9, grandes polices, sans éléments d'interface. Dès que Brice valide un round, l'overlay se met à jour instantanément. SkyDow n'a rien à manipuler.

**Résolution :** Le stream donne une image professionnelle de l'EDS — un affichage digne d'un événement esport.

### Résumé des capacités révélées par les parcours

| Parcours | Capacités requises |
|----------|-------------------|
| Joueur — inscription + suivi | Formulaire 3 champs, page classement temps réel, responsive mobile |
| Joueur — drop | Gestion des drops admin, maintien des points acquis, redistribution lobbies |
| Admin — jour J | Génération lobbies (aléatoire + suisse), saisie rapide placements, validation round, gestion drops/absents, calcul automatique points + tiebreakers |
| Caster — overlay | Page `/overlay` sans chrome UI, auto-refresh instantané, optimisée 16:9, charte EDS |

## Exigences spécifiques Web App

### Vue d'ensemble technique

Application web multi-pages (MPA) avec mise à jour temps réel via WebSocket. 3 pages publiques, 1 overlay stream, 1 backoffice admin. Architecture simple adaptée au périmètre.

### Matrice navigateurs

| Navigateur | Support |
|------------|---------|
| Chrome (dernières 2 versions) | Oui |
| Firefox (dernières 2 versions) | Oui |
| Edge (dernières 2 versions) | Oui |
| Safari (dernières 2 versions) | Oui |
| Safari iOS (dernières 2 versions) | Oui |
| Chrome Android (dernières 2 versions) | Oui |
| IE / navigateurs anciens | Non |

### Design responsive

- **Priorité desktop** : backoffice, overlay stream (16:9), pages publiques
- **Mobile supporté** : pages publiques (joueurs consultant le classement sur téléphone)
- **Backoffice** : desktop-only
- **Overlay** : résolution fixe 16:9, optimisé OBS browser source

### Stratégie SEO

Aucune. Le trafic vient exclusivement de liens directs partagés sur Discord. Pas de SSR, sitemap ou meta SEO nécessaires.

### Accessibilité

Bonnes pratiques de base :
- Contraste suffisant (charte EDS dark mode avec accents cyan/or)
- Navigation clavier fonctionnelle
- Textes lisibles (Bebas Neue pour les titres, Roboto pour le corps)
- Pas d'objectif WCAG formel

### Infrastructure

- **Temps réel** : WebSocket pour la mise à jour instantanée des résultats côté public et overlay
- **Authentification** : login simple admin uniquement (pas de comptes joueurs)
- **Hébergement** : frontend sur Hostinger, backend + PostgreSQL sur VPS Docker/Traefik
- **Sous-domaine** de esportdessacres.fr

## Functional Requirements

### Inscription des joueurs

- **FR1 :** Un joueur peut s'inscrire au tournoi via un formulaire (pseudo Discord, pseudo Riot, email)
- **FR2 :** Un joueur peut voir une confirmation de son inscription après soumission
- **FR3 :** L'admin peut voir la liste complète des joueurs inscrits
- **FR4 :** L'admin peut ajouter manuellement un joueur
- **FR5 :** L'admin peut retirer un joueur inscrit avant le début du tournoi (absent)

### Gestion des lobbies

- **FR6 :** Le système peut répartir aléatoirement les joueurs en lobbies de 8 pour le Round 1
- **FR7 :** Le système peut redistribuer les joueurs en lobbies selon le classement (système suisse) pour les rounds suivants
- **FR8 :** Le système peut gérer des lobbies incomplets (7 joueurs ou moins) quand le nombre total n'est pas un multiple de 8
- **FR9 :** L'admin peut visualiser la composition de chaque lobby avant de lancer un round

### Saisie et calcul des résultats

- **FR10 :** L'admin peut saisir le placement (1-8) de chaque joueur pour chaque lobby d'un round
- **FR11 :** Le système calcule automatiquement les points selon le barème (1er = 8 pts, 8e = 1 pt)
- **FR12 :** Le système calcule le score cumulé de chaque joueur sur l'ensemble des rounds
- **FR13 :** Le système calcule les tiebreakers (nombre de top 1, nombre de top 4, résultat dernière game)
- **FR14 :** L'admin peut valider un round pour déclencher la mise à jour du classement
- **FR15 :** Le système calcule la moyenne de points par round pour chaque joueur

### Gestion du tournoi (jour J)

- **FR16 :** L'admin peut démarrer une journée de qualification
- **FR17 :** L'admin peut enchaîner un nombre illimité de rounds par journée de qualification — la journée se termine manuellement via un bouton explicite (pas de limite dure)
- **FR18 :** L'admin peut marquer un joueur comme "drop" en cours de journée
- **FR19 :** Un joueur droppé est retiré des lobbies suivants mais conserve ses points acquis
- **FR20 :** Le classement est cumulé sur les 3 journées de qualification

### Finale

- **FR21 :** Le système identifie les 8 joueurs qualifiés (top 8 du classement cumulé)
- **FR22 :** L'admin peut démarrer la phase finale avec les 8 qualifiés en un seul lobby
- **FR23 :** Le système détecte automatiquement la condition de victoire (top 1 + ≥ 20 points cumulés)
- **FR24 :** L'admin peut enchaîner des rounds illimités en finale jusqu'à ce qu'un joueur remplisse la condition de victoire

### Affichage public temps réel

- **FR25 :** Un visiteur peut consulter la page de présentation du tournoi (dates, format, cash prize, règlement)
- **FR26 :** Un visiteur peut consulter le classement des qualifications en temps réel
- **FR27 :** Le classement affiche pour chaque joueur : pseudo, placements par round, points par round, score total, tiebreakers, moyenne
- **FR28 :** Un visiteur peut consulter le tableau de la finale en temps réel
- **FR29 :** La page finale affiche un indicateur de progression vers la condition de victoire pour chaque finaliste
- **FR30 :** Les pages publiques se mettent à jour instantanément quand l'admin valide un round
- **FR31 :** Les pages publiques sont consultables sur mobile

### Overlay stream

- **FR32 :** Le caster peut afficher une vue overlay (`/overlay`) dans OBS comme source navigateur
- **FR33 :** L'overlay affiche le classement sans éléments d'interface (chrome UI)
- **FR34 :** L'overlay est optimisé pour un affichage 16:9 avec polices lisibles à distance
- **FR35 :** L'overlay se met à jour instantanément quand l'admin valide un round

### Administration et sécurité

- **FR36 :** L'admin peut se connecter au backoffice via un login simple (identifiant/mot de passe)
- **FR37 :** Le backoffice est accessible uniquement aux utilisateurs authentifiés
- **FR38 :** Le site affiche les mentions légales RGPD

## Non-Functional Requirements

### Performance

- Pages publiques et overlay : chargement initial < 2 secondes
- Mise à jour temps réel (WebSocket) : < 2 secondes après validation admin
- Saisie placements backoffice : latence < 200ms
- Capacité : ~30 connexions WebSocket simultanées en lecture, 1 admin en écriture

### Sécurité

- Backoffice protégé par authentification (identifiant/mot de passe)
- Mots de passe admin stockés hashés (jamais en clair)
- Communications chiffrées via HTTPS (certificat SSL via Traefik)
- Données personnelles des joueurs (email) non exposées publiquement
- Mentions légales RGPD affichées

### Fiabilité

- Disponibilité continue pendant toute la durée d'une journée de tournoi (~4-6 heures)
- Persistance immédiate en base PostgreSQL (pas de cache volatile)
- Surveillance manuelle par l'admin le jour J — pas de monitoring automatisé
- Backup manuel de la base avant chaque journée de tournoi
