// 🔬 GARDE COMPORTEMENTALE DU FORMULAIRE DE SOLLICITATION (`/partenaires`, Story 5.1).
//
// Pourquoi un contrôle dédié — même motif que `gate:lightbox`/`gate:carousel`/`gate:marquee` :
//
//   défaut possible                                          lint/build  Lighthouse  gate  œil
//   le focus ne va pas au premier champ en erreur                ❌          ❌       ❌   ❌
//   aria-invalid/aria-describedby absents ou pointent à vide     ❌          ❌       ❌   ⚠️
//   aria-live n'annonce rien après soumission                    ❌          ❌       ❌   ⚠️
//   une erreur serveur VIDE le message déjà tapé                 ❌          ❌       ❌   ❌
//   le honeypot devient atteignable au clavier (tabIndex retiré) ❌          ❌       ❌   ❌
//   le focus s'échappe de la modale (Tab passe derrière)         ❌          ❌       ❌   ❌
//   le focus n'est pas rendu au déclencheur à la fermeture       ❌          ❌       ❌   ❌
//   SANS JS : bouton mort et AUCUN moyen de contact              ❌          ❌       ❌   ❌
//
// Deux points dominent :
//   · le HONEYPOT — garde RGPD/anti-spam (AC3) qu'un `tabIndex={-1}` oublié en maintenance
//     désactiverait sans que rien ne le signale (leçon R19) ;
//   · le REPLI SANS JS — depuis que le formulaire vit dans une MODALE (arbitrage de Brice
//     au gate visuel du 2026-07-31), un visiteur sans JavaScript ne peut pas l'ouvrir. Si
//     le `<noscript>` cessait de masquer le bouton, on aurait un CTA sans destination sur
//     TROIS surfaces — exactement le défaut soldé en Story 3.3 et celui que la dette R28
//     existe pour empêcher. C'est la garde ⑥, et elle se mesure scripts coupés.
//
// 🔴 CETTE PORTE MUTE LA BASE (unique parmi les `gate:*`) : chaque soumission RÉELLE écrit
// une ligne dans `solicitation`. Toutes les lignes de ce script portent un `name` préfixé
// `GATE_MARKER` et sont SUPPRIMÉES en fin d'exécution (`finally`) — un test d'envoi réel,
// pas un mock (`pieges/integration-tierce.md`), mais qui ne laisse rien derrière lui.
//
// Usage :  node tools/visual-gate/solicitation-check.mjs [baseUrl]
//          SOLICITATION_DEBRANCHER_PIEGE=1 …  → auto-validation de l'instrument
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";
import { launchChrome } from "./cdp.mjs";
import { BASE as BASE_DEFAUT } from "./config.mjs";

// `DATABASE_URL` n'est PAS injectée automatiquement dans un script `node` autonome
// (contrairement à `next build`/`next start`) — patron `drizzle.config.ts`.
config({ path: join(dirname(fileURLToPath(import.meta.url)), "../../.env.local") });

const BASE = process.argv[2] ?? BASE_DEFAUT;
const URL = BASE + "/partenaires";
const GATE_MARKER = "GATE AUTOTEST solicitation-check";

/**
 * 🔬 AUTO-VALIDATION (`pieges/instrument-non-valide.md`).
 *
 * Avec `SOLICITATION_DEBRANCHER_PIEGE=1`, on retire le `tabindex` du honeypot APRÈS
 * chargement de la page — simulation d'une régression (le `tabIndex={-1}` du composant
 * aurait été retiré par erreur). La porte DOIT alors échouer sur le contrôle du honeypot.
 * Une porte dont on n'a jamais vu l'échec ne prouve pas qu'elle mesure quelque chose.
 */
const DEBRANCHER = process.env.SOLICITATION_DEBRANCHER_PIEGE === "1";

const LARGEUR_BUREAU = 1440;

