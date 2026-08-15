// @porte surface=galerie effet=lecture story=4.3
// 🔬 GARDE COMPORTEMENTALE DE LA LIGHTBOX (`/`, Story 4.3).
//
// Pourquoi un contrôle dédié — le tableau qui l'a fait écrire :
//
//   défaut possible                                    lint/build  Lighthouse  gate  œil
//   le focus s'échappe du dialogue (Tab sort derrière)     ❌          ❌       ❌   ❌
//   Échap ne ferme pas                                     ❌          ❌       ❌   ⚠️
//   le focus n'est PAS rendu à la vignette d'origine       ❌          ❌       ❌   ❌
//   la cible de fermeture fait moins de 44×44              ❌          ❌       ❌   ❌
//   sans JS, les vignettes disparaissent                   ❌          ❌       ❌   ❌
//   commandes MORTES quand il n'y a qu'une photo           ❌          ❌       ❌   ⚠️
//
// Lighthouse **n'audite ni le piège de focus, ni la restitution du focus, ni la
// convention 44×44** (WCAG 2.5.8 AA n'exige que 24×24 — la Story 2.10 affichait
// 100/100 avec des cibles de 26,39px, dette R10). Et le gate visuel est aveugle au
// COMPORTEMENT : c'est la leçon **R19**, où un header non sticky a traversé 9 stories
// avec CI verte et Lighthouse 100/100.
//
// Même conception que `gate:carousel` (3.3) et `gate:marquee` (4.1), y compris pour ce
// qui suit — et c'est la partie qui compte le plus :
//
// 🔴 LE CONTRAT EST DÉRIVÉ DE L'ÉTAT RÉELLEMENT OBSERVÉ, JAMAIS SUPPOSÉ DES DONNÉES.
// Avec UNE seule photo publiée (l'état du projet au 2026-07-31), les commandes
// précédent/suivant n'existent pas — et c'est CORRECT : deux flèches qui ne mènent nulle
// part sont exactement le défaut que `gate:carousel` a trouvé en Story 3.3. La porte
// exige donc leur ABSENCE dans ce cas, leur PRÉSENCE dès qu'il y a deux photos, et elle
// DIT quand la branche de navigation n'a pas pu être éprouvée plutôt que de conclure
// faussement.
//
// Usage :  node tools/visual-gate/lightbox-check.mjs [baseUrl]
//          LIGHTBOX_DEBRANCHER_PIEGE=1 …  → auto-validation de l'instrument
import { launchChrome } from "./cdp.mjs";
import { BASE as BASE_DEFAUT } from "./config.mjs";

const BASE = process.argv[2] ?? BASE_DEFAUT;
const URL = BASE + "/";

/**
 * 🔬 AUTO-VALIDATION (`pieges/instrument-non-valide.md`, payé SIX fois sur ce projet —
 * la dernière pendant cette story même, où la batterie de traversée rendait 404 sur tout
 * y compris sur le cas nominal).
 *
 * Avec `LIGHTBOX_DEBRANCHER_PIEGE=1`, on pose un écouteur `keydown` en phase de CAPTURE
 * sur `document` qui arrête la propagation des `Tab`. React 19 délègue ses écouteurs au
 * conteneur racine, donc un `stopPropagation()` en capture sur `document` empêche le
 * gestionnaire du dialogue d'être appelé : le piège de focus est mort, tout le reste
 * fonctionne. La porte DOIT alors échouer sur ①.
 * Une porte dont on n'a jamais vu l'échec ne prouve pas qu'elle mesure quelque chose.
 */
const DEBRANCHER = process.env.LIGHTBOX_DEBRANCHER_PIEGE === "1";

const LARGEUR_BUREAU = 1440;
const LARGEUR_MOBILE = 320;

const SEL = {
  grille: `ul[class*="Scrapbook-module"]`,
  declencheur: `button[class*="__declencheur"]`,
  overlay: `div[class*="__overlay"]`,
  fermer: `button[class*="__fermer"]`,
  nav: `button[class*="__nav"]`,
  cadre: `figure`,
};

const sonde = await fetch(URL).catch(() => null);
if (!sonde?.ok) {
  console.error(`\n❌ Rien ne répond correctement sur ${URL}.`);
  console.error("   Lancer : pnpm --filter vitrine build && pnpm --filter vitrine start");
  console.error("   ⚠️ `/` LIT LA BASE : le Postgres de dev doit tourner et");
  console.error("      apps/vitrine/.env.local être renseigné, sinon la page répond en");
  console.error("      erreur et cette porte ne mesure RIEN.");
  console.error("      docker compose -f docker/docker-compose.dev.yml up -d\n");
  process.exit(2);
}

