// 🔬 GARDE COMPORTEMENTALE DU BANDEAU DE LOGOS (`/`, Story 4.1).
//
// Pourquoi un contrôle dédié — le tableau qui l'a fait écrire :
//
//   défaut possible                                  lint/build  Lighthouse  gate  œil
//   pause absente ou inopérante (WCAG 2.2.2)             ❌          ❌       ❌   ⚠️
//   animation qui tourne SANS JS (pause introuvable)     ❌          ❌       ❌   ❌
//   `reduce` qui coupe l'animation ET rogne les logos    ❌          ❌       ❌   ❌
//   duplicatas lus deux fois par un lecteur d'écran      ❌          ⚠️       ❌   ❌
//
// Lighthouse **n'audite pas** le critère 2.2.2 (pause/stop/hide) : le bandeau
// afficherait 100/100 en étant non conforme. Et la sonde de débordement de `probe.mjs`
// (l.128-130) ne retient que les éléments à `textContent` NON VIDE — elle est donc
// structurellement AVEUGLE à une piste qui ne contient que des `<img>`. « 0 débordement
// rapporté » ne prouve rien ici : la porte ne s'est pas prononcée.
// C'est la configuration exacte de la dette R19 (header non sticky pendant 9 stories,
// CI verte, Lighthouse 100/100) : une garde nominale satisfaite dans le CSS, un
// comportement faux à l'exécution.
//
// Ce que ce contrôle exige, et qui ne se lit dans AUCUN fichier source :
//   ① en régime PISTE (viewport étroit), la position ÉVOLUE réellement au fil du temps ;
//   ② après clic sur la pause, elle N'ÉVOLUE PLUS (deux relevés à intervalle) ;
//   ③ SANS JavaScript, la piste est un MUR enveloppé, sans bouton et sans animation ;
//   ④ sous `prefers-reduced-motion: reduce`, idem — et TOUTES les tuiles sont visibles
//      simultanément, aucune rognée hors du cadre. Vérifié à 320px, la largeur où le
//      mur enveloppé est le seul montage qui les laisse toutes atteignables ;
//   ⑤ en régime MUR (desktop), AUCUN bouton de pause n'est rendu — rien ne bouge, donc
//      une commande de plus serait une commande MORTE (défaut réel attrapé par
//      `gate:carousel` en Story 3.3) ;
//   ⑥ la 2ᵉ copie de bouclage est bien retirée du fil d'accessibilité (pas de double
//      lecture des noms de partenaires).
//
// 🔴 LES DEUX RÉGIMES SONT ÉPROUVÉS, ET C'EST LE CŒUR DE LA PORTE. Avec les 4 logos
// d'aujourd'hui le bandeau est STATIQUE en desktop et DÉFILANT en mobile : un contrôle
// qui ne testerait qu'en 1440px conclurait « rien ne bouge, donc rien à arrêter » et ne
// prouverait RIEN du cas mobile — le seul où la pause existe.
//
// 🔴 MAIS LE CONTRAT EST DÉRIVÉ DU RÉGIME **OBSERVÉ**, JAMAIS SUPPOSÉ D'UNE LARGEUR.
// Une première version de cette porte exigeait « MUR à 1440px ». Éprouvée par INJECTION
// de 11 logos (l'état vers lequel le projet va, à mesure que les fichiers manquants
// arrivent), elle est passée au ROUGE sur un comportement parfaitement CORRECT : 11
// tuiles font 1900px de piste pour 1108px de conteneur au maximum (`--wrap-max`), donc
// le bandeau défile à TOUTES les largeurs — et c'est la règle « on n'anime que ce qui
// déborde » qui s'applique, pas un défaut. Une porte qui crie au loup sur un changement
// légitime finit désactivée. Même conception que `gate:carousel`, dont le contrat dépend
// du nombre de vignettes réellement présentes.
//
// Ce qui reste EXIGÉ inconditionnellement, quel que soit le nombre de logos :
//   - les invariants du régime observé (colonne de gauche du tableau ci-dessous) ;
//   - le régime PISTE éprouvé AU MOINS UNE FOIS — c'est lui qui porte les obligations
//     WCAG. S'il n'est atteignable à aucune largeur (cas d'un logo unique), la porte le
//     DIT au lieu de conclure faussement ;
//   - sans JS et sous `reduce`, le MUR **toujours**, et aucune tuile rognée. Ces deux-là
//     ne dépendent ni de la largeur ni des données : c'est la garde anti-perte-de-contenu.
//
// Usage :  node tools/visual-gate/marquee-check.mjs [baseUrl]
//          MARQUEE_DEBRANCHER_PAUSE=1 …  → auto-validation de l'instrument (voir plus bas)
import { launchChrome } from "./cdp.mjs";
import { BASE as BASE_DEFAUT } from "./config.mjs";