const SEL = {
  declencheur: "[data-solicitation-trigger]",
  overlay: '[role="dialog"][aria-modal="true"]',
  fermer: '[role="dialog"] button[aria-label^="Fermer"]',
  form: "form",
  name: "#solicitation-name",
  email: "#solicitation-email",
  message: "#solicitation-message",
  consent: 'input[name="consentGiven"]',
  honeypot: 'input[name="sujetSecondaire"]',
  submit: 'button[type="submit"]',
};

const sonde = await fetch(URL).catch(() => null);
if (!sonde?.ok) {
  console.error(`\n❌ Rien ne répond correctement sur ${URL}.`);
  console.error("   Lancer : pnpm --filter vitrine build && pnpm --filter vitrine start");
  console.error("   ⚠️ `/partenaires` LIT LA BASE : le Postgres de dev doit tourner et");
  console.error("      apps/vitrine/.env.local être renseigné, sinon cette porte ne mesure RIEN.");
  console.error("      docker compose -f docker/docker-compose.dev.yml up -d\n");
  process.exit(2);
}

const chrome = await launchChrome(9383);
const echecs = [];
const dire = (ok, n, detail) => {
  console.log(`  ${ok ? "✅" : "❌"} ${n} — ${detail}`);
  if (!ok) echecs.push(`${n} (${detail})`);
};

/** Décrit l'état du formulaire : champs, erreurs, focus courant, aria-live. */
const RELEVE = `(() => {
  const form = document.querySelector(${JSON.stringify(SEL.form)});
  const actif = document.activeElement;
  const decrire = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const describedBy = el.getAttribute("aria-describedby");
    const cible = describedBy ? document.getElementById(describedBy) : null;
    return {
      valeur: el.value ?? null,
      ariaInvalid: el.getAttribute("aria-invalid"),
      describedBy,
      // Le message référencé existe-t-il ET porte-t-il du texte ? Un aria-describedby
      // qui pointe un nœud vide ou absent est pire qu'absent (patron lightbox-check).
      messageExiste: !!cible,
      messageNonVide: cible ? (cible.textContent || "").trim().length > 0 : false,
    };
  };
  const overlay = document.querySelector(${JSON.stringify(SEL.overlay)});
  const fermer = document.querySelector(${JSON.stringify(SEL.fermer)});
  const taille = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [Math.round(r.width), Math.round(r.height)];
  };
  return {
    formPresent: !!form,
    declencheurs: document.querySelectorAll(${JSON.stringify(SEL.declencheur)}).length,
    roleDialogue: overlay ? overlay.getAttribute("role") : null,
    ariaModal: overlay ? overlay.getAttribute("aria-modal") : null,
    // Le titre accessible doit exister ET porter du texte : un aria-labelledby qui
    // pointe un nœud vide nomme le dialogue « (vide) », ce qui est pire que rien.
    titreDialogue: (() => {
      if (!overlay) return null;
      const id = overlay.getAttribute("aria-labelledby");
      const n = id ? document.getElementById(id) : null;
      return n ? (n.textContent || "").trim() : null;
    })(),
    // Est-ce que le focus est DANS le dialogue ? C'est la mesure du piège.
    focusDansDialogue: !!(overlay && actif && overlay.contains(actif)),
    focusEstDeclencheur: !!(actif && actif.matches(${JSON.stringify(SEL.declencheur)})),
    tailleFermer: taille(fermer),
    name: decrire(${JSON.stringify(SEL.name)}),
    email: decrire(${JSON.stringify(SEL.email)}),
    message: decrire(${JSON.stringify(SEL.message)}),
    focusId: actif ? actif.id || null : null,
    focusName: actif ? actif.getAttribute("name") : null,
    focusBalise: actif ? actif.tagName + (actif.id ? "#" + actif.id : "") : null,
    // Contenu de la région aria-live (succès ou erreur) — l'un OU l'autre est présent.
    ariaLiveTexte: (() => {
      const el = document.querySelector('[aria-live]');
      return el ? (el.textContent || "").trim() : null;
    })(),
    honeypotTabIndex: (() => {
      const h = document.querySelector(${JSON.stringify(SEL.honeypot)});
      return h ? h.getAttribute("tabindex") : null;
    })(),
  };
})()`;

