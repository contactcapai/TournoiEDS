// Périmètre commun aux portes et aux instruments de ce dossier.
//
// ⚠️ AJOUTER ICI TOUTE NOUVELLE PAGE PUBLIQUE. Une page absente de cette liste
// n'est couverte par AUCUNE des portes de ce dossier — en silence, ce qui est
// exactement le mode de défaillance que cet outillage existe pour supprimer.
// `/partenaires` a été ajoutée par la Story 4.2 : le compte de `pnpm --filter
// vitrine gate` est passé de 84 à 105 (5 pages × 7 largeurs × 3 gardes), et c'est
// CE CHANGEMENT DE COMPTE qui prouve que l'ajout a pris — un compte inchangé après
// l'ajout d'une page est le signal d'une erreur de configuration, pas un succès.
// L'Epic 5 n'ajoute aucune route (le formulaire vit sur /partenaires).
//
// 🔴 [MIS À JOUR le 2026-08-14, Story 9.2.] `/tournois` REJOINT LA LISTE — sixième
// page publique du site. Témoin déclaré AVANT la mesure : le compte de
// `pnpm --filter vitrine gate` passe de **140 à 168** (6 pages × 7 largeurs × 4
// contrôles ; `gate.mjs` fait `controles += 4` par combinaison, le compte se DÉRIVE
// donc du code et n'est pas une promesse). Un compte resté à 140 après cet ajout
// serait le signal d'une **erreur de configuration**, pas un succès.
//
// ⚠️ LES **SIX** PAGES LISENT LA BASE à chaque requête, et elles sont toutes `ƒ`.
// 🔴 [CORRIGÉ le 2026-08-14.] Ce commentaire prescrivait de lancer le Postgres de dev
// (`docker compose -f docker/docker-compose.dev.yml up -d`) : **périmé depuis la règle
// du 2026-08-13** — on ne lance plus ni serveur local ni Docker local, et le rendu se
// regarde sur staging. Les portes de ce dossier se pilotent donc par `GATE_BASE` :
//   GATE_BASE=https://staging.esportdessacres.fr pnpm --filter vitrine gate
// La base qui sert le rendu est celle du VPS ; il n'y a plus rien à démarrer ici.
// ⚠️ Un commentaire qui prescrit un prérequis disparu fait chercher la panne au mauvais
// endroit — c'est la raison même pour laquelle il est corrigé et non doublé.
//
// 🔴 [CORRIGÉ le 2026-08-06, Story 6.13.] Ce commentaire disait « `/`, `/agenda` ET
// `/partenaires` » (Stories 3.2, 3.3, 4.2) — périmé de deux stories : `/animations`
// lit `workshop` depuis la 6.9 et `/l-asso` lit `member` depuis la 6.10. Et depuis
// la 6.13, le layout `(public)` lui-même lit `site_setting`, donc les pages dépendent
// de la base **par leur chrome** en plus de leur contenu.
export const PAGES = (
  process.env.GATE_PAGES ?? "/,/agenda,/partenaires,/l-asso,/animations,/tournois"
).split(",");

// 7 largeurs de référence du projet : 320 (le plus tendu), 412, 768, 880 (le
// breakpoint), 1024, 1440, 1920.
export const WIDTHS = (process.env.GATE_WIDTHS ?? "320,412,768,880,1024,1440,1920")
  .split(",")
  .map(Number);

// 🔴 LE REPLI SUR 4310 NE VAUT PLUS QUE POUR UN POSTE QUI RALLUMERAIT UN SERVEUR LOCAL,
// ET CE N'EST PLUS LE MODE DE TRAVAIL DU PROJET (règle du 2026-08-13). En pratique,
// `GATE_BASE` se renseigne TOUJOURS :
//   GATE_BASE=https://staging.esportdessacres.fr pnpm --filter vitrine gate
// ⚠️ Ne pas supposer ce port dans un message d'erreur ni dans une note de story : rien
// n'écoute dessus. Les sondes d'entrée de ce dossier disent franchement « rien ne
// répond sur … » — c'est le témoin qui compte, pas le port.
export const BASE = process.env.GATE_BASE ?? "http://127.0.0.1:4310";
