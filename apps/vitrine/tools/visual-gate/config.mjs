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
// ✅ LA CONNEXION N'EST PLUS UNE EXCEPTION DANS CETTE LISTE — STORY 12.4. Elle y figurait
// comme `/admin/login`, seule route d'`/admin` que cette porte pouvait voir : toutes les
// autres exigent une session et lui répondraient par une redirection, si bien qu'elle
// mesurerait la page de connexion en croyant mesurer l'agenda (faux vert). Depuis que les
// deux écrans vivent en `/connexion`, ce sont des pages PUBLIQUES ordinaires — couvertes
// pour la même raison que les six autres, et non plus par dérogation.
// ⚠️ Pourquoi elles méritent d'y être : la 8.1 y a mis un FORMULAIRE (champ e-mail + trois
// boutons). `globals.css` pose `overflow-x: clip`, donc un débordement y serait rogné SANS
// scrollbar ni erreur — invisible à l'œil par construction, et sur le point d'entrée de tout
// compte du site.
// 🔴 LE BACK-OFFICE, LUI, RESTE NON COUVERT, et c'est toujours un angle mort déclaré : cette
// porte interroge en HTTP nu. Le déplacement de la connexion ne le réduit pas — il retire
// seulement la seule page qui donnait l'illusion du contraire.
export const PAGES = (
  process.env.GATE_PAGES ??
  "/,/agenda,/partenaires,/l-asso,/animations,/tournois,/connexion,/connexion/verifier"
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

// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 LA FICHE DE TOURNOI EST UNE ROUTE **DYNAMIQUE** — SON URL SE DÉRIVE, ELLE NE S'ÉCRIT PAS
// ══════════════════════════════════════════════════════════════════════════════════════
//
// [AJOUTÉ le 2026-08-14, Story 9.3.] `/tournois/<slug>` est la 7ᵉ page publique et la première
// route dynamique publique du site. `PAGES` ci-dessus est une liste d'URL **concrètes** : la
// fiche n'y entre pas telle quelle, et les deux façons de contourner le problème sont
// symétriquement fausses —
//   · **écrire un slug en dur** : le jour où ce tournoi est supprimé ou dépublié, toutes les
//     portes qui balaient `PAGES` deviennent ROUGES sur un produit parfaitement sain. C'est
//     littéralement la dette **R46** (une base vide transformée en réquisitoire contre le
//     produit) et la leçon n°1 de la rétro Epic 6 : *~17 instruments faux, TOUS accusant le
//     produit*. Un slug en dur, c'est une donnée de production recopiée dans un instrument ;
//   · **ne rien faire** : la fiche serait la SEULE page publique qu'aucune porte ne regarde,
//     en silence. C'est le piège nommé d'avance par la note d'architecture (§13).
//
// ⇒ On la RÉSOUT depuis le site lui-même : lire `/tournois`, prendre le premier lien de fiche
// qu'elle rend. Trois propriétés, et chacune compte :
//   ① **elle suit la donnée** — le slug mesuré est toujours celui d'un tournoi réellement
//      publié, quel qu'il soit ;
//   ② **elle EST un témoin de l'arbitrage A1 inversé** — elle ne peut trouver un `href` que
//      parce que les cartes sont devenues des liens (Story 9.3). Si quelqu'un les débranchait,
//      la résolution deviendrait muette et le dirait ;
//   ③ **à vide, elle DÉCLARE au lieu de crier** — aucun tournoi publié n'est un état
//      parfaitement légitime (base neuve, tout dépublié), et une porte doit savoir distinguer
//      « rien à mesurer » de « défaut mesuré ». C'est la doctrine de la sonde de données de
//      `gate:carousel`, écrite en soldant R46, appliquée ici à une URL au lieu d'un compte.
//
// ⚠️ CONSÉQUENCE SUR LE TÉMOIN, ET ELLE EST DÉCLARÉE AVANT LA MESURE : le compte de `gate` vaut
// **196** (7 pages × 7 largeurs × 4 contrôles) quand un tournoi publié existe — le cas de
// staging —, et **168 + une exemption déclarée** sinon. Un compte qui bougerait autrement est
// une erreur de configuration, pas un succès.
//
// @returns {Promise<{url: string|null, raison: string}>}
export async function resoudreFicheTournoi(base) {
  const reponse = await fetch(base + "/tournois").catch(() => null);
  if (!reponse?.ok) {
    return {
      url: null,
      raison: `/tournois n'a pas répondu correctement (${reponse?.status ?? "aucune réponse"})`,
    };
  }
  const html = await reponse.text();
  // Le `href` que rend `next/link` pour une route interne est littéral dans le HTML servi.
  // ⚠️ La classe de caractères REFUSE le guillemet ET le slash : sans le slash, `/tournois/a/b`
  // (qui n'existe pas, mais qu'une future sous-route créerait) serait capturé en entier et on
  // mesurerait une URL qui n'est pas une fiche.
  const trouve = html.match(/href="(\/tournois\/[^"/]+)"/);
  if (!trouve) {
    return {
      url: null,
      raison:
        "aucun lien de fiche dans /tournois — soit aucun tournoi n'est publié (état légitime), " +
        "soit les cartes ont cessé d'être des liens (arbitrage A1, Story 9.3)",
    };
  }
  return { url: trouve[1], raison: "résolue depuis le premier lien de /tournois" };
}