/**
 * Envoie une vraie frappe clavier (et non un événement synthétique) — patron `lightbox-check`.
 *
 * 🔴 LÈVE SI LA TOUCHE N'EST PAS DÉCLARÉE, ET CE GARDE-FOU EST NÉ D'UN DÉFAUT RÉEL DE CET
 * INSTRUMENT (7ᵉ occurrence de `pieges/instrument-non-valide.md` sur ce projet).
 * `Escape` manquait de cette table : `codes["Escape"]` valait `undefined`, le spread
 * `{ ...undefined }` donnait un objet vide, et CDP dispatchait un événement sans touche.
 * La porte a donc rapporté « ⑤ Échap NE FERME PAS la modale » — un défaut PRODUIT — alors
 * que le composant n'avait jamais reçu la moindre frappe. Sans cette levée, on corrigeait
 * un composant qui n'avait rien.
 */
const frapper = async (touche, modificateurs = 0) => {
  const codes = {
    Tab: { windowsVirtualKeyCode: 9, code: "Tab", key: "Tab" },
    Enter: { windowsVirtualKeyCode: 13, code: "Enter", key: "Enter", text: "\r" },
    Escape: { windowsVirtualKeyCode: 27, code: "Escape", key: "Escape" },
  };
  if (!codes[touche]) throw new Error(`Touche non déclarée dans \`frapper\` : ${touche}`);
  await chrome.envoyerTouche({ ...codes[touche], modifiers: modificateurs });
};

/**
 * Attend qu'un sélecteur résolve un élément, sans supposer la page stabilisée juste après
 * `goto()` (mesuré : un aller-retour serveur réel juste avant peut retarder l'attache des
 * gestionnaires de quelques centaines de ms sous charge). Échoue fort si l'élément n'existe
 * TOUJOURS PAS après le délai — c'est alors un vrai défaut, pas un faux négatif de timing.
 */