const BASE = process.argv[2] ?? BASE_DEFAUT;
const URL = BASE + "/";

/**
 * 🔬 AUTO-VALIDATION DE L'INSTRUMENT (`pieges/instrument-non-valide.md`, payé 4 fois
 * sur ce projet). Avec `MARQUEE_DEBRANCHER_PAUSE=1`, on DÉBRANCHE la pause dans la page
 * (l'animation repart juste après le clic) et cette porte DOIT échouer sur ⑤.
 * Une porte dont on n'a jamais vu l'échec ne prouve pas qu'elle mesure quelque chose.
 */
const DEBRANCHER_PAUSE = process.env.MARQUEE_DEBRANCHER_PAUSE === "1";

const LARGEUR_MUR = 1440; // avec peu de logos : régime statique
const LARGEUR_PISTE = 320; // la plus étroite des 7 largeurs de référence du projet

/**
 * 🔴 LARGEUR DE FORÇAGE — délibérément absurde, et son seul rôle est de GARANTIR que la
 * branche PISTE est exercée quelles que soient les données.
 *
 * Pourquoi elle existe : avec UN SEUL logo (l'état réel de la production au démarrage,
 * tant que les fichiers n'arrivent pas), une tuile de 160px tient dans les 268px
 * disponibles à 320px de viewport — le bandeau est donc statique PARTOUT, et la porte
 * n'aurait jamais éprouvé le mouvement ni sa pause. Elle serait passée verte en ne
 * mesurant rien de ce qu'elle existe pour mesurer : exactement le mode de défaillance de
 * la dette R19. À 200px de viewport il reste ~148px de place, donc une seule tuile
 * déborde et la branche est atteinte.
 * ⚠️ Ce n'est PAS une largeur de rendu à supporter : elle ne rejoint pas `GATE_WIDTHS`,
 * et rien de son APPARENCE n'est vérifié ici — seulement le comportement du bandeau.
 */
const LARGEUR_FORCAGE = 200;

const sonde = await fetch(URL).catch(() => null);
if (!sonde?.ok) {
  console.error(`\n❌ Rien ne répond correctement sur ${URL}.`);
  console.error("   Lancer : pnpm --filter vitrine build && pnpm --filter vitrine start");
  console.error("   ⚠️ `/` LIT LA BASE (Story 3.2) : le Postgres de dev doit tourner et");
  console.error("      apps/vitrine/.env.local être renseigné, sinon la page répond en");
  console.error("      erreur et cette porte ne mesure RIEN.");
  console.error("      docker compose -f docker/docker-compose.dev.yml up -d\n");
  process.exit(2);
}

// Sélecteurs par SUFFIXE de classe CSS Modules : le hash change à chaque édition du
// fichier, le nom de la classe source non (même convention que probe.mjs et
// carousel-check.mjs).
const SEL = {
  section: `section[class*="ProofBand-module"]`,
  cadre: `div[class*="__cadre"]`,
  piste: `ul[class*="__piste"]`,
  tuile: `li[class*="__tuile"]`,
  pause: `button[class*="__pause"]`,
};

