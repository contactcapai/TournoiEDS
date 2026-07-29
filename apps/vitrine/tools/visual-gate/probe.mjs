// Sondes exécutées DANS la page. Extraites de measure.mjs pour être partagées
// avec gate.mjs — une porte et un instantané doivent regarder la même chose.
export const PROBE = `(() => {
  const pathOf = (el) => {
    const parts = [];
    let n = el;
    while (n && n.parentElement) {
      parts.unshift(Array.prototype.indexOf.call(n.parentElement.children, n));
      n = n.parentElement;
    }
    return parts.join("/");
  };
  const r2 = (v) => Math.round(v * 100) / 100;
  const rect = (el) => { const r = el.getBoundingClientRect();
    return { x: r2(r.x), y: r2(r.y), w: r2(r.width), h: r2(r.height) }; };

  const all = Array.from(document.querySelectorAll("*"));

  // Les classes CSS Modules compilées portent le NOM DU FICHIER SOURCE :
  //   "Wrap-module__FrvmEW__wrap" -> "Wrap:wrap"
  // Le hash est dérivé du contenu et change à chaque édition du fichier : on ne
  // matche donc JAMAIS la chaîne entière, seulement fichier + nom local.
  const norm = (c) => { const m = /^(.+?)-module__.*__([A-Za-z0-9]+)$/.exec(c);
    return m ? m[1] + ":" + m[2] : c; };
  const classesOf = (el) => Array.from(el.classList).map(norm);
  const hasClass = (el, name) => classesOf(el).includes(name);

  // ① Conteneurs centraux — invariant max-width: 1160px (--wrap-max), seul usage
  //    dans le site. Identifiés par leur GÉOMÉTRIE, pas par leur classe : c'est
  //    précisément la classe qui change pendant ce refactor.
  const wraps = all
    .filter((el) => getComputedStyle(el).maxWidth === "1160px")
    .map((el) => { const cs = getComputedStyle(el); return {
      path: pathOf(el), tag: el.tagName, rect: rect(el), classes: classesOf(el),
      maxWidth: cs.maxWidth, ml: cs.marginLeft, mr: cs.marginRight,
      pl: cs.paddingLeft, pr: cs.paddingRight, position: cs.position, zIndex: cs.zIndex,
    }; });

  // ①bis Quelles SOURCES déclarent encore un conteneur central ? Porte de l'AC2,
  //      exécutée sur le HTML SERVI et non sur les fichiers sources.
  const wrapSources = [...new Set(wraps.flatMap((w) =>
    w.classes.filter((c) => /:(wrap|grid|row)$/.test(c))))].sort();

  // ② Titres — graisse calculée (R11)
  const headings = all
    .filter((el) => /^H[1-6]$/.test(el.tagName))
    .map((el) => { const cs = getComputedStyle(el); return {
      path: pathOf(el), tag: el.tagName,
      text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 46),
      fontWeight: cs.fontWeight, fontFamily: cs.fontFamily.split(",")[0].trim(),
      fontSize: cs.fontSize, rect: rect(el),
    }; });

  // ③ LinkArrow — la PRIMITIVE, identifiée par sa classe source (R10).
  //    ⚠️ Un premier jet filtrait « <a> or contenant un <svg> » : il attrapait AUSSI
  //    les 4 tuiles sociales du footer, déjà à 44×44, ce qui aurait fait croire la
  //    convention satisfaite sur 4 éléments sur 7. Prédicat corrigé.
  const linkArrows = all
    .filter((el) => hasClass(el, "LinkArrow:linkArrow"))
    .map((el) => { const cs = getComputedStyle(el); return {
      path: pathOf(el), text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 46),
      rect: rect(el), minHeight: cs.minHeight, minWidth: cs.minWidth,
      pt: cs.paddingTop, pb: cs.paddingBottom, display: cs.display, lineHeight: cs.lineHeight,
    }; });

  // ④ Button variant="outline" — la VARIANTE, identifiée par sa classe source (R13).
  //    ⚠️ Un premier jet filtrait « bordure rgba(243,239,227,…) » : il attrapait les
  //    tuiles et cartes bordées à 0.08/0.1, qui ne sont pas des boutons.
  const outlines = all
    .filter((el) => hasClass(el, "Button:btnOut"))
    .map((el) => { const cs = getComputedStyle(el); return {
      path: pathOf(el), text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 46),
      borderColor: cs.borderTopColor, borderWidth: cs.borderTopWidth, rect: rect(el),
    }; });

  // ⑤ Débordement horizontal (dette R14) — BALAYAGE PAR ÉLÉMENT.
  //
  //    🔴 NE PAS revenir à \`documentElement.scrollWidth === clientWidth\` : ce test
  //    est STRUCTURELLEMENT AVEUGLE ici. \`overflow-x: clip\` (globals.css) empêche la
  //    zone défilable de croître, donc scrollWidth reste égal à clientWidth MÊME
  //    lorsqu'un bloc déborde. Prouvé par selftest.mjs : sur une page portant un bloc
  //    de 3000px dans un viewport de 800px, il renvoyait 800/800.
  //    C'est le piège dans sa forme la plus pure : le témoin choisi pour surveiller
  //    l'effet d'une garde était neutralisé PAR cette garde.
  //
  //    On mesure donc chaque boîte contre le viewport. Deux exclusions, et elles sont
  //    justifiées, pas cosmétiques :
  //      - \`aria-hidden\` : les décoratifs débordent PAR CONSTRUCTION (le filigrane
  //        couronne du hero est à left:-70px, valeur de la maquette) ;
  //      - tolérance de 2px : absorbe les arrondis sub-pixels et le \`margin: -1px\` du
  //        motif « visuellement masqué » (.sr-only), qui n'est pas un débordement.
  const de = document.documentElement;
  const vw = de.clientWidth;
  const TOL = 2;
  const debordements = all
    .filter((el) => !el.closest("[aria-hidden='true']"))
    .filter((el) => (el.textContent || "").trim().length > 0)
    .map((el) => { const r = el.getBoundingClientRect();
      return { el, gauche: r2(-r.left), droite: r2(r.right - vw) }; })
    .filter((o) => o.gauche > TOL || o.droite > TOL)
    .map((o) => ({ path: pathOf(o.el), tag: o.el.tagName,
      texte: (o.el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 40),
      depasseAGauche: o.gauche > TOL ? o.gauche : 0,
      depasseADroite: o.droite > TOL ? o.droite : 0 }));

  const overflow = { viewportWidth: vw, debordements,
    // Conservé À TITRE INFORMATIF seulement — voir l'avertissement ci-dessus.
    scrollWidthInforme: de.scrollWidth,
    ok: debordements.length === 0 };

  // ⑥ Texte du <main> — textContent (indépendant de la mise en page), AC4/AC9
  const main = document.querySelector("main#content");
  const mainText = main ? (main.textContent || "").replace(/\\s+/g, " ").trim() : null;

  // ⑦ Sections portant le motif de mouvement (non-régression 2.8)
  const revealCount = all.filter((el) =>
    Array.from(el.classList).some((c) => /reveal/.test(c))).length;

  // ⑧ Identité structurelle — compte de nœuds PAR SOUS-ARBRE STABLE.
  //    ⚠️ Un compteur GLOBAL a été essayé d'abord et il est NON DÉTERMINISTE :
  //    mesuré 241/241/242 sur trois chargements du MÊME code, parce que Next
  //    injecte des éléments au runtime (<next-route-announcer>, scripts). Il
  //    aurait produit une FAUSSE régression dans la comparaison A/B. Les trois
  //    sous-arbres ci-dessous sont stables (52/73/61 aux trois essais).
  const subtree = (sel) => { const n = document.querySelector(sel);
    return n ? n.querySelectorAll("*").length : -1; };
  const domNodes = { header: subtree("header"), main: subtree("main#content"),
    footer: subtree("footer") };

  // ⑨ CLASSES FANTÔMES — \`styles.xxx\` sur une classe qui n'existe pas vaut
  //    \`undefined\` et atterrit tel quel dans l'attribut class. AUCUNE porte ne le
  //    voit : les CSS Modules ne sont pas typés ici, donc ni lint, ni typecheck, ni
  //    build ne bronchent, et le rendu perd silencieusement des déclarations.
  //    Défaut réellement introduit puis attrapé en Story 2.10 (bande de /animations
  //    privée de son padding-top et de son fond après extraction du vocabulaire).
  const phantomClasses = all
    .filter((el) => Array.from(el.classList).some((c) => c === "undefined"))
    .map((el) => ({ path: pathOf(el), tag: el.tagName, className: el.className }));

  return { wraps, wrapSources, headings, linkArrows, outlines, overflow, mainText,
    revealCount, domNodes, phantomClasses };
})()`;

export const STICKY = `(async () => {
  const h = document.querySelector("header");
  if (!h) return { found: false };
  window.scrollTo(0, document.documentElement.scrollHeight);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const top = Math.round(h.getBoundingClientRect().top);
  const scrolled = Math.round(window.scrollY);
  window.scrollTo(0, 0);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return { found: true, topAfterScroll: top, scrollY: scrolled, sticky: top === 0 };
})()`;