const chrome = await launchChrome(9381);
const echecs = [];
const dire = (ok, n, detail) => {
  console.log(`  ${ok ? "✅" : "❌"} ${n} — ${detail}`);
  if (!ok) echecs.push(`${n} (${detail})`);
};

/** Décrit l'état de la page : grille, dialogue, commandes, focus courant. */
const RELEVE = `(() => {
  const grille = document.querySelector(${JSON.stringify(SEL.grille)});
  const declencheurs = Array.from(document.querySelectorAll(${JSON.stringify(SEL.declencheur)}));
  const overlay = document.querySelector(${JSON.stringify(SEL.overlay)});
  const fermer = document.querySelector(${JSON.stringify(SEL.fermer)});
  const navs = Array.from(document.querySelectorAll(${JSON.stringify(SEL.nav)}));
  const actif = document.activeElement;
  const taille = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [Math.round(r.width), Math.round(r.height)];
  };
  return {
    grillePresente: !!grille,
    vignettes: declencheurs.length,
    // Le nombre de cadres RENDUS, placeholders compris : c'est ce qui distingue « la
    // galerie est vide » de « la galerie a disparu ».
    cadres: document.querySelectorAll(${JSON.stringify(SEL.cadre)}).length,
    imagesGrille: grille ? grille.querySelectorAll("img").length : 0,
    ouverte: !!overlay,
    roleDialogue: overlay ? overlay.getAttribute("role") : null,
    ariaModal: overlay ? overlay.getAttribute("aria-modal") : null,
    ariaLabelledby: overlay ? !!overlay.getAttribute("aria-labelledby") : null,
    // Le titre accessible doit exister ET porter du texte : un aria-labelledby qui
    // pointe un noeud vide nomme le dialogue « (vide) », ce qui est pire que rien.
    titreDialogue: (() => {
      if (!overlay) return null;
      const id = overlay.getAttribute("aria-labelledby");
      const n = id ? document.getElementById(id) : null;
      return n ? (n.textContent || "").trim() : null;
    })(),
    boutonFermer: !!fermer,
    tailleFermer: taille(fermer),
    nav: navs.length,
    // Est-ce que le focus est DANS le dialogue ? C'est la mesure du piege.
    focusDansDialogue: !!(overlay && actif && overlay.contains(actif)),
    focusEstDeclencheur: declencheurs.indexOf(actif),
    focusBalise: actif ? actif.tagName + (actif.className ? "." + String(actif.className).slice(0, 40) : "") : null,
  };
})()`;

/** Envoie une vraie frappe clavier (et non un événement synthétique). */
const frapper = async (touche, modificateurs = 0) => {
  // `Input.dispatchKeyEvent` passe par la pile d'entrée de Chrome : c'est ce qui
  // distingue « le gestionnaire React est appelé » de « le navigateur déplace vraiment
  // le focus ». Un `dispatchEvent` fabriqué en JS ne déplacerait PAS le focus au Tab.
  const codes = {
    Tab: { windowsVirtualKeyCode: 9, code: "Tab", key: "Tab" },
    Escape: { windowsVirtualKeyCode: 27, code: "Escape", key: "Escape" },
    ArrowRight: { windowsVirtualKeyCode: 39, code: "ArrowRight", key: "ArrowRight" },
    ArrowLeft: { windowsVirtualKeyCode: 37, code: "ArrowLeft", key: "ArrowLeft" },
    // `text: "\r"` OBLIGATOIRE pour Entrée : sans lui Chrome ne déclenche pas l'action
    // par défaut sur un <button> focalisé, et la porte accuserait le composant à tort.
    // Mesuré pendant cette story — détail dans `cdp.mjs`, `envoyerTouche`.
    Enter: { windowsVirtualKeyCode: 13, code: "Enter", key: "Enter", text: "\r" },
  };
  const c = codes[touche];
  await chrome.envoyerTouche({ ...c, modifiers: modificateurs });
};