/** Relevé complet de l'état du bandeau, tel qu'il est RENDU. */
const RELEVE = `(() => {
  const section = document.querySelector(${JSON.stringify(SEL.section)});
  const cadre = document.querySelector(${JSON.stringify(SEL.cadre)});
  const piste = document.querySelector(${JSON.stringify(SEL.piste)});
  const tuiles = Array.from(document.querySelectorAll(${JSON.stringify(SEL.tuile)}));
  const pause = document.querySelector(${JSON.stringify(SEL.pause)});
  if (!section || !cadre || !piste) {
    return { present: false, section: !!section, cadre: !!cadre, piste: !!piste };
  }
  const csPiste = getComputedStyle(piste);
  const rc = cadre.getBoundingClientRect();
  // 🔴 LA POSITION EST LUE SUR LA PREMIÈRE TUILE, PAS SUR scrollLeft/scrollWidth.
  // Le cadre est en \`overflow: clip\` : sa zone défilable NE CROÎT PAS, donc
  // scrollWidth y reste égal à clientWidth même quand la piste déborde largement.
  // C'est le piège documenté dans CLAUDE.md §3 — on mesure donc la géométrie réelle.
  const premiere = tuiles[0] ? tuiles[0].getBoundingClientRect().left : null;
  return {
    present: true,
    // Régime : la classe \`piste_defile\` n'est posée qu'après hydratation ET seulement
    // si la largeur mesurée déborde du cadre.
    defile: /__piste_defile/.test(piste.className),
    enPause: /__piste_pause/.test(piste.className),
    animationName: csPiste.animationName,
    playState: csPiste.animationPlayState,
    flexWrap: csPiste.flexWrap,
    overflowCadre: getComputedStyle(cadre).overflow,
    position: premiere,
    tuiles: tuiles.length,
    // ⑥ Duplicatas hors du fil d'accessibilité + \`alt\` vide.
    tuilesCachees: tuiles.filter((t) => t.getAttribute("aria-hidden") === "true").length,
    altsVides: tuiles.filter((t) => {
      const img = t.querySelector("img");
      return img && img.getAttribute("alt") === "";
    }).length,
    altsRemplis: tuiles
      .filter((t) => t.getAttribute("aria-hidden") !== "true")
      .map((t) => { const i = t.querySelector("img"); return i ? i.getAttribute("alt") : null; }),
    boutonPause: !!pause,
    ariaPressed: pause ? pause.getAttribute("aria-pressed") : null,
    ariaLabelPause: pause ? pause.getAttribute("aria-label") : null,
    taillePause: pause
      ? (() => { const r = pause.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()
      : null,
    // ④ Aucune tuile rognée hors du cadre : chaque boîte doit tenir dans la boîte du
    // cadre, à 2px de tolérance sub-pixel près (même tolérance que probe.mjs).
    rogneesHorsCadre: tuiles.filter((t) => {
      const r = t.getBoundingClientRect();
      return r.left < rc.left - 2 || r.right > rc.right + 2;
    }).length,
    cadreLargeur: Math.round(rc.width),
  };
})()`;

const chrome = await launchChrome(9379);
const echecs = [];
const dire = (ok, n, detail) => {
  console.log(`  ${ok ? "✅" : "❌"} ${n} — ${detail}`);
  if (!ok) echecs.push(`${n} (${detail})`);
};

/** Deux relevés de position espacés de `ms` : c'est ce qui prouve un MOUVEMENT. */
const positionDeuxFois = (ms) =>
  chrome.eval(
    `(async () => {
      const lire = () => {
        const t = document.querySelector(${JSON.stringify(SEL.tuile)});
        return t ? t.getBoundingClientRect().left : null;
      };
      const avant = lire();
      await new Promise((r) => setTimeout(r, ${ms}));
      return { avant, apres: lire() };
    })()`,
    true,
  );

/**
 * Invariants qui doivent tenir dans le régime RÉELLEMENT observé, quel qu'il soit.
 * C'est ici que vit la règle « on n'anime que ce qui déborde », vérifiée dans les deux
 * sens : ce qui bouge a une pause, ce qui ne bouge pas n'a pas de commande morte.
 */