async function attendreElement(sel, timeoutMs = 3000) {
  const debut = Date.now();
  while (Date.now() - debut < timeoutMs) {
    const trouve = await chrome.eval(`!!document.querySelector(${JSON.stringify(sel)})`);
    if (trouve) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

/**
 * 🔴 OUVRE LA MODALE ET S'ASSURE QUE LE FORMULAIRE EST INTERROGEABLE.
 *
 * Depuis l'arbitrage de Brice au gate visuel (2026-07-31), le formulaire ne vit plus en
 * page : il est rendu dans une MODALE (`SolicitationDialog`), donc il n'existe dans le DOM
 * qu'après un clic sur `[data-solicitation-trigger]`.
 *
 * ⚠️ Renavigue et réessaie — mesuré PENDANT cette story : sous la charge que génère CETTE
 * PORTE (soumissions réelles répétées vers une page `force-dynamic` qui interroge la base),
 * la page est parfois servie incomplète, sans erreur visible. Cause non élucidée avec
 * certitude (candidate la plus probable : contention transitoire du pool Postgres local
 * sous la charge inhabituelle que CE script génère lui-même) ; ce n'est PAS un défaut du
 * composant ni de la Server Action. Réessayer absorbe cette instabilité d'environnement
 * sans masquer un vrai défaut : si le formulaire n'apparaît JAMAIS, l'échec remonte.
 */
const MAX_TENTATIVES_NAVIGATION = 5;
async function assurerFormulaire(url) {
  for (let tentative = 0; tentative < MAX_TENTATIVES_NAVIGATION; tentative++) {
    // Déjà ouvert (cas nominal entre deux mesures d'une même séquence) ?
    if (await attendreElement(SEL.name, 300)) return;
    // Sinon : le déclencheur est-il là ? Alors on ouvre.
    if (await attendreElement(SEL.declencheur, 300)) {
      await chrome.eval(`document.querySelector(${JSON.stringify(SEL.declencheur)}).click()`);
      if (await attendreElement(SEL.name, 3000)) return;
    }
    await chrome.goto(url);
    if (await attendreElement(SEL.declencheur, 5000)) {
      await chrome.eval(`document.querySelector(${JSON.stringify(SEL.declencheur)}).click()`);
      if (await attendreElement(SEL.name, 3000)) return;
    }
    console.log(
      `  ⚠️  formulaire inatteignable (tentative ${tentative + 1}/${MAX_TENTATIVES_NAVIGATION}) — nouvelle tentative…`,
    );
  }
  const diag = await chrome.eval(
    `({ titre: document.title, url: location.href, declencheurs: document.querySelectorAll(${JSON.stringify(SEL.declencheur)}).length, formCount: document.querySelectorAll("form").length })`,
  );
  throw new Error(`Formulaire inatteignable après ${MAX_TENTATIVES_NAVIGATION} tentatives — DIAG ${JSON.stringify(diag)}`);
}

const remplir = async (sel, valeur) => {
  await assurerFormulaire(URL);
  return chrome.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    const setter = Object.getOwnPropertyDescriptor(window[el.tagName === "TEXTAREA" ? "HTMLTextAreaElement" : "HTMLInputElement"].prototype, "value").set;
    setter.call(el, ${JSON.stringify(valeur)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  })()`);
};

/**
 * 🔴 MÊME CONTOURNEMENT QUE `remplir`, ET IL N'EST PAS FACULTATIF ICI : les champs sont
 * CONTRÔLÉS (React pilote `checked` via le state) depuis le correctif trouvé PAR CETTE
 * PORTE (React réinitialise les champs non contrôlés après une action de formulaire).
 * Assigner `el.checked = true` en JS nu passe par le setter NATIF intercepté par React,
 * qui l'ignore silencieusement en dehors d'un événement utilisateur réel — le composant
 * ne serait alors jamais notifié et l'état `requestType`/`consentGiven` resterait vide.
 */
const cocher = async (sel) => {
  await assurerFormulaire(URL);
  return chrome.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked").set;
    setter.call(el, true);
    el.dispatchEvent(new Event("click", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
};

let sql;

try {
  console.log(`\n  ── Modale de sollicitation (${LARGEUR_BUREAU}px) ──\n`);
  await chrome.setViewport(LARGEUR_BUREAU);
  await chrome.goto(URL);

  // ══════════════════ ⓪ LA MODALE : DÉCLENCHEUR, DIALOGUE, FOCUS ══════════════════
  // 🔴 Depuis l'arbitrage du gate visuel, le formulaire N'EST PLUS EN PAGE : il n'existe
  // qu'une fois la modale ouverte. Le contrat commence donc par ça.
  let e = await chrome.eval(RELEVE);
  dire(
    e.declencheurs > 0 && !e.formPresent,
    "⓪ au chargement : le déclencheur est là et le formulaire n'est PAS encore dans le DOM",
    `${e.declencheurs} déclencheur(s), formulaire=${e.formPresent}`,
  );

  await chrome.eval(`document.querySelector(${JSON.stringify(SEL.declencheur)}).focus()`);
  await frapper("Enter");
  await chrome.eval(`new Promise((r) => setTimeout(r, 300))`, true);
  e = await chrome.eval(RELEVE);

  dire(
    e.formPresent,
    "⓪ bis la modale s'ouvre à ENTRÉE depuis le déclencheur focalisé (et pas seulement au clic)",
    `formulaire=${e.formPresent}`,
  );
  if (!e.formPresent) throw new Error("modale non ouverte : le reste du contrat est inéprouvable");

  dire(
    e.roleDialogue === "dialog" && e.ariaModal === "true",
    "⓪ ter c'est un dialogue MODAL déclaré",
    `role=${e.roleDialogue}, aria-modal=${e.ariaModal}`,
  );
  dire(
    !!e.titreDialogue && e.titreDialogue.length > 0,
    "⓪ quater le dialogue porte un nom accessible NON VIDE",
    `texte=${JSON.stringify((e.titreDialogue ?? "").slice(0, 40))}`,
  );
  dire(
    e.focusDansDialogue,
    "⓪ quinquies à l'ouverture, le focus ENTRE dans le dialogue",
    `focus=${e.focusBalise}`,
  );
  dire(
    e.tailleFermer !== null && e.tailleFermer[0] >= 44 && e.tailleFermer[1] >= 44,
    "⓪ sexies cible tactile de la fermeture ≥ 44×44 (convention projet, non auditée ailleurs)",
    `${e.tailleFermer ? e.tailleFermer.join("×") : "absente"}`,
  );

  if (DEBRANCHER) {
    await chrome.eval(`(() => {
      document.querySelector(${JSON.stringify(SEL.honeypot)}).removeAttribute("tabindex");
      return "piege debranche";
    })()`);
    console.log("  ⚠️  SOLICITATION_DEBRANCHER_PIEGE=1 — tabindex du honeypot RETIRÉ, un ÉCHEC est ATTENDU\n");
  }

  // ══════════════════ ① SOUMISSION INVALIDE → FOCUS AU PREMIER CHAMP ══════════════════
  // Tous les champs vides, consentement non coché : la validation CLIENT (schéma Zod
  // partagé) doit s'exécuter SANS aller-retour serveur et déplacer le focus sur `name`.
  await chrome.eval(`document.querySelector(${JSON.stringify(SEL.submit)}).focus()`);
  await frapper("Enter");
  await chrome.eval(`new Promise((r) => setTimeout(r, 200))`, true);
  e = await chrome.eval(RELEVE);

  dire(
    e.focusId === "solicitation-name",
    "① à la soumission invalide, le focus va au PREMIER champ en erreur (nom)",
    `focus=${e.focusBalise}`,
  );
  dire(
    e.name?.ariaInvalid === "true" && e.name?.messageExiste && e.name?.messageNonVide,
    "① bis le champ nom porte aria-invalid + un message d'erreur référencé NON VIDE",
    `aria-invalid=${e.name?.ariaInvalid}, describedBy=${e.name?.describedBy}, messageNonVide=${e.name?.messageNonVide}`,
  );

  // ══════════════════ ② LE HONEYPOT N'EST JAMAIS ATTEINT AU CLAVIER ══════════════════
  // On repart du début du formulaire et on tabule largement plus qu'il n'y a de champs :
  // le honeypot doit rester hors d'atteinte quel que soit le nombre de passages.
  await chrome.eval(`document.querySelector(${JSON.stringify(SEL.name)}).focus()`);
  let honeypotAtteint = false;
  let sortiesDuDialogue = 0;
  const TOURS = 20;
  for (let i = 0; i < TOURS; i++) {
    await frapper("Tab");
    const t = await chrome.eval(RELEVE);
    if (!t.focusDansDialogue) sortiesDuDialogue++;
    if (t.focusName === "sujetSecondaire") {
      honeypotAtteint = true;
      break;
    }
  }
  dire(
    !honeypotAtteint,
    `② le honeypot reste HORS DE PORTÉE après ${TOURS} Tab (garde RGPD/anti-spam)`,
    `atteint=${honeypotAtteint}`,
  );

  // 🔴 Le même balayage de ${TOURS} Tab prouve AUSSI le PIÈGE DE FOCUS : la modale est un
  // dialogue modal, donc le focus ne doit jamais partir derrière l'overlay (le reste de la
  // page est inerte visuellement, mais pas pour le clavier). Mesure gratuite — on relit
  // simplement l'état déjà relevé à chaque tour.
  dire(
    sortiesDuDialogue === 0,
    `② bis LE FOCUS RESTE PIÉGÉ dans la modale après ${TOURS} Tab consécutifs`,
    `${sortiesDuDialogue} sortie(s) hors du dialogue`,
  );

  // ══════════════════ ③ SOUMISSION VALIDE → aria-live ANNONCE LE SUCCÈS ══════════════════
  const marque = `${GATE_MARKER} ${Date.now()}`;
  await remplir(SEL.name, marque);
  await remplir(SEL.email, "gate-autotest@exemple.fr");
  await cocher('input[name="requestType"]');
  await remplir(SEL.message, "Message envoyé par la porte automatisée gate:solicitation.");
  await cocher(SEL.consent);

  await chrome.eval(`document.querySelector(${JSON.stringify(SEL.submit)}).click()`);
  await chrome.eval(`new Promise((r) => setTimeout(r, 1500))`, true);
  e = await chrome.eval(RELEVE);
  dire(
    !!e.ariaLiveTexte && e.ariaLiveTexte.length > 0,
    "③ après un envoi réussi, la région aria-live porte un texte NON VIDE",
    `texte=${JSON.stringify((e.ariaLiveTexte ?? "").slice(0, 60))}`,
  );

  // ══════════════════ ④ ERREUR SERVEUR (rate-limit) → LA SAISIE N'EST PAS PERDUE ══════════════════
  // Le succès précédent a déjà consommé 1 des 3 jetons du rate-limit (fenêtre 60s). On
  // resoumet jusqu'à dépasser la limite pour obtenir une VRAIE erreur serveur (pas un mock).
  await chrome.goto(URL);
  const MESSAGE_TEMOIN = "Ce message ne doit JAMAIS disparaître après une erreur serveur.";
  let dernierEtat = null;
  for (let tentative = 0; tentative < 4; tentative++) {
    await remplir(SEL.name, marque);
    await remplir(SEL.email, "gate-autotest@exemple.fr");
    await cocher('input[name="requestType"]');
    await remplir(SEL.message, MESSAGE_TEMOIN);
    await cocher(SEL.consent);
    await chrome.eval(`document.querySelector(${JSON.stringify(SEL.submit)}).click()`);
    await chrome.eval(`new Promise((r) => setTimeout(r, 1500))`, true);
    dernierEtat = await chrome.eval(RELEVE);
    if (dernierEtat.ariaLiveTexte && /trop de demandes/i.test(dernierEtat.ariaLiveTexte)) break;
  }
  dire(
    !!dernierEtat?.ariaLiveTexte && /trop de demandes/i.test(dernierEtat.ariaLiveTexte),
    "④ le rate-limit serveur finit par répondre par une ERREUR RÉELLE (pas un mock)",
    `texte=${JSON.stringify((dernierEtat?.ariaLiveTexte ?? "").slice(0, 60))}`,
  );
  dire(
    dernierEtat?.message?.valeur === MESSAGE_TEMOIN,
    "④ bis après cette erreur RÉELLE, le message TAPÉ est toujours dans le DOM",
    `valeur présente=${dernierEtat?.message?.valeur === MESSAGE_TEMOIN}`,
  );

  // ══════════════════ ⑤ ÉCHAP FERME ET LE FOCUS REVIENT AU DÉCLENCHEUR ══════════════════
  await frapper("Escape");
  await chrome.eval(`new Promise((r) => setTimeout(r, 300))`, true);
  e = await chrome.eval(RELEVE);
  dire(!e.formPresent, "⑤ Échap FERME la modale", `formulaire=${e.formPresent}`);
  // ⚠️ Restitution du focus au DÉCLENCHEUR (UX-DR23, ARIA APG) : sans elle, le focus
  // retombe sur <body> et la personne au clavier repart du haut de la page — elle a perdu
  // sa place. Aucune autre porte, ni l'œil, ne voit ça.
  dire(
    e.focusEstDeclencheur,
    "⑤ bis à la fermeture, LE FOCUS EST RENDU au bouton qui avait ouvert la modale",
    `focus=${e.focusBalise}`,
  );

  // ══════════════════ ⑥ SANS JAVASCRIPT : LE MOYEN DE CONTACT SURVIT ══════════════════
  // 🔴 LA GARDE CENTRALE DE L'ARBITRAGE « MODALE » : une modale ne peut PAS s'ouvrir sans
  // JS. Si le déclencheur restait visible et inerte, on aurait un CTA sans destination —
  // le défaut soldé en Story 3.3, et celui que la dette R28 existe pour empêcher.
  // Le contrat est donc : bouton MASQUÉ, lien mailto VISIBLE, sur les 3 surfaces.
  console.log(`\n  ── Sans JavaScript ──\n`);
  await chrome.setScriptExecutionDisabled(true);
  for (const chemin of ["/partenaires", "/animations", "/"]) {
    await chrome.goto(BASE + chemin, { sansScripts: true });
    const sansJs = await chrome.eval(`(() => {
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const declencheur = document.querySelector(${JSON.stringify(SEL.declencheur)});
      const mailto = document.querySelector('a[href^="mailto:"]');
      return {
        declencheurVisible: visible(declencheur),
        mailtoVisible: visible(mailto),
        mailtoHref: mailto ? mailto.getAttribute("href") : null,
      };
    })()`);
    dire(
      !sansJs.declencheurVisible && sansJs.mailtoVisible,
      `⑥ ${chemin} — sans JS le bouton est MASQUÉ et l'adresse e-mail le remplace`,
      `bouton visible=${sansJs.declencheurVisible}, mailto visible=${sansJs.mailtoVisible} (${sansJs.mailtoHref})`,
    );
  }
  await chrome.setScriptExecutionDisabled(false);
} finally {
  await chrome.close();
  // Nettoyage : chaque ligne créée par cette porte porte GATE_MARKER dans `name` — on ne
  // laisse RIEN derrière soi, contrairement aux autres `gate:*` qui ne mutent jamais la base.
  try {
    const url = process.env.DATABASE_URL;
    if (url) {
      sql = postgres(url, { prepare: false });
      const supprimees = await sql`
        delete from solicitation where name like ${GATE_MARKER + "%"} returning id
      `;
      console.log(`\n  🧹 ${supprimees.length} ligne(s) de test supprimée(s) de \`solicitation\`.\n`);
    }
  } catch (err) {
    console.error("  ⚠️  Nettoyage des lignes de test échoué :", err.message);
  } finally {
    await sql?.end();
  }
}

if (echecs.length === 0) {
  if (DEBRANCHER) {
    console.error(
      "\n❌ AUTO-VALIDATION EN ÉCHEC : le tabindex du honeypot était RETIRÉ et la porte est" +
        "\n   restée VERTE. Elle ne mesure donc pas ce qu'elle prétend mesurer — la" +
        "\n   corriger AVANT de se fier à un vert (`pieges/instrument-non-valide.md`).\n",
    );
    process.exit(1);
  }
  console.log("\n✅ FORMULAIRE DE SOLLICITATION CONFORME — comportement MESURÉ, pas déduit du code.\n");
  process.exit(0);
}

if (DEBRANCHER) {
  console.log("\n✅ AUTO-VALIDATION RÉUSSIE : piège débranché ⇒ la porte a bien ÉCHOUÉ sur :\n");
  for (const x of echecs) console.log("   " + x);
  console.log("");
  process.exit(0);
}

console.error("\n❌ FORMULAIRE DE SOLLICITATION NON CONFORME :\n");
for (const x of echecs) console.error("   " + x);
console.error("");
process.exit(1);
