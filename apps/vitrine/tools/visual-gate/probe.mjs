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
  //    On mesure donc chaque boîte contre le viewport. TROIS exclusions, et elles sont
  //    justifiées, pas cosmétiques :
  //      - \`aria-hidden\` : les décoratifs débordent PAR CONSTRUCTION (le filigrane
  //        couronne du hero est à left:-70px, valeur de la maquette) ;
  //      - tolérance de 2px : absorbe les arrondis sub-pixels et le \`margin: -1px\` du
  //        motif « visuellement masqué » (.sr-only), qui n'est pas un débordement ;
  //      - le contenu d'un CONTENEUR DÉFILANT VOLONTAIRE (voir ci-dessous, Story 3.3).
  const de = document.documentElement;
  const vw = de.clientWidth;
  const TOL = 2;

  //    🔬 EXCLUSION n°3 — ce que R14 désigne vraiment, c'est du contenu **rogné EN
  //    SILENCE et devenu inatteignable**. Du contenu qui dépasse À L'INTÉRIEUR d'une
  //    boîte que l'utilisateur peut FAIRE DÉFILER n'est ni rogné ni inatteignable :
  //    il est à un geste de distance, et il reste dans le fil d'accessibilité.
  //    C'est le cas du carrousel « déjà passé » de /agenda (Story 3.3).
  //
  //    ⚠️ L'EXCLUSION EST CONDITIONNELLE, et c'est ce qui l'empêche d'être une porte
  //    dérobée : elle ne vaut que si le conteneur défilant TIENT LUI-MÊME dans le
  //    viewport. Un carrousel qui déborderait de l'écran resterait signalé — sinon il
  //    aurait suffi d'écrire \`overflow-x: auto\` quelque part pour faire taire la porte
  //    sur tout un sous-arbre.
  //
  //    \`clip\` (html/body, globals.css) n'est PAS un conteneur défilant : la boîte
  //    n'est pas défilable, donc la règle ci-dessous ne l'attrape pas — ce qui est
  //    exactement le comportement voulu.
  const conteneurDefilant = (el) => {
    let n = el.parentElement;
    while (n) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === "auto" || ox === "scroll") return n;
      n = n.parentElement;
    }
    return null;
  };
  const dansDefilantSain = (el) => {
    const c = conteneurDefilant(el);
    if (!c) return false;
    const r = c.getBoundingClientRect();
    return -r.left <= TOL && r.right - vw <= TOL;
  };

  const candidats = all
    .filter((el) => !el.closest("[aria-hidden='true']"))
    .filter((el) => (el.textContent || "").trim().length > 0);

  const exclusDefilant = candidats.filter((el) => {
    const r = el.getBoundingClientRect();
    return (-r.left > TOL || r.right - vw > TOL) && dansDefilantSain(el);
  }).length;

  const debordements = candidats
    .filter((el) => !dansDefilantSain(el))
    .map((el) => { const r = el.getBoundingClientRect();
      return { el, gauche: r2(-r.left), droite: r2(r.right - vw) }; })
    .filter((o) => o.gauche > TOL || o.droite > TOL)
    .map((o) => ({ path: pathOf(o.el), tag: o.el.tagName,
      texte: (o.el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 40),
      depasseAGauche: o.gauche > TOL ? o.gauche : 0,
      depasseADroite: o.droite > TOL ? o.droite : 0 }));

  //    ══════════════════════════════════════════════════════════════════════════════
  //    🔴 ⑨ DÉBORDEMENT DE **TEXTE À L'INTÉRIEUR DE SA PROPRE BOÎTE** — dette R38,
  //       tranchée au niveau GÉNÉRAL par la Story 6.10.
  //    ══════════════════════════════════════════════════════════════════════════════
  //
  //    La mesure ① ci-dessus balaie les BOÎTES contre le viewport. Or un bloc garde la
  //    largeur de son conteneur : quand un mot insécable dépasse, **la boîte ne grandit
  //    pas — c'est le TEXTE qui déborde D'ELLE**. ① est donc structurellement aveugle à
  //    ce cas, et \`overflow-x: clip\` le rogne EN SILENCE.
  //
  //    🔬 MESURÉ en Story 6.9 : un intitulé d'atelier de 80 caractères insécables (une
  //    saisie VALIDE, à la borne) faisait à 320px de viewport **248px de boîte pour
  //    2006px de texte — 1758px de débordement**, et \`pnpm --filter vitrine gate\`
  //    RESTAIT VERTE. À 412px : 1666px. La 6.9 a posé un repli local ; la portée réelle
  //    est TOUTE page rendant du texte SAISI (légendes de photos, descriptions de
  //    partenaires, titres et récapitulatifs d'événements, intitulés d'ateliers, prénoms
  //    et rôles de membres). C'était le 3ᵉ paiement de la même dette (4.3, 6.9, 6.10).
  //
  //    🔴 LE TÉMOIN EST \`element.scrollWidth > element.clientWidth\`, **PAR ÉLÉMENT** —
  //    à ne pas confondre avec le témoin INTERDIT du projet
  //    (\`documentElement.scrollWidth === clientWidth\`), aveugle sous \`overflow-x: clip\`.
  //    La différence est réelle et non verbale : ici la comparaison porte sur un
  //    ÉLÉMENT dont la boîte est bornée par son conteneur, là-bas sur le document, dont
  //    la zone défilable est justement ce que \`clip\` empêche de croître.
  //
  //    🔴 LE CONTRÔLE PORTE SUR LES **FEUILLES DE TEXTE** — ÉLÉMENTS SANS ENFANT
  //    ÉLÉMENT — ET C'EST UNE DÉCISION, PAS UNE COMMODITÉ.
  //
  //    Le défaut que R38 décrit est « un texte trop long pour SA PROPRE boîte ». Il se
  //    produit sur l'élément qui contient directement le texte : le \`<h4>\` d'une card,
  //    le \`<p>\` d'un rôle, le \`<li>\` d'une liste. Un ANCÊTRE, lui, hérite mécaniquement
  //    du \`scrollWidth\` gonflé de ses descendants : le signaler est un ARTEFACT DE
  //    PROPAGATION, pas une seconde découverte. MESURÉ le 2026-08-05, les trois familles
  //    d'artefacts qu'une version naïve rapportait :
  //      · \`Hero .accent\` (+4px) — il ne fait qu'ENVELOPPER un \`Brush\`, dont le trait
  //        \`::after\` déborde par construction ;
  //      · \`Hero .photoCol\` (+8px) — il enveloppe le \`Sticker\`, dont la rotation étend
  //        la boîte englobante au-delà de la boîte de mise en page ;
  //      · \`PastCarousel .viewport\` (+2574px) — c'est le conteneur défilant lui-même,
  //        dont \`scrollWidth > clientWidth\` est très exactement CE QUI LE REND DÉFILABLE.
  //    Aucun des trois n'est un texte rogné. Se restreindre aux feuilles les élimine
  //    tous les trois **par construction**, sans inventer trois exemptions ad hoc.
  //
  //    ⚠️ LIMITE DÉCLARÉE ET ASSUMÉE : un débordement de texte dans un élément qui porte
  //    AUSSI des enfants éléments n'est pas vu. C'est le prix de la précision ici, et il
  //    est modeste — le texte saisi est rendu dans des feuilles partout sur ce site.
  //
  //    QUATRE EXCLUSIONS de plus, toutes DÉCLARÉES en sortie de porte (une exclusion
  //    muette laisse croire que la porte couvre tout) :
  //      - \`aria-hidden\` : décoratifs, déjà exclus de ① pour la même raison ;
  //      - le motif « visuellement masqué » (.sr-only) : sa boîte fait 1px par
  //        construction, donc TOUT texte y « déborde » — 92 à 126px mesurés. Ce n'est
  //        pas un défaut, c'est le motif lui-même ;
  //      - la primitive \`Brush\`, feuille elle-même, dont le \`::after\` est posé à
  //        \`left/right: -4px\` — +4px de \`scrollWidth\` PAR CONSTRUCTION ;
  //      - les conteneurs réellement DÉFILANTS, eux-mêmes ou en ancêtre : le contenu y
  //        est à un geste de distance, pas rogné — même raisonnement que l'exclusion
  //        n°3 de ①.
  //
  //    ⚠️ TOLÉRANCE 2px, comme ① : les arrondis sub-pixels de \`scrollWidth\` (entier)
  //    face à \`clientWidth\` (entier lui aussi, mais arrondi d'une largeur fractionnaire)
  //    produisent régulièrement 1px d'écart sans aucun débordement réel.
  const estSrOnly = (el) => classesOf(el).some((c) => /^sr-only$/.test(c));
  const dansDefilantQuelconque = (el) => conteneurDefilant(el) !== null;
  //    🔬 EXEMPTION \`Brush\` — MESURÉE, PAS SUPPOSÉE, ET NOMMÉE PLUTÔT QUE SEUILLÉE.
  //    La primitive \`Brush\` (@repo/ui) pose son trait de pinceau en \`::after\` avec
  //    \`left: -4px; right: -4px\` : le pseudo-élément déborde donc de la boîte du
  //    \`<span>\` PAR CONSTRUCTION, et gonfle \`scrollWidth\` de +4px. Mesuré sur les 5
  //    pages : 4px exactement, toujours, sur les seuls \`Brush\`. Ce n'est pas du texte
  //    rogné, c'est la charte.
  //    ⚠️ ON EXCLUT LA CLASSE, PAS « LES ÉCARTS DE 4px ». Un seuil à 5px masquerait un
  //    VRAI débordement de 4px ailleurs, et personne ne saurait jamais qu'il a été
  //    masqué. Une exemption nommée se relit, se discute, et tombe si la primitive change.
  //    ⚠️ \`"Brush:brush"\` ET NON \`"brush"\` : \`norm()\` rend \`fichier + ":" + nomLocal\`
  //    (voir sa définition en tête). Écrit \`"brush"\`, le filtre ne matchait RIEN et la
  //    porte restait rouge sur les 5 pages — hypothèse corrigée PAR LA MESURE, en lisant
  //    la classe réellement servie (\`Brush-module__hzCJba__brush\`) plutôt qu'en la
  //    supposant. C'est le motif \`pieges/instrument-non-valide.md\` attrapé du bon côté :
  //    l'instrument accusait le produit, la mesure a montré que c'était lui.
  const estBrush = (el) => classesOf(el).includes("Brush:brush");

  const estDefilant = (el) => {
    const ox = getComputedStyle(el).overflowX;
    return ox === "auto" || ox === "scroll";
  };

  const candidatsTexte = all
    // 🔴 FEUILLES DE TEXTE UNIQUEMENT — voir le raisonnement ci-dessus.
    .filter((el) => el.children.length === 0)
    .filter((el) => (el.textContent || "").trim().length > 0)
    .filter((el) => !el.closest("[aria-hidden='true']"))
    .filter((el) => !estSrOnly(el) && !el.closest(".sr-only"))
    .filter((el) => !estBrush(el))
    .filter((el) => !estDefilant(el) && !dansDefilantQuelconque(el));

  const debordementsTexte = candidatsTexte
    .map((el) => ({ el, ecart: el.scrollWidth - el.clientWidth }))
    .filter((o) => o.ecart > TOL)
    .map((o) => ({ path: pathOf(o.el), tag: o.el.tagName,
      boite: o.el.clientWidth, contenu: o.el.scrollWidth, depassement: o.ecart,
      texte: (o.el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 40) }));

  const overflow = { viewportWidth: vw, debordements,
    // Rapporté pour que l'exclusion soit VISIBLE et non silencieuse : si ce compte
    // grimpe sans qu'un carrousel n'ait été ajouté, c'est le signal d'un abus.
    exclusDefilant,
    // ⑨ R38 — et son propre compte d'exclusions, pour la même raison.
    debordementsTexte,
    exclusTexte: candidatsTexte.length,
    // Conservé À TITRE INFORMATIF seulement — voir l'avertissement ci-dessus.
    scrollWidthInforme: de.scrollWidth,
    ok: debordements.length === 0 && debordementsTexte.length === 0 };

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