const verifierRegime = (e, largeur) => {
  const nom = e.defile ? "PISTE" : "MUR";
  console.log(`  ▸ largeur ${largeur}px → cadre ${e.cadreLargeur}px, régime observé : ${nom}\n`);

  dire(
    e.overflowCadre.startsWith("clip"),
    `[${nom}] le cadre est en \`clip\` et JAMAIS \`hidden\``,
    `overflow=${e.overflowCadre}`,
  );
  const noms = e.altsRemplis.filter((a) => a && a.length > 0).length;
  dire(
    noms === e.altsRemplis.length && noms > 0,
    `[${nom}] chaque logo NON décoratif porte le nom de son partenaire en alt`,
    `${noms}/${e.altsRemplis.length} — ${JSON.stringify(e.altsRemplis)}`,
  );

  if (!e.defile) {
    // MUR : rien ne bouge ⇒ aucune commande, aucune copie, et surtout rien de rogné.
    dire(
      e.boutonPause === false,
      "[MUR] rien ne bouge ⇒ AUCUN bouton de pause (pas de commande morte)",
      `bouton présent : ${e.boutonPause}`,
    );
    dire(
      e.tuilesCachees === 0,
      "[MUR] aucune copie de bouclage (elle ne servirait à rien)",
      `${e.tuiles} tuile(s), dont ${e.tuilesCachees} aria-hidden`,
    );
    dire(
      e.flexWrap === "wrap",
      "[MUR] la piste est bien ENVELOPPÉE",
      `flex-wrap=${e.flexWrap}`,
    );
    dire(
      e.rogneesHorsCadre === 0,
      "[MUR] aucune tuile rognée hors du cadre — toutes atteignables",
      `${e.rogneesHorsCadre} rognée(s) sur ${e.tuiles}`,
    );
    return;
  }

  // PISTE : c'est le régime qui porte les obligations WCAG 2.2.2.
  dire(
    e.boutonPause === true,
    "[PISTE] ça bouge ⇒ le bouton de pause EST rendu (WCAG 2.2.2)",
    `bouton=${e.boutonPause}, aria-pressed=${e.ariaPressed}`,
  );
  dire(
    e.flexWrap === "nowrap" && e.animationName !== "none",
    "[PISTE] piste sur une ligne + animation appliquée",
    `flex-wrap=${e.flexWrap}, animation=${e.animationName}`,
  );
  dire(
    e.tuilesCachees > 0 && e.tuiles === e.tuilesCachees * 2,
    "[PISTE] la 2ᵉ copie existe et est ENTIÈREMENT hors du fil d'accessibilité",
    `${e.tuiles} tuiles, ${e.tuilesCachees} aria-hidden`,
  );
  dire(
    e.altsVides === e.tuilesCachees,
    '[PISTE] chaque copie a AUSSI son image en alt=""',
    `${e.altsVides} alt vides pour ${e.tuilesCachees} copies`,
  );
  dire(
    e.taillePause !== null && e.taillePause[0] >= 44 && e.taillePause[1] >= 44,
    "[PISTE] cible tactile du bouton ≥ 44×44 (convention projet)",
    `${e.taillePause ? e.taillePause.join("×") : "absent"}`,
  );
  dire(
    !!e.ariaLabelPause && e.ariaPressed === "false",
    "[PISTE] libellé accessible explicite + aria-pressed initialisé",
    `aria-label=${JSON.stringify(e.ariaLabelPause)}, aria-pressed=${e.ariaPressed}`,
  );
};

const regimesVus = new Set();
/**
 * Vrai quand le régime PISTE ne PEUT PAS être atteint, et que c'est correct : une seule
 * tuile, bornée par `max-width: 100%`, se réduit au lieu de déborder — donc rien à faire
 * défiler. C'est l'état RÉEL de la production au démarrage, tant que les logos n'arrivent
 * pas. Distinguer ce cas d'une bascule cassée est tout l'enjeu : les deux se présentent
 * comme « régime MUR partout ».
 */
let pisteInatteignable = false;

