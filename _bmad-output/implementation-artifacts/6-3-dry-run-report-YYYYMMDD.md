# Rapport de dry-run — Story 6.3 (Tournoi TFT EDS)

> **Renommer ce fichier** : `6-3-dry-run-report-YYYYMMDD.md` → `6-3-dry-run-report-2026-05-XX.md` (date reelle du dry-run).
> **Owner du remplissage** : Brice + SkyDow.
> **Squelette pre-cree par** : Amelia (dev-story agent) le 2026-04-25 — sections a remplir pendant et apres le dry-run avec observations + chronos + captures reels.
> **Reference** : Story 6.3 ACs (1 a 14) + Tasks (1 a 14).

---

## 1. Metadata

| Champ | Valeur |
|---|---|
| Date dry-run | `YYYY-MM-DD` (ex : 2026-05-08) |
| Heure debut | `HH:MM` (TZ Europe/Paris) |
| Heure fin | `HH:MM` |
| Duree totale | `Xh YY min` |
| Participants | Brice (admin), SkyDow (caster overlay OBS), `<ami #1 ?>`, `<ami #2 ?>` |
| Lieu Brice | `<a remplir : domicile / autre>` |
| Lieu SkyDow | `<a remplir : domicile, OBS de stream>` |
| Reseau Brice | `<a remplir : fibre wifi / fibre ethernet / 4G partage>` |
| Stack version | Story 6.1 + 6.2 done (smoke test 8/8 OK 2026-04-25, voir AC #1) |

---

## 2. Scope joue

| Item | Cible Story 6.3 | Realise |
|---|---|---|
| Joueurs total | 16 (Brice + 1-2 reels + 14-15 dummies) | `<a remplir>` |
| Joueurs reels | Brice + 1-2 amis | `<a remplir>` |
| Dummies | 14-15 (cf. `6-3-dummy-players.txt`) | `<a remplir>` |
| Journees qualif | 2 | `<a remplir>` |
| Rounds J1 qualif | 3 (convention dry-run) | `<a remplir>` |
| Rounds J2 qualif | 3 (convention dry-run) | `<a remplir>` |
| Rounds finale | 3-5 (jusqu'a victoire) | `<a remplir>` |
| Drops simules | 2 (1 en J1 R2/R3, 1 en J2 R1/R2) | `<a remplir>` |
| Vainqueur dry-run | `<pseudo>` (issu de la finale) | `<a remplir>` |

---

## 3. Pre-flight (J-1 ou debut J)

> **Reference** : Story 6.3 AC #1 + Task 1.

| Verification | Cible | Resultat | Commentaire |
|---|---|---|---|
| `bash docker/smoke-test.sh ...` | 8/8 SUCCES | `<X/8>` | `<a remplir>` |
| `dig +short api-tournoi.esportdessacres.fr` | 76.13.58.249 | `<a remplir>` | DNS Hostinger stable |
| `dig +short tournoi.esportdessacres.fr` | 76.13.58.249 | `<a remplir>` | DNS Hostinger stable |
| Cert TLS api-tournoi (`openssl s_client`) | issuer LE R13, notAfter >= 2026-05-24 | `<a remplir>` | Cert valide jusqu'au 2026-07-24 |
| Cert TLS tournoi (`openssl s_client`) | issuer LE R13, notAfter >= 2026-05-24 | `<a remplir>` | Idem |
| `docker compose ps` (4 services) | tous Up X (healthy) | `<a remplir>` | Traefik + postgres + backend + frontend |

**Observations** : `<a remplir>`

---

## 4. Lighthouse mobile `/finale` (deferred-work Epic 5)

> **Reference** : Story 6.3 AC #2 + Task 2. Cible Performance >= 75 (alignement Epic 3 `/qualifications`).

| Champ | Valeur |
|---|---|
| Date audit | `<a remplir>` |
| Outil | Chrome DevTools → Lighthouse → mode mobile |
| Throttle | Slow 4G + 4x CPU |
| URL | https://tournoi.esportdessacres.fr/finale |
| Score Performance | `<a remplir : XX/100>` |
| Score Accessibility | `<a remplir : XX/100>` |
| Score Best Practices | `<a remplir : XX/100>` |
| Score SEO | `<a remplir : XX/100>` |
| LCP | `<a remplir : Xs>` |
| FID/INP | `<a remplir : Xms>` |
| CLS | `<a remplir : X>` |
| Capture | `<chemin du screenshot ou JSON Lighthouse joint>` |

**Verdict** :
- [ ] Score >= 75 → AC #2 OK
- [ ] Score < 75 → entree ajoutee dans `deferred-work.md` (non bloquant Go-Live, page `/finale` est secondaire vs `/qualifications`)

---

## 5. Coordination SkyDow + dummies (AC #3)

| Champ | Valeur |
|---|---|
| Date session calee | `<a remplir : YYYY-MM-DD>` |
| Heure debut | `<a remplir>` |
| Duree estimee | `<a remplir : 4-6h>` |
| Confirmation ecrite SkyDow | `<a remplir : Discord screenshot / message>` |
| Brief SkyDow recu | [ ] URL `/overlay` ; [ ] OBS source nav 16:9 ; [ ] scope (16 joueurs, 2j+f) ; [ ] proc decrochage |
| Liste dummies | `_bmad-output/implementation-artifacts/6-3-dummy-players.txt` (16 pseudos prets) |

**Observations** : `<a remplir>`

---

## 6. Backup baseline + reset DB pre-dry-run (AC #4)

| Etape | Resultat |
|---|---|
| `sudo /opt/tournoi-tft/docker/backup-pg.sh` | `tournoi-pre-dryrun-<timestamp>.sql.gz` (`<taille>`) |
| `ls -lh` | `<a remplir>` |
| `gunzip -t` | `<exit 0 ? oui/non>` |
| Reset UI : "Reinitialiser les joueurs" | `<succes ? oui/non, capture toast>` |
| Verif SQL : `COUNT(*) Player` | `<a remplir>` (cible 0) |
| Verif SQL : `COUNT(*) Day` | `<a remplir>` (cible 0) |
| Verif SQL : `SELECT username FROM Admin` | `<a remplir>` (cible 'admin') |
| `/qualifications` mobile etat | `<a remplir>` (cible idle vide) |

**Chronometre** : `<X min>`

---

## 7. Inscriptions joueurs (AC #5)

> **Reference** : Story 6.3 AC #5 + Task 5.

| Etape | Resultat |
|---|---|
| Inscription publique mobile Brice | `<succes ? POST /api/players → 201, broadcast `tournament_state_changed` declenche>` |
| Inscriptions amis reels (1-2) | `<a remplir>` |
| Dummies via `/admin` "Ajouter un joueur" | `<X dummies crees>` |
| Total joueurs final | `<a remplir>` (cible 16) |
| Compteur overlay OBS reflete | `<oui/non, observation SkyDow>` |

**Chronometre** : `<X min>`

**Observations** : `<a remplir>`

---

## 8. Journee 1 qualif — 3 rounds + 1 drop (AC #6)

> **Reference** : Story 6.3 AC #6 + Task 6.

### 8.1. Demarrage et Round 1

| Etape | Resultat | Chrono |
|---|---|---|
| "Demarrer la journee" → Day 1 cree | `<a remplir>` | `<a remplir>` |
| "Generer les lobbies" R1 | `<a remplir : 2 lobbies de 8 ? random ?>` | `<a remplir>` |
| Saisie placements R1 | `<a remplir : latence subjective <200ms ?>` | `<a remplir>` |
| "Valider le round" R1 | `<broadcast ranking_updated declenche ?>` | `<a remplir>` |
| Update mobile `/qualifications` | `<delai en s>` (cible <2s) | `<a remplir>` |
| Update overlay OBS | `<delai en s>` (cible <2s) | `<a remplir>` |

### 8.2. Round 2 (Swiss J1R2+)

| Etape | Resultat | Chrono |
|---|---|---|
| "Generer les lobbies" R2 | `<a remplir : Swiss top 8 / bottom 8 ?>` | `<a remplir>` |
| Saisie + validation R2 | `<a remplir>` | `<a remplir>` |
| Update mobile + overlay | `<delais>` | `<a remplir>` |

### 8.3. Drop entre R2 et R3

| Etape | Resultat |
|---|---|
| Joueur droppe (cible : `CrimsonBlade` ligne 12 du fichier dummy-players) | `<a remplir>` |
| Verification : disparition lobbies R3 | `<oui/non>` |
| Verification : conserve points cumules | `<oui/non>` |
| Verification : grise/barre dans `/qualifications` (UX-DR6) | `<oui/non>` |

### 8.4. Round 3 (Swiss avec 1 drop)

| Etape | Resultat | Chrono |
|---|---|---|
| "Generer les lobbies" R3 | `<a remplir : 1 lobby de 8 + 1 lobby de 7 = 15 actifs ?>` | `<a remplir>` |
| Saisie + validation R3 | `<a remplir>` | `<a remplir>` |
| "Terminer la journee" | `<Day 1 status='completed' ? plus de bouton "Generer lobbies" ?>` | `<a remplir>` |

**Chronometre journee J1 totale** : `<X min>`

**Observations** : `<a remplir>`

---

## 9. Journee 2 qualif — 3 rounds + 1 drop + cumul (AC #7)

> **Reference** : Story 6.3 AC #7 + Task 7.

### 9.1. Round 1 J2 (Swiss sur cumul J1 — VERIF BUG RETRO EPIC 5 v1.2)

| Etape | Resultat |
|---|---|
| "Demarrer la journee" → Day 2 cree | `<a remplir>` |
| "Generer les lobbies" R1 J2 | `<a remplir : Swiss sur cumul J1 ?>` |
| **Verification critique** : J2R1 utilise `aggregateQualificationRankings` (pas re-random) | [ ] OK / [ ] regression bug retro Epic 5 v1.2 |
| Saisie + validation R1 J2 | `<a remplir>` |

### 9.2. Drop entre R1 et R2 J2

| Etape | Resultat |
|---|---|
| Joueur droppe (cible : `EmberSoul` ligne 14, different de J1) | `<a remplir>` |
| Verification cumul drops apres J2R2 | `<a remplir : 2 droppes total ?>` |

### 9.3. Rounds 2 et 3 J2

| Etape | Resultat | Chrono |
|---|---|---|
| R2 J2 (Swiss) saisie + validation | `<a remplir>` | `<a remplir>` |
| R3 J2 (Swiss) saisie + validation | `<a remplir>` | `<a remplir>` |

### 9.4. Verification cumul multi-journees post-J2

| Verification | Resultat |
|---|---|
| `/qualifications` affiche scores cumules J1+J2 | `<oui/non>` |
| Tiebreakers calcules sur l'ensemble (FR13) | `<oui/non>` |
| Top 8 cumul mis en valeur (UX-DR5) | `<oui/non>` |
| Liste top 8 visuelle correspond au tri attendu | `<oui/non>` |
| "Terminer la journee" → Day 2 `completed` | `<a remplir>` |

**Chronometre journee J2 totale** : `<X min>`

**Observations** : `<a remplir>`

---

## 10. Finale + detection victoire (AC #8)

> **Reference** : Story 6.3 AC #8 + Task 8.

### 10.1. Demarrage

| Etape | Resultat |
|---|---|
| Top 8 cumul J1+J2 verifie visuellement | `<a remplir : liste pseudos>` |
| "Demarrer la finale" | `<atomicite Prisma : Day + Round + Lobby + 8 LobbyPlayer en transaction ?>` |
| `/finale` publique : 8 finalistes affiches | `<oui/non>` |
| Progression victoire visible (UX-DR7) | `<oui/non>` |
| **Garde** : bouton "Regenerer les lobbies" masque (FINALE_LOBBY_IS_FIXED) | [ ] OK / [ ] regression visible |

### 10.2. Rounds finale

| Round | Top 1 | Cumul preRound | Cumul postRound | Detection victoire ? |
|---|---|---|---|---|
| R1 finale | `<pseudo>` | 0 | `<X>` | non (preRound < 20) |
| R2 finale | `<pseudo>` | `<X>` | `<Y>` | `<oui/non, justifier>` |
| R3 finale | `<pseudo>` | `<X>` | `<Y>` | `<oui/non>` |
| R4 finale | `<pseudo>` | `<X>` | `<Y>` | `<oui/non>` |
| R5 finale (si necessaire) | `<pseudo>` | `<X>` | `<Y>` | `<oui/non>` |

### 10.3. Verification regle preRoundTotal >= 20 + top 1 (retro Epic 5 v1.4)

> **Cas test** : un joueur a 14 pts pre-round, top 1 du round (+8) → totalScore=22 mais preRoundTotal=14 < 20 → **PAS** victoire.

| Cas observe | Resultat |
|---|---|
| Cas "non-victoire" reproduit (preRound < 20 + top 1 → continuer) ? | `<oui/non, donner round + pseudo>` |
| Cas "victoire" valide (preRound >= 20 + top 1 → vainqueur) ? | `<oui/non, donner round + pseudo>` |

### 10.4. UX vainqueur

| Verification | Resultat |
|---|---|
| Backoffice indique vainqueur (FR23) | `<oui/non>` |
| `/finale` publique : animation/or `#DAB265` (UX-DR8) | `<oui/non, capture jointe ?>` |
| Overlay OBS reflete vainqueur | `<oui/non, capture SkyDow ?>` |
| Day finale `completed`, plus de bouton "Round suivant" | `<oui/non>` |

**Vainqueur dry-run** : `<pseudo>`

**Chronometre finale totale** : `<X min>`

**Observations** : `<a remplir>`

---

## 11. Backup post-dry-run + restore E2E local (AC #9, deferred review 6.1)

> **Reference** : Story 6.3 AC #9 + Task 9. Procedure complete dans `6-3-dry-run-runbook-jour-J.md` section 5.

| Etape | Resultat |
|---|---|
| `sudo /opt/tournoi-tft/docker/backup-pg.sh` post-finale | `tournoi-postdryrun-<timestamp>.sql.gz` (`<taille>`) |
| `ls -lh` | `<a remplir>` (cible >= 50 KB) |
| `gunzip -t` | `<exit 0 ? oui/non>` |
| `scp` vers machine dev locale | `<succes ? oui/non>` |
| `docker run --rm -d --name pg-restore-test ...` | `<healthy en ~10s ? oui/non>` |
| `gunzip -c | docker exec -i ... psql` | `<exit 0 sans erreur SQL ?>` |
| **Verif #1** : `SELECT COUNT(*) FROM "Player"` | `<a remplir>` (cible >= 14) |
| **Verif #2** : `SELECT COUNT(*) FROM "Day"` | `<a remplir>` (cible 3) |
| **Verif #3** : `SELECT COUNT(*) FROM "Round"` | `<a remplir>` (cible >= 8 : 3 J1 + 3 J2 + 2-5 finale) |
| **Verif #4** : `SELECT COUNT(*) FROM "Lobby"` | `<a remplir>` (coherent) |
| **Verif #5** : `SELECT username FROM "Admin"` | `<a remplir>` (cible 'admin') |
| **Verif #6** : `SELECT COUNT(*) FROM "Player" WHERE status='dropped'` | `<a remplir>` (cible >= 2) |
| **Verif #7** : `SELECT * FROM "Day" WHERE type='finale'` | `<a remplir>` (cible 1 ligne, scores vainqueur lisibles via JOIN) |
| Cleanup : `docker stop pg-restore-test` | `<auto-supprime via --rm ? oui/non>` |
| Procedure ajoutee au runbook section 5 | [x] (deja documente dans `6-3-dry-run-runbook-jour-J.md` v1.0) |

**Chronometre** : `<X min>`

**Verdict** : [ ] AC #9 OK (livrable deferred-work review 6.1 ferme) / [ ] regression a investiguer

---

## 12. Validation OBS finale par SkyDow (AC #10, deferred Epic 4)

> **Reference** : Story 6.3 AC #10 + Task 10. **Sign-off SkyDow obligatoire**.

### 12.1. Checks visuels (9 items)

| Check | Resultat (oui/non + commentaire SkyDow) |
|---|---|
| (a) Aucun chrome UI / scrollbar / element navigation (UX-DR14) | `<a remplir>` |
| (b) Format 16:9 propre (pas de bordures noires inattendues) | `<a remplir>` |
| (c) Polices Bebas Neue (titres) + Roboto (corps) lisibles a distance | `<a remplir>` |
| (d) Charte EDS respectee (fond `#29265B`, cyan `#80E2ED`, or `#DAB265`) | `<a remplir>` |
| (e) Top 8 visuellement distingue (UX-DR5) | `<a remplir>` |
| (f) Joueurs droppes barres ou grises (UX-DR6) | `<a remplir>` |
| (g) Animation/mise en valeur du vainqueur en or `#DAB265` (UX-DR8) | `<a remplir>` |
| (h) Mise a jour instantanee `<2s` apres validation admin (NFR2) | `<a remplir>` |
| (i) Reconnexion auto OK apres `docker compose restart backend` (story 4.1 AC #5 + 3.1 AC #4) | `<a remplir>` |

### 12.2. Captures jointes (au moins 2)

- [ ] Capture overlay OBS pendant qualifs (round X journee Y) : `<chemin>`
- [ ] Capture overlay OBS pendant finale ou au moment du vainqueur : `<chemin>`
- [ ] Bonus : capture overlay OBS apres reconnexion auto (suite restart backend)

### 12.3. Sign-off SkyDow

> **A signer par SkyDow** dans son canal (Discord screenshot ou message dedie joint a ce rapport). Sans cette signature, AC #10 reste KO.

```
[ ] Go-Live OK overlay
SkyDow, YYYY-MM-DD, HH:MM
"<commentaire libre, optionnel>"
```

**Verdict** : [ ] AC #10 OK (deferred Epic 4 ferme apres 4 epics) / [ ] non valide

---

## 13. Performance temps reel multi-clients (NFR1, NFR2, NFR4)

| Mesure | Cible | Resultat |
|---|---|---|
| DOMContentLoaded mobile `/qualifications` | < 2s (NFR1) | `<a remplir : Xs>` |
| Latence saisie placements (admin) | < 200ms perçue (NFR3) | `<a remplir>` |
| Latence broadcast WebSocket → mobile | < 2s (NFR2) | `<a remplir>` |
| Latence broadcast WebSocket → overlay OBS | < 2s (NFR2) | `<a remplir>` |
| Connexions WebSocket simultanees observees | 4-5 (cible NFR4 = 30, OK pour MVP) | `<a remplir>` |

**Outils utilises** : Chrome DevTools Network (Brice), chrono subjectif SkyDow.

---

## 14. Issues identifiees pendant le dry-run

| # | Severite (Crit/Med/Low) | Description | Impact J | Action prise / deferree |
|---|---|---|---|---|
| 1 | `<a remplir>` | `<a remplir>` | `<a remplir>` | `<a remplir>` |
| 2 | `<a remplir>` | `<a remplir>` | `<a remplir>` | `<a remplir>` |
| 3 | `<a remplir>` | `<a remplir>` | `<a remplir>` | `<a remplir>` |

> **Cible attendue** : 0 Crit, 0-2 Med, 0-3 Low. Si Crit > 0 : story hotfix `6-3-1-hotfix-<nom>` requise avant 2026-05-15.

---

## 15. Reset prod definitif J-7 (AC #11)

> **A executer ~2026-05-10**, apres validation du dry-run et avant le 17 mai.

| Etape | Resultat |
|---|---|
| `sudo /opt/tournoi-tft/docker/backup-pg.sh` (archive finale) | `tournoi-postdryrun-final-<date>.sql.gz` |
| Reset UI : "Reinitialiser les joueurs" | `<succes ? oui/non>` |
| `SELECT COUNT(*) FROM Player` | `<a remplir>` (cible 0) |
| `SELECT COUNT(*) FROM Day` | `<a remplir>` (cible 0) |
| `SELECT COUNT(*) FROM Round` | `<a remplir>` (cible 0) |
| `SELECT COUNT(*) FROM Lobby` | `<a remplir>` (cible 0) |
| `SELECT COUNT(*) FROM LobbyPlayer` | `<a remplir>` (cible 0) |
| `SELECT username FROM Admin` | `<a remplir>` (cible 'admin') |
| Re-smoke test | `<X/8>` (cible 8/8) |
| `/qualifications` mobile | `<a remplir>` (cible idle vide) |
| `/finale` | `<a remplir>` (cible "Finale pas encore commencee") |
| Cleanup : `find /root/backups -mtime +14 -delete` | `<a remplir>` |

---

## 16. Captures jointes (au moins 4 attendues, Story 6.3 AC #12)

> **Stocker** dans le meme dossier que ce rapport ou dans `_bmad-output/implementation-artifacts/screenshots-dry-run/`.

- [ ] **Admin saisie placements** (page `/admin` lobby ouvert, dropdowns 1-8 visibles) : `<chemin>`
- [ ] **Overlay OBS pendant qualif** (depuis SkyDow) : `<chemin>`
- [ ] **Page mobile `/qualifications`** (Brice ou ami sur mobile reel) : `<chemin>`
- [ ] **Page `/finale` au moment du vainqueur** (animation or `#DAB265` visible) : `<chemin>`

Bonus :
- [ ] Lighthouse `/finale` mobile (capture ou JSON exporte) : `<chemin>`
- [ ] DevTools Network admin (preuve latence WebSocket) : `<chemin>`
- [ ] Discord screenshot brief SkyDow + sign-off : `<chemin>`

---

## 17. Sign-off Go/No-Go (AC #14)

> **Critere de cloture story 6.3** : 8 cases cochees + conclusion `GO-LIVE: YES`. Si une seule case `[ ]` reste : story reste `in-progress`, plan d'action documente, eventuellement story hotfix `6-3-1-*`.

- [ ] **(1)** Scenario complet sans data loss `[Brice]`
- [ ] **(2)** Overlay OBS pro-grade `[SkyDow]`
- [ ] **(3)** WebSocket <2s sur tous les clients `[Brice]`
- [ ] **(4)** Backup + restore valide en local Docker Desktop `[Brice]`
- [ ] **(5)** Reset prod execute et verifie SQL `[Brice]`
- [ ] **(6)** Runbook ecrit et lu `[Brice]`
- [ ] **(7)** Lighthouse mobile `/finale` >= 75 `[Brice]`
- [ ] **(8)** Aucun bug bloquant ouvert OU story hotfix livree avant 2026-05-15 `[Brice]`

### Conclusion

**GO-LIVE : `<YES / NO>`**

**Commentaire** : `<a remplir : ce qui a marche tres bien, ce qui a surpris, ce qui necessite vigilance le 17 mai>`

---

### Signatures

```
Brice (admin du tournoi)
[ ] Sign-off le YYYY-MM-DD a HH:MM
"<commentaire libre>"

SkyDow (caster overlay OBS)
[ ] Sign-off le YYYY-MM-DD a HH:MM
"<commentaire libre>"
```

---

## 18. Suite immediate

- [ ] Si `GO-LIVE: YES` :
  - Renommer ce fichier `6-3-dry-run-report-<date_reelle>.md`
  - Mettre a jour `_bmad-output/implementation-artifacts/sprint-status.yaml` : `6-3-dry-run-validation-go-live` → `review`
  - Demander revue (`code-review` adapte sur rapport+runbook)
  - Apres revue OK : `review` → `done`
  - Cocher les 3 deferred-work items adresses : OBS (Epic 4), Lighthouse `/finale` (Epic 5), backup restore (review 6.1)

- [ ] Si `GO-LIVE: NO` (au moins 1 critere `[ ]`) :
  - Documenter le plan d'action precis (qui, quoi, quand)
  - Si bug bloquant : creer story `6-3-1-hotfix-<nom>`
  - Re-derouler les ACs impactes (sous-set du dry-run, pas la totalite)
  - Story 6.3 reste `in-progress`

---

## 19. Change Log

| Version | Date | Auteur | Description |
|---|---|---|---|
| v1.0 | 2026-04-25 | Amelia (dev-story agent, claude-opus-4-7) | Squelette rapport pre-cree. 17 sections couvrant les 14 ACs : metadata, scope, pre-flight, Lighthouse, coordination, backup baseline, inscriptions, J1, J2, finale, restore E2E, sign-off OBS SkyDow, performance multi-clients, issues, reset prod, captures, sign-off Go/No-Go. **A remplir** par Brice + SkyDow pendant et apres le dry-run. |
