---
title: "Product Brief: Tournoi TFT EDS"
status: "final"
created: "2026-04-15"
updated: "2026-04-15"
inputs:
  - docs/CONTEXTE-PROJET.md
  - docs/UX-DESIGN.md
---

# Product Brief — Tournoi TFT Esport des Sacres

## Résumé exécutif

L'Esport des Sacres (EDS), association esport rémoise fondée en 2022, organise des tournois TFT (Teamfight Tactics) récurrents à chaque nouveau set (~tous les 4 mois). Aujourd'hui, toute la gestion repose sur un fichier Excel avec macros VBA : inscriptions, répartition des joueurs en lobbies, saisie des placements, classement, système suisse. C'est lent, fragile, et inadapté au live.

Le projet est un **site web autonome** qui remplace cet Excel par une expérience fluide : les joueurs s'inscrivent en ligne, les résultats s'affichent en temps réel pendant le cast, et l'admin gère le tournoi depuis un backoffice rapide et fonctionnel. Le tout hébergé sur l'infrastructure existante (Hostinger + VPS Docker).

L'enjeu immédiat : que le **tournoi du Set 17 (17 mai 2026)** se déroule entièrement sur le site, sans retour à l'Excel.

## Le problème

Le jour du tournoi, un organisateur doit jongler entre un fichier Excel à 5 onglets, des macros VBA capricieuses, et un partage d'écran pour montrer les résultats aux joueurs et au cast. Les points de friction :

- **Saisie lente** — entrer les placements de 32 joueurs round après round dans Excel, sous la pression du direct
- **Pas de visibilité joueur** — les participants ne peuvent pas consulter le classement eux-mêmes, ils dépendent du cast
- **Fragilité** — un mauvais clic dans le fichier Excel peut corrompre les données du tournoi en cours
- **Zéro présence en ligne** — pas de page d'inscription, pas de site dédié, les informations passent uniquement par Discord

## La solution

Un site web en 3 pages publiques + un backoffice admin :

**Pages publiques :**
1. **Présentation + Inscription** — dates, format, cash prize, formulaire 3 champs (pseudo Discord, pseudo Riot, email), règlement
2. **Tableau des qualifications** — classement en temps réel, optimisé pour l'affichage stream (16:9, grandes polices), avec placements par round, score cumulé et tiebreakers
3. **Finale** — tableau des 8 finalistes avec indicateur de progression vers la condition de victoire (top 1 + ≥ 20 points)
4. **Overlay stream** (`/overlay`) — vue dédiée OBS browser source, sans chrome UI, auto-refresh, optimisée pour le cast en direct

**Backoffice :** saisie rapide des placements, génération automatique des lobbies (Round 1 aléatoire, rounds suivants en système suisse), gestion des drops (lobby bascule à 7 joueurs, bye pour le joueur qui drop), validation des rounds.

Le site adopte l'identité visuelle EDS : dark mode bleu nuit (#29265B), accents cyan (#80E2ED) et or (#DAB265), typographies Bebas Neue et Roboto.

## Ce qui rend ce projet pertinent

Aucune plateforme de tournoi existante (Toornament, Start.gg, Battlefy, Challengermode) ne gère correctement le **système suisse pour des lobbies TFT de 8 joueurs**. Leur Swiss system est conçu pour du 1v1. Les organisateurs TFT à travers la France retombent tous sur Excel — ce projet résout un vrai problème que personne ne couvre.

Ce n'est pas un outil commercial : c'est un **outil interne EDS**, taillé sur mesure pour le format exact du tournoi, sans compromis ni fonctionnalités superflues.

## Qui ça sert

| Utilisateur | Besoin | Succès |
|-------------|--------|--------|
| **Joueurs** (jusqu'à 32) | S'inscrire facilement, suivre leur classement pendant le tournoi | Consultation du classement en temps réel sur mobile |
| **Admin/Orga** (1 personne, login partagé) | Saisir les résultats vite et sans erreur le jour J | Un round saisi et validé en moins de 2 minutes |
| **Caster** (SkyDow) | Afficher un tableau lisible à l'écran pendant le stream | Page résultats optimisée 16:9, mise à jour live |

## Critères de succès

- Le tournoi du **17 mai 2026** se déroule intégralement sur le site, sans retour à l'Excel
- Les joueurs consultent leurs résultats en autonomie pendant la journée
- La saisie d'un round complet (4 lobbies × 8 joueurs) prend moins de 5 minutes
- Zéro perte de données pendant le tournoi
- Dry-run complet avant le 10 mai (test end-to-end avec SkyDow sur OBS)
- Règle de scope : si c'est pas testé avant le 10 mai, c'est post-MVP

## Périmètre MVP

**Inclus :**
- 3 pages publiques + overlay stream (présentation/inscription, qualifications, finale, /overlay OBS)
- Backoffice admin (login simple, saisie placements, génération lobbies, gestion drops)
- Système suisse automatisé (redistribution par classement entre les rounds)
- Détection automatique de la condition de victoire en finale
- Mise à jour en temps réel du tableau de résultats
- Hébergement : frontend sur Hostinger, backend + PostgreSQL sur VPS Docker/Traefik
- Sous-domaine de esportdessacres.fr
- RGPD : mentions légales prêtes
- Design selon charte EDS (dark mode, Bebas Neue, Roboto)

**Exclu (MVP) :**
- Multi-tournois / historique des éditions
- Intégration API Riot Games
- Profils joueurs avancés
- Système de paiement
- Chat / forum
- Intégration avec esportdessacres.fr
- N8N workflows (disponible mais non requis pour le MVP)

## Vision

Ce MVP one-shot pose les fondations. À terme, le site pourra évoluer vers une plateforme de gestion multi-tournois pour EDS : création d'une nouvelle édition à chaque set TFT, historique des résultats, image du set associée, et potentiellement ouverture à d'autres formats de jeu de l'association.