try {
  // ══════════════ ⑤ LARGE (desktop) — régime attendu MUR avec peu de logos ══════════════
  console.log(`\n  ── Viewport large (${LARGEUR_MUR}px) ──\n`);
  await chrome.setViewport(LARGEUR_MUR);
  await chrome.goto(URL);
  const large = await chrome.eval(RELEVE);

  if (!large.present) {
    console.error(
      `\n❌ Bandeau INTROUVABLE sur ${URL} (section=${large.section}, cadre=${large.cadre}, piste=${large.piste}).`,
    );
    console.error("   Si la base ne contient aucun partenaire AVEC LOGO, le bloc est");
    console.error("   volontairement absent du DOM (AC6) — c'est un état légitime, mais");
    console.error("   alors cette porte ne peut rien mesurer : lancer `pnpm --filter vitrine db:seed`.\n");
    await chrome.close();
    process.exit(2);
  }

  verifierRegime(large, LARGEUR_MUR);
  regimesVus.add(large.defile ? "piste" : "mur");

  // ══════════════ ①② ÉTROIT (mobile, 320px) — le cas le plus tendu ══════════════
  console.log(`\n  ── Viewport étroit (${LARGEUR_PISTE}px) ──\n`);
  await chrome.setViewport(LARGEUR_PISTE);
  await chrome.goto(URL);

  if (DEBRANCHER_PAUSE) {
    // Auto-validation : on remet l'animation en marche 150ms après chaque clic. La
    // pause « répond » donc (aria-pressed bascule) mais n'ARRÊTE RIEN — exactement le
    // défaut que ⑤ doit voir. Si la porte reste verte ici, elle ne mesure rien.
    await chrome.eval(`(() => {
      const b = document.querySelector(${JSON.stringify(SEL.pause)});
      const p = document.querySelector(${JSON.stringify(SEL.piste)});
      if (!b || !p) return "cible absente";
      b.addEventListener("click", () => {
        setTimeout(() => { p.style.animationPlayState = "running"; }, 150);
      });
      return "pause débranchée";
    })()`);
    console.log("  ⚠️  MARQUEE_DEBRANCHER_PAUSE=1 — la pause est DÉBRANCHÉE, un ÉCHEC est ATTENDU\n");
  }

  let piste = await chrome.eval(RELEVE);
  verifierRegime(piste, LARGEUR_PISTE);
  regimesVus.add(piste.defile ? "piste" : "mur");

  // ══════════ Forçage : la branche PISTE DOIT être exercée, données ou pas ══════════
  if (!piste.defile) {
    console.log(
      `\n  ── Forçage du régime PISTE (viewport ${LARGEUR_FORCAGE}px, largeur non supportée) ──\n`,
    );
    console.log(
      "  Peu de logos ⇒ le bandeau est statique même à 320px. On rétrécit jusqu'à ce\n" +
        "  qu'UNE tuile déborde, sinon le mouvement et sa pause ne seraient jamais mesurés.\n",
    );
    await chrome.setViewport(LARGEUR_FORCAGE);
    await chrome.goto(URL);
    piste = await chrome.eval(RELEVE);
    if (piste.defile) {
      dire(
        true,
        `[FORÇAGE] à ${LARGEUR_FORCAGE}px, le bandeau BASCULE bien en piste`,
        `cadre=${piste.cadreLargeur}px`,
      );
      verifierRegime(piste, LARGEUR_FORCAGE);
      regimesVus.add("piste");
    } else if (piste.tuiles > 1) {
      // 🔴 ÉCHEC RÉEL : avec 2 tuiles ou plus, une piste de 2×160px + gouttière NE PEUT
      // PAS tenir dans 148px. Si le composant reste en mur ici, c'est la BASCULE DE
      // RÉGIME qui est cassée — le défaut le plus grave possible pour ce composant,
      // puisqu'il ferait disparaître le bouton de pause tout en laissant croire que
      // tout va bien.
      dire(
        false,
        `[FORÇAGE] à ${LARGEUR_FORCAGE}px avec ${piste.tuiles} tuiles, le bandeau DEVRAIT basculer en piste`,
        `cadre=${piste.cadreLargeur}px, régime=MUR — la bascule de régime est cassée`,
      );
    } else {
      // 🔴 LÉGITIME ET NON UN ÉCHEC : avec UNE seule tuile, aucune largeur ne peut faire
      // déborder la piste — la tuile est bornée par `max-width: 100%`, elle se réduit
      // au lieu de dépasser. Un logo unique n'a rien à faire défiler, c'est le
      // comportement voulu. On le DIT au lieu de conclure faussement dans un sens ou
      // dans l'autre (même conception que le contrat « vignette unique » de
      // `gate:carousel`).
      pisteInatteignable = true;
      console.log(
        "\n  ⚠️  UNE SEULE tuile : le régime PISTE est structurellement inatteignable,\n" +
          "      et c'est correct. ⇒ LE MOUVEMENT ET SA PAUSE N'ONT PAS ÉTÉ MESURÉS par\n" +
          "      cette exécution. Pour les éprouver : `pnpm --filter vitrine db:seed`\n" +
          "      (4 logos ⇒ mur en desktop, piste en mobile).\n",
      );
    }
    // Si le forçage échoue AVEC 2 tuiles ou plus, l'échec est RÉEL et reste dans la
    // liste : la bascule de régime est cassée.
  }

  // ══════════ ①② LE MOUVEMENT ET SA PAUSE — dans le régime PISTE ══════════
  if (piste.defile) {
    // ① Le mouvement, MESURÉ — deux relevés espacés. C'est ce qui distingue « une
    // animation est déclarée dans le CSS » de « la piste avance réellement ».
    const bouge = await positionDeuxFois(600);
    dire(
      bouge.avant !== null && bouge.apres !== null && Math.abs(bouge.apres - bouge.avant) > 1,
      "① la position ÉVOLUE réellement au fil du temps",
      `x ${bouge.avant?.toFixed(1)} → ${bouge.apres?.toFixed(1)} en 600ms`,
    );

    // ② Clic RÉEL sur la pause, puis deux relevés espacés.
    const apresClic = await chrome.eval(
      `(() => {
        const b = document.querySelector(${JSON.stringify(SEL.pause)});
        if (!b) return { clique: false };
        b.click();
        return { clique: true };
      })()`,
    );
    dire(apresClic.clique, "② le bouton de pause a pu être cliqué", `clic=${apresClic.clique}`);

    // 350ms d'attente APRÈS le clic : laisse React re-rendre avant de figer la
    // référence, sinon on relèverait « avant » sur une piste encore en mouvement.
    await chrome.eval(`new Promise((r) => setTimeout(r, 350))`, true);
    const enPause = await chrome.eval(RELEVE);
    dire(
      enPause.ariaPressed === "true" && enPause.enPause === true,
      "② bis l'état de la bascule est reflété (aria-pressed + classe)",
      `aria-pressed=${enPause.ariaPressed}, classe pause=${enPause.enPause}`,
    );
    dire(
      enPause.playState === "paused",
      "② ter `animation-play-state` vaut bien `paused`",
      `play-state=${enPause.playState}`,
    );

    // 🔴 LA MESURE QUI COMPTE : la position ne doit PLUS bouger. C'est elle qui
    // distingue « la classe est posée » de « le défilement est arrêté ». C'est
    // exactement ce contrôle que l'auto-validation fait échouer.
    const figee = await positionDeuxFois(800);
    dire(
      figee.avant !== null && figee.apres !== null && Math.abs(figee.apres - figee.avant) <= 1,
      "② quater APRÈS PAUSE, la position N'ÉVOLUE PLUS (2 relevés à 800ms)",
      `x ${figee.avant?.toFixed(1)} → ${figee.apres?.toFixed(1)}`,
    );

    // Reprise : un bouton bascule qui ne relance pas serait à moitié cassé.
    await chrome.eval(`document.querySelector(${JSON.stringify(SEL.pause)}).click()`);
    await chrome.eval(`new Promise((r) => setTimeout(r, 200))`, true);
    const reparti = await positionDeuxFois(600);
    dire(
      reparti.avant !== null && Math.abs(reparti.apres - reparti.avant) > 1,
      "② quinquies un 2ᵉ clic RELANCE le défilement",
      `x ${reparti.avant?.toFixed(1)} → ${reparti.apres?.toFixed(1)}`,
    );
  }

  // ══════════════════════ ③ SANS JAVASCRIPT (320px) ══════════════════════
  //
  // 🔴 ON REVIENT EXPLICITEMENT À `LARGEUR_PISTE`, ET C'EST UNE CORRECTION MESURÉE :
  // la passe de forçage laisse le viewport à 200px, une largeur que le site ne
  // prétend PAS supporter. Sans ce retour, ③ et ④ mesuraient à 200px et signalaient
  // un rognage qui n'existe à aucune largeur réelle — un FAUX POSITIF qui aurait
  // discrédité la porte au premier passage. Les gardes anti-perte-de-contenu se
  // vérifient à la plus étroite largeur SUPPORTÉE, pas à la plus étroite testable.
  console.log(`\n  ── Sans JavaScript (viewport ${LARGEUR_PISTE}px) ──\n`);
  await chrome.setViewport(LARGEUR_PISTE);
  await chrome.setScriptExecutionDisabled(true);
  // `sansScripts: true` : sans lui, `goto` attendrait une promesse de la page qui ne se
  // résoudra jamais (scripts coupés) et la porte tomberait sur « Promise was collected »
  // au lieu de mesurer. Défaut trouvé par l'auto-validation ci-dessous, pas déduit.
  await chrome.goto(URL, { sansScripts: true });
  const sansJs = await chrome.eval(RELEVE);
  dire(
    sansJs.present && sansJs.defile === false,
    "③ sans JS, la piste reste un MUR enveloppé",
    `présent=${sansJs.present}, régime=${sansJs.defile ? "PISTE" : "mur"}, flex-wrap=${sansJs.flexWrap}`,
  );
  dire(
    sansJs.animationName === "none",
    "③ bis sans JS, AUCUNE animation n'est appliquée",
    `animation-name=${sansJs.animationName}`,
  );
  dire(
    sansJs.boutonPause === false,
    "③ ter sans JS, aucun bouton de pause (il ne pourrait rien faire)",
    `bouton=${sansJs.boutonPause}`,
  );
  dire(
    sansJs.rogneesHorsCadre === 0,
    "③ quater sans JS, AUCUNE tuile rognée hors du cadre",
    `${sansJs.rogneesHorsCadre} rognée(s) sur ${sansJs.tuiles}`,
  );
  await chrome.setScriptExecutionDisabled(false);

  // ═══════════ ④ prefers-reduced-motion: reduce (320px, le cas le plus tendu) ═══════════
  console.log(`\n  ── prefers-reduced-motion: reduce (viewport ${LARGEUR_PISTE}px) ──\n`);
  await chrome.setViewport(LARGEUR_PISTE); // idem ③ : largeur SUPPORTÉE, pas celle du forçage
  await chrome.setEmulatedMedia({ "prefers-reduced-motion": "reduce" });
  await chrome.goto(URL);
  const reduit = await chrome.eval(RELEVE);
  dire(
    reduit.defile === false,
    "④ sous `reduce`, la piste REPASSE EN MUR (pas seulement animation: none)",
    `régime=${reduit.defile ? "PISTE" : "mur"}, flex-wrap=${reduit.flexWrap}`,
  );
  dire(
    reduit.animationName === "none",
    "④ bis sous `reduce`, aucune animation",
    `animation-name=${reduit.animationName}`,
  );
  dire(
    reduit.boutonPause === false,
    "④ ter sous `reduce`, aucun bouton de pause (rien ne bouge)",
    `bouton=${reduit.boutonPause}`,
  );
  // 🔴 C'EST LA GARDE CENTRALE DE ④, et le défaut qu'elle interdit est une PERTE DE
  // CONTENU : se contenter d'`animation: none` sur une piste `nowrap` laisserait à
  // 320px plus de la moitié des logos hors du cadre, dans une boîte que `clip` rend
  // NON défilable — donc inatteignables, pour toujours.
  dire(
    reduit.rogneesHorsCadre === 0 && reduit.tuiles > 0,
    `④ quater les ${reduit.tuiles} tuiles sont TOUTES visibles simultanément, aucune rognée`,
    `${reduit.rogneesHorsCadre} hors du cadre de ${reduit.cadreLargeur}px`,
  );
  const bougeReduit = await positionDeuxFois(600);
  dire(
    Math.abs(bougeReduit.apres - bougeReduit.avant) <= 1,
    "④ quinquies sous `reduce`, RIEN ne bouge (mesuré, pas déduit du CSS)",
    `x ${bougeReduit.avant?.toFixed(1)} → ${bougeReduit.apres?.toFixed(1)}`,
  );
  await chrome.setEmulatedMedia({});

  // ═══════════════ Couverture des régimes : DIRE ce qui n'a pas été éprouvé ═══════════════
  console.log("\n  ── Couverture ──\n");
  if (pisteInatteignable) {
    // 🔴 NE PAS TRANSFORMER CE CAS EN VERT SILENCIEUX. La porte sort en succès parce que
    // le comportement observé est correct, mais elle DIT que la moitié de son contrat
    // n'a pas pu être éprouvée. Un « ✅ » sans cette phrase ferait croire que le
    // mouvement et sa pause ont été vérifiés — c'est précisément le genre de faux
    // témoignage que cet outillage existe pour supprimer.
    console.log(
      "  ⚠️  régime PISTE NON ÉPROUVÉ (une seule tuile ⇒ inatteignable par construction).\n" +
        "      Les obligations WCAG 2.2.2 ne sont donc PAS vérifiées par cette exécution.\n" +
        "      Le mur, lui, l'est — y compris sans JS et sous `reduce`.",
    );
  } else {
    dire(
      regimesVus.has("piste"),
      "le régime PISTE a été éprouvé au moins une fois (il porte les obligations WCAG)",
      `régimes vus : ${[...regimesVus].join(" + ")}`,
    );
  }
  if (!regimesVus.has("mur")) {
    // Pas un échec : avec assez de logos, la piste déborde à TOUTES les largeurs (11
    // logos = 1900px de piste pour 1108px de conteneur au maximum). Mais un silence
    // ici laisserait croire que les deux régimes ont été couverts.
    console.log(
      "  ⚠️  régime MUR non atteint aux largeurs testées : la piste déborde partout\n" +
        "      (assez de logos pour cela). Le mur reste éprouvé par ③ et ④ ci-dessus,\n" +
        "      qui l'exigent inconditionnellement — c'est là que porte la garde.",
    );
  }
} finally {
  await chrome.close();
}

if (echecs.length === 0) {
  if (DEBRANCHER_PAUSE) {
    console.error(
      "\n❌ AUTO-VALIDATION EN ÉCHEC : la pause était DÉBRANCHÉE et la porte est restée" +
        "\n   VERTE. Elle ne mesure donc pas ce qu'elle prétend mesurer — la corriger" +
        "\n   AVANT de se fier à un vert (`pieges/instrument-non-valide.md`).\n",
    );
    process.exit(1);
  }
  console.log(
    `\n✅ BANDEAU CONFORME — comportement MESURÉ (régime(s) éprouvé(s) : ${[...regimesVus].join(" + ")}` +
      " + mur sans JS + mur sous reduce), pas déduit du CSS.\n",
  );
  process.exit(0);
}

if (DEBRANCHER_PAUSE) {
  console.log(
    "\n✅ AUTO-VALIDATION RÉUSSIE : pause débranchée ⇒ la porte a bien ÉCHOUÉ sur :\n",
  );
  for (const e of echecs) console.log("   " + e);
  console.log("");
  process.exit(0);
}

console.error("\n❌ BANDEAU NON CONFORME :\n");
for (const e of echecs) console.error("   " + e);
console.error("");
process.exit(1);