try {
  // ══════════════════ ÉTAT INITIAL (bureau) ══════════════════
  console.log(`\n  ── Viewport bureau (${LARGEUR_BUREAU}px) ──\n`);
  await chrome.setViewport(LARGEUR_BUREAU);
  await chrome.goto(URL);

  let e = await chrome.eval(RELEVE);
  if (!e.grillePresente) {
    console.error(`\n❌ Galerie INTROUVABLE sur ${URL}.`);
    console.error("   La section se rend toujours (état É7 avec placeholders) : son");
    console.error("   absence est un défaut, pas un état de données.\n");
    await chrome.close();
    process.exit(2);
  }

  dire(
    e.cadres > 0,
    "la galerie rend des cadres (peuplée ou en placeholders É7)",
    `${e.cadres} cadre(s), ${e.vignettes} déclencheur(s), ${e.imagesGrille} image(s)`,
  );

  // 🔴 GALERIE VIDE : aucun déclencheur, donc rien à éprouver ici. On le DIT.
  if (e.vignettes === 0) {
    console.log(
      "\n  ⚠️  AUCUNE PHOTO PUBLIÉE : la galerie rend son état É7 (placeholders), qui n'est\n" +
        "      PAS interactif. La lightbox n'a donc pas pu être éprouvée par cette\n" +
        "      exécution. Pour l'éprouver : `pnpm --filter vitrine db:seed`.\n",
    );
    await chrome.close();
    process.exit(echecs.length === 0 ? 0 : 1);
  }

  if (DEBRANCHER) {
    // Voir l'en-tête : capture sur `document` ⇒ le gestionnaire délégué de React n'est
    // jamais atteint pour les `Tab`. Le piège de focus est mort, le reste est intact.
    await chrome.eval(`(() => {
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Tab") ev.stopPropagation();
      }, true);
      return "piege debranche";
    })()`);
    console.log("  ⚠️  LIGHTBOX_DEBRANCHER_PIEGE=1 — le piège est DÉBRANCHÉ, un ÉCHEC est ATTENDU\n");
  }

  // ══════════════════ OUVERTURE AU CLAVIER ══════════════════
  // On focalise le 1ᵉʳ déclencheur puis on frappe Entrée : c'est le parcours d'un
  // utilisateur au clavier, pas un `.click()` programmatique. Un <div onClick> passerait
  // le clic et ÉCHOUERAIT ici — c'est précisément ce qu'on veut mesurer.
  await chrome.eval(`document.querySelector(${JSON.stringify(SEL.declencheur)}).focus()`);
  await frapper("Enter");
  await chrome.eval(`new Promise((r) => setTimeout(r, 200))`, true);
  e = await chrome.eval(RELEVE);

  dire(e.ouverte, "① la lightbox s'ouvre à ENTRÉE depuis la vignette focalisée", `ouverte=${e.ouverte}`);
  if (!e.ouverte) throw new Error("lightbox non ouverte : le reste du contrat est inéprouvable");

  dire(
    e.roleDialogue === "dialog" && e.ariaModal === "true",
    "① bis c'est un dialogue MODAL déclaré",
    `role=${e.roleDialogue}, aria-modal=${e.ariaModal}`,
  );
  dire(
    !!e.titreDialogue && e.titreDialogue.length > 0,
    "① ter le dialogue porte un nom accessible NON VIDE",
    `aria-labelledby=${e.ariaLabelledby}, texte=${JSON.stringify((e.titreDialogue ?? "").slice(0, 40))}`,
  );
  dire(
    e.focusDansDialogue,
    "① quater à l'ouverture, le focus ENTRE dans le dialogue",
    `focus=${e.focusBalise}`,
  );
  dire(
    e.tailleFermer !== null && e.tailleFermer[0] >= 44 && e.tailleFermer[1] >= 44,
    "⑧ cible tactile de la fermeture ≥ 44×44 (convention projet, non auditée ailleurs)",
    `${e.tailleFermer ? e.tailleFermer.join("×") : "absente"}`,
  );

  // ══════════════════ ① LE PIÈGE DE FOCUS ══════════════════
  // On tabule PLUS de fois qu'il n'y a d'éléments focalisables : si le piège tient, on
  // reste dedans quoi qu'il arrive. C'est la mesure que l'auto-validation fait échouer.
  const TOURS = 12;
  let sorties = 0;
  for (let i = 0; i < TOURS; i++) {
    await frapper("Tab");
    const t = await chrome.eval(RELEVE);
    if (!t.focusDansDialogue) sorties++;
  }
  dire(
    sorties === 0,
    `① LE FOCUS RESTE PIÉGÉ après ${TOURS} Tab consécutifs`,
    `${sorties} sortie(s) hors du dialogue`,
  );

  // Shift+Tab doit boucler dans l'autre sens.
  let sortiesArriere = 0;
  for (let i = 0; i < 4; i++) {
    await frapper("Tab", 8); // 8 = Shift
    const t = await chrome.eval(RELEVE);
    if (!t.focusDansDialogue) sortiesArriere++;
  }
  dire(sortiesArriere === 0, "① bis idem en Maj+Tab (l'autre sens)", `${sortiesArriere} sortie(s)`);

  // ══════════════════ ⑤ NAVIGATION — contrat DÉRIVÉ DE L'ÉTAT OBSERVÉ ══════════════════
  // Index de la photo AFFICHÉE au moment de la fermeture — c'est lui que ④ attend, et
  // non l'index d'ouverture. Voir le commentaire de ④ plus bas.
  let indexAffiche = 0;
  const plusieurs = e.vignettes > 1;
  if (plusieurs) {
    dire(e.nav === 2, "⑤ deux commandes de navigation pour ≥ 2 photos", `${e.nav} commande(s)`);
    const avant = await chrome.eval(
      `document.querySelector('${SEL.overlay} img') ? document.querySelector('${SEL.overlay} img').currentSrc : null`,
    );
    await frapper("ArrowRight");
    await chrome.eval(`new Promise((r) => setTimeout(r, 250))`, true);
    const apres = await chrome.eval(
      `document.querySelector('${SEL.overlay} img') ? document.querySelector('${SEL.overlay} img').currentSrc : null`,
    );
    dire(
      avant !== null && apres !== null && avant !== apres,
      "⑤ bis la flèche DROITE change réellement l'image affichée",
      `${String(avant).split("/").pop()?.slice(0, 30)} → ${String(apres).split("/").pop()?.slice(0, 30)}`,
    );
    // La flèche droite a avancé d'un cran : c'est cette vignette-là que ④ attend.
    indexAffiche = 1;
  } else {
    // 🔴 EXIGENCE INVERSE, et ce n'est PAS une tolérance : à une seule photo, deux
    // flèches seraient des commandes MORTES — le défaut réel attrapé par gate:carousel
    // en Story 3.3. Leur absence est donc le comportement CORRECT, et on le vérifie.
    dire(
      e.nav === 0,
      "⑤ UNE seule photo ⇒ AUCUNE commande de navigation (pas de commande morte)",
      `${e.nav} commande(s)`,
    );
    console.log(
      "\n  ⚠️  UNE SEULE photo publiée : la branche de NAVIGATION (flèches, compteur) n'a\n" +
        "      pas pu être éprouvée par cette exécution. C'est l'état réel du projet tant\n" +
        "      que les photos manquent (dette R15). Pour l'éprouver : publier une 2ᵉ photo.\n",
    );
  }

  // ══════════════════ ② ÉCHAP FERME ET ④ LE FOCUS REVIENT ══════════════════
  await frapper("Escape");
  await chrome.eval(`new Promise((r) => setTimeout(r, 250))`, true);
  e = await chrome.eval(RELEVE);
  dire(!e.ouverte, "② Échap FERME la lightbox", `ouverte=${e.ouverte}`);
  // 🔴 ④ ATTEND LA VIGNETTE DE LA PHOTO AFFICHÉE, PAS CELLE QUI A OUVERT — et c'est
  // cette porte qui a fait trancher le point. Une 1ʳᵉ version exigeait l'index 0 quoi
  // qu'il arrive ; avec DEUX photos elle est passée au rouge sur un comportement
  // délibéré : on ouvre la 1ʳᵉ, on navigue vers la 2ᵉ, on ferme — le focus va sur la 2ᵉ.
  // L'ARIA APG demande de rendre le focus « à l'élément qui a invoqué le dialogue », avec
  // une exception explicite quand le dialogue a CHANGÉ LE CONTEXTE : la navigation est ce
  // changement. Sans navigation (une seule photo), `indexAffiche` vaut 0 et l'exigence
  // redevient exactement celle de l'APG.
  // ⚠️ Une porte qui crie au loup sur un comportement voulu finit désactivée — même
  // leçon que le contrat « dérivé du régime observé » de `gate:marquee`.
  dire(
    e.focusEstDeclencheur === indexAffiche,
    "④ LE FOCUS EST RENDU À LA VIGNETTE DE LA PHOTO AFFICHÉE",
    `index focalisé = ${e.focusEstDeclencheur} (attendu ${indexAffiche}), focus=${e.focusBalise}`,
  );

  // ══════════════════ ③ CLIC HORS ZONE ══════════════════
  await chrome.eval(`document.querySelector(${JSON.stringify(SEL.declencheur)}).click()`);
  await chrome.eval(`new Promise((r) => setTimeout(r, 200))`, true);
  // Clic sur l'overlay LUI-MÊME (et non sur un enfant) : c'est la zone « hors photo ».
  await chrome.eval(`(() => {
    const o = document.querySelector(${JSON.stringify(SEL.overlay)});
    o.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return true;
  })()`);
  await chrome.eval(`new Promise((r) => setTimeout(r, 250))`, true);
  e = await chrome.eval(RELEVE);
  dire(!e.ouverte, "③ un clic HORS ZONE ferme la lightbox", `ouverte=${e.ouverte}`);

  // Et un clic SUR la photo ne doit PAS fermer (sinon la navigation serait impossible).
  await chrome.eval(`document.querySelector(${JSON.stringify(SEL.declencheur)}).click()`);
  await chrome.eval(`new Promise((r) => setTimeout(r, 200))`, true);
  await chrome.eval(`(() => {
    const img = document.querySelector('${SEL.overlay} img');
    if (img) img.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return true;
  })()`);
  await chrome.eval(`new Promise((r) => setTimeout(r, 250))`, true);
  e = await chrome.eval(RELEVE);
  dire(e.ouverte, "③ bis un clic SUR la photo ne ferme PAS", `ouverte=${e.ouverte}`);
  await frapper("Escape");

  // ══════════════════ ⑥ SANS JAVASCRIPT ══════════════════
  console.log(`\n  ── Sans JavaScript (viewport ${LARGEUR_MOBILE}px) ──\n`);
  await chrome.setViewport(LARGEUR_MOBILE);
  await chrome.setScriptExecutionDisabled(true);
  await chrome.goto(URL, { sansScripts: true });
  const sansJs = await chrome.eval(RELEVE);
  // 🔴 LA GARDE CENTRALE : une lightbox est un ENRICHISSEMENT, pas le seul accès à
  // l'image. Sans JS les vignettes doivent rester visibles et lisibles.
  dire(
    sansJs.grillePresente && sansJs.cadres > 0,
    "⑥ sans JS, la galerie et ses cadres restent RENDUS",
    `grille=${sansJs.grillePresente}, ${sansJs.cadres} cadre(s), ${sansJs.imagesGrille} image(s)`,
  );
  dire(!sansJs.ouverte, "⑥ bis sans JS, aucune lightbox ouverte au chargement", `ouverte=${sansJs.ouverte}`);
  await chrome.setScriptExecutionDisabled(false);

  // ══════════════════ ⑦ prefers-reduced-motion ══════════════════
  console.log(`\n  ── prefers-reduced-motion: reduce (viewport ${LARGEUR_MOBILE}px) ──\n`);
  await chrome.setEmulatedMedia({ "prefers-reduced-motion": "reduce" });
  await chrome.goto(URL);
  const reduit = await chrome.eval(RELEVE);
  dire(
    reduit.cadres > 0 && reduit.vignettes === e.vignettes,
    "⑦ sous `reduce`, AUCUNE perte de contenu ni de fonction",
    `${reduit.cadres} cadre(s), ${reduit.vignettes} déclencheur(s)`,
  );
  // La lightbox doit rester OUVRABLE : `reduce` neutralise le mouvement, jamais l'accès.
  await chrome.eval(`document.querySelector(${JSON.stringify(SEL.declencheur)}).click()`);
  await chrome.eval(`new Promise((r) => setTimeout(r, 250))`, true);
  const reduitOuvert = await chrome.eval(RELEVE);
  dire(
    reduitOuvert.ouverte,
    "⑦ bis sous `reduce`, la lightbox s'ouvre TOUJOURS (on coupe le mouvement, pas la fonction)",
    `ouverte=${reduitOuvert.ouverte}`,
  );
  await chrome.setEmulatedMedia({});
} finally {
  await chrome.close();
}

if (echecs.length === 0) {
  if (DEBRANCHER) {
    console.error(
      "\n❌ AUTO-VALIDATION EN ÉCHEC : le piège de focus était DÉBRANCHÉ et la porte est" +
        "\n   restée VERTE. Elle ne mesure donc pas ce qu'elle prétend mesurer — la" +
        "\n   corriger AVANT de se fier à un vert (`pieges/instrument-non-valide.md`).\n",
    );
    process.exit(1);
  }
  console.log("\n✅ LIGHTBOX CONFORME — comportement MESURÉ, pas déduit du code.\n");
  process.exit(0);
}

if (DEBRANCHER) {
  console.log("\n✅ AUTO-VALIDATION RÉUSSIE : piège débranché ⇒ la porte a bien ÉCHOUÉ sur :\n");
  for (const x of echecs) console.log("   " + x);
  console.log("");
  process.exit(0);
}

console.error("\n❌ LIGHTBOX NON CONFORME :\n");
for (const x of echecs) console.error("   " + x);
console.error("");
process.exit(1);
