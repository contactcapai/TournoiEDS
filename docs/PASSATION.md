# Passation — Exploitation de la stack EDS (self-hosted)

> **À qui s'adresse ce document ?** Au bénévole de l'asso Esport des Sacres qui reprend
> l'exploitation technique du site (vitrine `esportdessacres.fr` + plateforme tournoi
> `tournoi.esportdessacres.fr`). Objectif : pouvoir **démarrer, mettre à jour, sauvegarder
> et restaurer** la stack **sans dépendre d'un prestataire unique**.
>
> Aucune connaissance préalable du projet n'est requise, mais il faut savoir se connecter en
> SSH et lancer des commandes Docker. Tout est **self-hosted** et **reproductible depuis ce
> dépôt git** : il n'y a aucune « boîte noire » externe.

---

## 0. Ce qu'il faut savoir en 2 minutes

- **Un seul serveur** : un VPS Hostinger (Ubuntu), IP `<IP_VPS>`. Tout y tourne en
  conteneurs Docker derrière un reverse-proxy **Traefik** (HTTPS automatique Let's Encrypt).
- **Trois applications** + une stack de base de données :
  - `tournoi.esportdessacres.fr` + `api-tournoi.esportdessacres.fr` — la plateforme de tournoi.
  - `esportdessacres.fr` — le site vitrine (Next.js).
- **Deux bases PostgreSQL distinctes** (c'est voulu) :
  - `tournoi-tft-postgres` — la base du tournoi (Prisma).
  - `postgres` (`tournoi-tft-postgres`) — **le seul moteur de base**, avec DEUX bases cloisonnées :
    celle du tournoi et `vitrine` (celle du site).
- **Le code source EST la documentation d'infra** : tout est dans `/opt/tournoi-tft`
  (cloné depuis le dépôt git). Pour reconstruire le serveur de zéro : un VPS neuf + ce dépôt
  + les fichiers `.env` de secrets (non versionnés). Cf. README §Deploy et §Runbook.

> **Accès** : `ssh <USER_SSH>@<IP_VPS>` (les vraies valeurs `<IP_VPS>` / `<USER_SSH>` ne sont
> **pas** committées — détenues par Brice / le bureau, gestionnaire de mots de passe).
> DNS chez Hostinger (compte Brice). Toutes les
> procédures détaillées (déploiement initial, Let's Encrypt, etc.) sont dans
> [`README.md`](../README.md) §Deploy / §Runbook. Ce document est le **guide d'exploitation
> courante**.

---

## 1. Démarrer / arrêter la stack complète

Toutes les commandes se lancent depuis `/opt/tournoi-tft/docker`. La stack tourne en
**un seul fichier compose** (tournoi + vitrine + base + Traefik) — il faut
**toujours** passer les deux `-f` :

```bash
cd /opt/tournoi-tft/docker
COMPOSE="docker compose"

# Démarrer TOUT (tournoi + vitrine + base + Traefik)
$COMPOSE up -d

# État des services (chercher "healthy")
$COMPOSE ps

# Arrêter TOUT (sans supprimer les données ; les volumes persistent)
$COMPOSE down
```

> ⚠️ Ne **jamais** ajouter `-v` à `docker compose down` : cela **supprimerait les volumes**
> (donc les bases de données et les fichiers). Les volumes nommés (`tournoi-pg-data`,
> `docker_eds-medias`, `traefik-acme`) contiennent les données
> de production.

Pour (re)démarrer un seul service : `$COMPOSE up -d <service>` (ex. `vitrine`, `postgres`).

---

## 2. Mettre à jour après une modification du code

Le déploiement est **manuel** (pas de CI/CD). On récupère le code, on reconstruit l'image
concernée, on relance le service :

```bash
cd /opt/tournoi-tft
git pull origin main
cd docker
COMPOSE="docker compose"
```

| Quoi a changé | Commande |
|---|---|
| Vitrine (`apps/vitrine`) | `$COMPOSE build vitrine && $COMPOSE up -d vitrine` |
| Backend tournoi (`apps/tournoi-api`) | `$COMPOSE build backend && $COMPOSE up -d backend` |
| Frontend tournoi (`apps/tournoi-web`) | `$COMPOSE build frontend && $COMPOSE up -d frontend` |
| Config de la base (`docker/initdb/`) | ⚠️ **relue seulement sur un volume VIDE** — sinon jouer le SQL à la main (README) |

- Le **backend** applique ses migrations Prisma automatiquement au démarrage.
- La **vitrine** : si une variable de **build** change (ex. `NEXT_PUBLIC_SITE_URL`), il faut
  `build` (le bundle est figé au build, cf. README §Deploy).
- Toujours vérifier après coup : `$COMPOSE ps` (healthy) puis un smoke-test (§4).

> 💡 **Avant toute mise à jour risquée** (migration de schéma, gros changement) : lancer une
> **sauvegarde manuelle** d'abord (§3).

---

## 3. Sauvegardes & restauration

### Sauvegarder (manuel)

```bash
sudo /opt/tournoi-tft/docker/backup-all.sh
# Produit dans /root/backups :
#   tournoi-*.sql.gz   (base tournoi)
#   vitrine-*.sql.gz   (base de la vitrine)
#   storage-*.tar.gz   (fichiers du bucket Storage)
```

### Sauvegardes automatiques (recommandé en prod)

- **Copie hors-VPS** (indispensable : une panne disque VPS ne doit pas tout détruire) et
  **planification quotidienne** : procédure complète dans [`README.md`](../README.md)
  §Sauvegardes automatiques (installer `rclone`, remplir `docker/offsite.env` +
  `docker/rclone.conf`, installer le cron `docker/backups.cron`).
- **Rétention** : 14 jours en local, 30 jours sur le remote (purge automatique).

### Restaurer

Procédures détaillées (3 cas : base tournoi, base vitrine, médias) dans
[`README.md`](../README.md) §Restore. Points clés :

- **Base tournoi** et **base vitrine** se restaurent **séparément** — même moteur depuis la
  révision du 2026-07-29, mais **deux bases distinctes** : ne pas confondre les deux dumps.
- Restaurer la **base vitrine AVANT les médias** (la table des photos référence les fichiers).
- ⚠️ **Ne jamais supprimer le volume `tournoi-pg-data`** pour « repartir propre » côté vitrine :
  il porte **aussi** la base du tournoi. C'est le prix du moteur mutualisé.

> ✅ La restauration a été **vérifiée en local** (Docker Desktop). Il est **fortement
> recommandé** de planifier une **restauration de test périodique** sur une cible jetable
> (ex. trimestrielle) pour garantir que les sauvegardes sont réellement exploitables.

---

## 4. Tâches courantes

### Consulter les logs

```bash
cd /opt/tournoi-tft/docker
COMPOSE="docker compose"
$COMPOSE logs -f vitrine          # site vitrine
$COMPOSE logs -f backend          # API tournoi
$COMPOSE logs -f traefik          # routage + certificats HTTPS
$COMPOSE logs -f postgres         # base (tournoi ET vitrine)
$COMPOSE ps                       # statut (healthy / unhealthy)
```

### Smoke-test (vérifier que tout répond)

```bash
bash /opt/tournoi-tft/docker/smoke-test.sh \
  https://api-tournoi.esportdessacres.fr \
  https://tournoi.esportdessacres.fr \
  https://esportdessacres.fr
# 11 checks attendus OK
```

### Espace disque (à surveiller pendant un événement live)

```bash
df -h /root            # espace global
du -sh /root/backups   # taille des sauvegardes
```

### Purger les vieilles sauvegardes (normalement automatique)

```bash
sudo find /root/backups -name "tournoi-*.sql.gz"  -mtime +14 -delete
sudo find /root/backups -name "vitrine-*.sql.gz" -mtime +14 -delete
sudo find /root/backups -name "storage-*.tar.gz"  -mtime +14 -delete
```

### Accéder à la base

Studio n'est **pas** exposé sur internet (sécurité : accès admin complet à la base). On y
accède par un **tunnel SSH** depuis sa machine :

```bash
# Depuis la machine locale
ssh -L 5433:tournoi-tft-postgres:5432 <USER_SSH>@<IP_VPS>
# Puis se connecter avec DBeaver/pgAdmin sur localhost:5433, base 'vitrine'.
# Puis ouvrir http://localhost:3001 dans le navigateur
```

---

## 5. Pourquoi ces choix techniques (« boring tech ») ?

Le but est qu'une **petite équipe bénévole rotative** puisse maintenir le site **dans la
durée**, sans expertise pointue ni dépendance à une personne ou un fournisseur unique :

- **Docker Compose + scripts shell** plutôt qu'un orchestrateur complexe (Kubernetes…) :
  lisible, reproductible, peu de pièces mobiles, diagnosticable avec `docker compose logs`.
- **PostgreSQL auto-hébergé** plutôt qu'un SaaS propriétaire : les données restent
  **chez nous**, exportables par un simple `pg_dump`. Aucun risque de hausse de prix ou de
  fermeture de service tiers.
- **Traefik + Let's Encrypt** : HTTPS automatique et gratuit, configuration versionnée.
- **rclone pour la copie hors-VPS** : ~50 fournisseurs supportés (Backblaze, S3, SFTP…) —
  on peut **changer de cible sans réécrire** le système de sauvegarde (anti-lock-in).
- **Tout est dans le dépôt git** (« infrastructure as code ») : le serveur est
  **reconstructible de zéro** à partir du dépôt + des fichiers de secrets. Pas de
  configuration cachée dans une interface web d'un prestataire.

### Aucun point de défaillance « prestataire unique »

| Brique | Fournisseur actuel | Remplaçable par |
|---|---|---|
| VPS | Hostinger | n'importe quel VPS Linux (le dépôt redéploie ailleurs) |
| DNS | Hostinger | n'importe quel registrar / DNS |
| Sauvegarde off-site | (au choix : Backblaze B2…) | tout backend rclone (S3, SFTP, autre) |
| Base de données | **PostgreSQL** auto-hébergé (chez nous) | Postgres standard (dumps `pg_dump` portables) |
| Certificats TLS | Let's Encrypt | tout fournisseur ACME |

Aucune de ces briques n'est verrouillante : chacune est remplaçable sans réécrire l'application.

---

## 6. En cas de problème

1. `docker compose ... ps` — repérer le service `unhealthy` / arrêté.
2. `docker compose ... logs -f <service>` — lire l'erreur.
3. Problème de certificat HTTPS → README §Debug Let's Encrypt.
4. Données corrompues / mauvaise migration → **restaurer la dernière sauvegarde** (§3 + README §Restore).
5. Référence complète : [`README.md`](../README.md) (§Deploy, §Runbook).
