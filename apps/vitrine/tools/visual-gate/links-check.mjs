// @porte surface=liens effet=lecture story=5.5
// 🔬 GARDE COMPORTEMENTALE DES LIENS DU SITE (Story 5.5, dettes R2 et R12).
//
// Pourquoi un contrôle dédié — même motif que `gate:lightbox` / `gate:carousel` /
// `gate:marquee` / `gate:solicitation` :
//
//   défaut possible                                             lint/build  Lighthouse  gate  œil
//   un `href="#"` remonte en haut de page au clic (R2)              ❌          ❌       ❌   ⚠️
//   un CTA sortant n'a pas d'indication VISIBLE (R12)               ❌          ❌       ❌   ⚠️
//   un `rel` amputé de `noopener` OU de `noreferrer`                ❌          ❌       ❌   ❌
//   un placeholder annonce « (nouvel onglet) » au lecteur d'écran   ❌          ❌       ❌   ❌
//   un élément inerte reste focalisable au clavier                  ❌          ❌       ❌   ❌
//   un élément inerte s'illumine au survol (fausse affordance)      ❌          ❌       ❌   ⚠️
//
// 🔴 CE QUI DISTINGUE CETTE PORTE : elle mesure des EFFETS, pas des attributs.
// L'AC de `epics.md` (l.1247) l'exige mot pour mot — « le comportement est PROUVÉ sur
// les liens concernés, pas déduit d'une lecture de `isExternalUrl` ». Le défaut R2 EST
// un défilement : le lire dans le DOM ne le mesure pas. On clique, et on regarde si la
// page a bougé.
//
// Usage :  node tools/visual-gate/links-check.mjs [baseUrl]
//          LINKS_DEBRANCHER_PIEGE=1 …  → auto-validation de l'instrument
import { launchChrome } from "./cdp.mjs";
import { PAGES, BASE as BASE_DEFAUT, resoudreFicheTournoi } from "./config.mjs";

const BASE = process.argv[2] ?? BASE_DEFAUT;
const AUTOTEST = process.env.LINKS_DEBRANCHER_PIEGE === "1";

// Deux largeurs suffisent : le breakpoint du projet est à 880px, et tout ce que cette
// porte surveille est le CHROME (header + footer), dont le rendu ne connaît que deux
// régimes. `gate` couvre les 7 largeurs pour la mise en page — ce n'est pas le sujet ici.
const LARGEURS = [1440, 412];

// 🔴 LISTE BLANCHE. `#content` est l'ancre du skip-link (Story 1.6) : c'est une ancre
// LÉGITIME et obligatoire (WCAG 2.4.1), pas un placeholder. La confondre avec un
// placeholder ferait échouer la porte sur le seul lien de saut du site.
const ANCRES_LEGITIMES = new Set(["#content"]);

const echecs = [];
const succes = [];
const exemptions = new Set();
const ko = (garde, ou, quoi) => echecs.push(`${garde} ${ou} — ${quoi}`);
const ok = (garde, ou, quoi) => succes.push(`${garde} ${ou} — ${quoi}`);

/**
 * Relevé en page. Retourne un inventaire des liens et des éléments inertes.
 *
 * ⚠️ `data-inerte` et NON une classe CSS Modules : une classe est HACHÉE à la
 * compilation, et une règle vide serait supprimée à la minification — le sélecteur
 * deviendrait `.undefined` et la porte ne verrait plus rien, EN SILENCE. Famille de la
 * classe fantôme de la Story 2.10 et du déclencheur de la 5.1.
 */
const COLLECTE = `(() => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };
  const nomAccessible = (el) =>
    ((el.getAttribute("aria-label") || "") + " " + (el.textContent || "")).replace(/\\s+/g, " ").trim();

  // ① Les ancres. On lit l'attribut BRUT : \`el.href\` est résolu en URL absolue par le
  //    DOM, donc un \`href="#"\` y ressort en "http://…/page#" et deviendrait indétectable.
  const ancres = [...document.querySelectorAll("a")].map((el, i) => {
    el.setAttribute("data-lc", "a" + i);
    const brut = el.getAttribute("href");
    const rel = (el.getAttribute("rel") || "").split(/\\s+/).filter(Boolean);
    return {
      cle: "a" + i,
      brut,
      cible: el.getAttribute("target"),
      rel,
      nom: nomAccessible(el),
      // Un libellé TEXTE visible (par opposition à un lien qui n'est qu'une icône ou
      // qu'un logo) : c'est lui qui rend une indication visible possible et exigible.
      aDuTexte: (el.textContent || "").replace(/\\s+/g, "").length > 0,
      // 🔴 ON CHERCHE L'ExternalIcon PARTAGÉ, PAS « UN SVG DÉCORATIF ». La première
      // version de cette porte acceptait n'importe quel \`svg[aria-hidden]\` : le CTA
      // « Accéder à la plateforme » la satisfaisait avec la FLÈCHE de la maquette
      // (Story 5.4) alors qu'il portait le défaut R12. Porte verte sur un vrai défaut.
      aIcone: el.querySelector("[data-external-icon]") !== null,
      aImage: el.querySelector("img") !== null,
      estTuile: el.hasAttribute("data-tuile-partenaire"),
      visible: visible(el),
    };
  });

  // ② Les éléments DÉCLARÉS inertes par le rendu (destination absente).
  const inertes = [...document.querySelectorAll("[data-inerte]")].map((el, i) => {
    el.setAttribute("data-lc", "i" + i);
    return {
      cle: "i" + i,
      tag: el.tagName.toLowerCase(),
      nom: nomAccessible(el),
      aHref: el.hasAttribute("href"),
      role: el.getAttribute("role"),
      tabindex: el.getAttribute("tabindex"),
      visible: visible(el),
    };
  });

  return { ancres, inertes };
})()`;

// 🔴 SONDE D'ENTRÉE — AJOUTÉE À LA RÉTRO EPIC 6, ET ELLE VIENT D'UN DÉFAUT VÉCU.
// Sans elle, un serveur absent (ou lancé sur le MAUVAIS PORT) fait charger à Chrome sa
// propre page d'erreur : elle ne défile pas et n'a pas de menu — la porte rendait alors
// **35 gardes en échec** réparties sur les 5 pages, c'est-à-dire qu'elle ACCUSAIT LE
// PRODUIT pour une erreur d'environnement. Mesuré le 2026-08-08, en tentant de prouver
// le correctif R40 : serveur lancé sur 3000 alors que les portes attendent 4310.
// `gate.mjs` avait déjà cette sonde (l.48-53) et disait franchement « rien ne répond » ;
// cette porte-ci ne l'avait pas. C'est la 11ᵉ occurrence de
// `00 référence/pieges/instrument-non-valide.md` sur ce projet — et la 1ʳᵉ où l'instrument
// mal branché l'a été par le dev lui-même, pendant la rétro qui promeut cette leçon.
// ⚠️ Le témoin est `sonde.ok` et NON « le port répond » : un port ouvert ne prouve pas
// que la bonne application sert (`pieges/faux-succes.md`, corollaire du bon témoin).
const sonde = await fetch(BASE + PAGES[0]).catch(() => null);
if (!sonde?.ok) {
  console.error(`\n❌ Rien ne répond correctement sur ${BASE}${PAGES[0]}.`);
  console.error("   Lancer d'abord : pnpm --filter vitrine build && pnpm --filter vitrine start");
  console.error(`   ⚠️ Le port attendu est celui de config.mjs (${BASE}) — pas 3000.\n`);
  process.exit(2);
}

const chrome = await launchChrome(9358);

try {
  // 🔴 [AJOUTÉ le 2026-08-14, Story 9.3.] LA 7ᵉ PAGE EST DYNAMIQUE, ET SON URL SE DÉRIVE.
  // `/tournois/<slug>` n'est pas une URL concrète : elle est résolue depuis le site lui-même
  // (premier lien de fiche rendu par `/tournois`). Écrire un slug en dur ferait rougir cette
  // porte sur un produit sain le jour d'une dépublication — c'est la dette R46. Aucun tournoi
  // publié est un état LÉGITIME : la porte le DÉCLARE alors, et ne crie pas.
  // ⚠️ L'enjeu est double ici : cette porte clique VRAIMENT les liens, donc elle est aussi celle
  // qui prouve que les nouveaux liens de carte (arbitrage A1 inversé) mènent à un 200.
  const fiche = await resoudreFicheTournoi(BASE);
  if (fiche.url) console.log(`   ✅ Fiche de tournoi couverte : ${fiche.url}.`);
  else console.log(`   ⚠️ Fiche de tournoi NON couverte — ${fiche.raison}. Ce n'est pas un succès.`);
  const pagesBalayees = fiche.url ? [...PAGES, fiche.url] : PAGES;

  for (const page of pagesBalayees) {
    for (const largeur of LARGEURS) {
      await chrome.setViewport(largeur);
      await chrome.goto(BASE + page);

      // 🔴 AUTO-VALIDATION — on INJECTE le défaut que la porte est censée voir. Sans
      // cette contre-épreuve, une porte verte ne prouve rien : l'instrument de ce projet
      // a été faux HUIT fois, et plusieurs fois il accusait le produit
      // (`pieges/instrument-non-valide.md`). Le lien injecté cumule les trois défauts :
      // ancre morte (①), remontée au clic (③), annonce trompeuse (⑤).
      if (AUTOTEST) {
        await chrome.eval(`(() => {
          const a = document.createElement("a");
          a.href = "#";
          a.setAttribute("data-inerte", "");
          a.innerHTML = 'Piege injecte <span class="sr-only"> (nouvel onglet)</span>';
          document.querySelector("footer")?.appendChild(a);
          // 🔴 SECOND DÉFAUT INJECTÉ, POUR ⑧a (Story 9.4) : on RETIRE le marqueur de page
          // courante. Sans lui, l'auto-validation ne prouvait rien de cette garde-là — le
          // piège du footer ne touche que ①③⑤. Une contre-épreuve qui ne couvre pas la
          // garde qu'on vient d'écrire laisse croire qu'elle est éprouvée alors qu'elle
          // n'a jamais été vue rougir.
          for (const el of document.querySelectorAll('nav[aria-label="Navigation principale"] a[aria-current]')) {
            el.removeAttribute("aria-current");
          }
          return true;
        })()`);
      }

      const { ancres, inertes } = await chrome.eval(COLLECTE);
      const ou = `${page} @${largeur}px`;

      // ═══ ① Aucune ancre morte dans le HTML servi ════════════════════════════════
      const mortes = ancres.filter(
        (a) => a.brut !== null && a.brut.startsWith("#") && !ANCRES_LEGITIMES.has(a.brut),
      );
      if (mortes.length > 0) {
        ko("①", ou, `${mortes.length} ancre(s) morte(s) : ${mortes.map((m) => `"${m.nom}"`).join(", ")}`);
      } else {
        ok("①", ou, `aucune ancre morte (${ancres.length} liens balayés, skip-link exclu)`);
      }

      // ═══ ② Tout lien sortant est sûr, annoncé ET visiblement signalé ═════════════
      const sortants = ancres.filter((a) => a.brut !== null && /^https?:\/\//.test(a.brut));
      const fautes2 = [];
      for (const s of sortants) {
        if (s.cible !== "_blank") fautes2.push(`"${s.nom}" sans target="_blank"`);
        if (!s.rel.includes("noopener") || !s.rel.includes("noreferrer")) {
          fautes2.push(`"${s.nom}" rel incomplet (${s.rel.join(" ") || "vide"})`);
        }
        if (!/nouvel onglet/i.test(s.nom)) fautes2.push(`"${s.nom}" sans mention lecteur d'écran`);
        // L'indication VISIBLE n'est exigible que d'un lien qui porte un LIBELLÉ texte.
        // Un lien réduit à une icône (Discord) ou à un logo porte son sens dans son nom
        // accessible : y coller une 2ᵉ icône le rendrait illisible.
        if (s.aDuTexte && !s.aImage && !s.aIcone) {
          // 🔴 EXEMPTION DÉCLARÉE, JAMAIS SILENCIEUSE. Les TUILES du mur partenaires
          // sont des liens sortants à libellé texte (celles dont le partenaire n'a pas
          // encore de logo) : `EXPERIENCE.md` l.199 nomme bien « logos partenaires »
          // parmi les liens qui doivent porter une indication visible, donc l'écart est
          // RÉEL. Mais il n'est pas dans le périmètre de la dette R12 (qui vise les CTA)
          // et le corriger changerait le rendu d'une story MERGÉE (4.2).
          //
          // ✅ **ARBITRÉ PAR BRICE AU GATE VISUEL DE LA STORY 6.5, LE 2026-08-04 : PAS
          // D'INDICATION DE LIEN SORTANT SUR CES TUILES.** La question n'est donc plus
          // ouverte — l'écart est ASSUMÉ, et la dette **R33 ②** est fermée comme ACCEPTÉE.
          // ⚠️ Cette exemption RESTE, et c'est le point : elle ne signale plus une décision
          // en attente, elle documente une décision PRISE. La retirer ferait disparaître
          // l'écart du champ de vision — or il subsiste, et la porte est le seul endroit
          // qui le rappelle à chaque exécution.
          // ⚠️ Son COMPTE, lui, bouge : une tuile passe de « libellé texte » à « image »
          // dès qu'un logo est téléversé pour ce partenaire, et sort donc de cette liste.
          // 7 au 2026-08-04. Un compte qui ne bouge pas après un téléversement est un
          // défaut, pas un succès.
          if (s.estTuile) {
            exemptions.add(`tuile de mur partenaires « ${s.nom.replace(/ \(nouvel onglet\)$/, "")} »`);
          } else {
            fautes2.push(`"${s.nom}" sans indication VISIBLE de lien sortant (R12)`);
          }
        }
      }
      if (fautes2.length > 0) ko("②", ou, fautes2.join(" · "));
      else ok("②", ou, `${sortants.length} lien(s) sortant(s) sûrs, annoncés et signalés`);

      // ═══ ⑤ Un élément sans destination n'annonce rien ═══════════════════════════
      const bavards = [...inertes, ...mortes].filter((e) => /nouvel onglet/i.test(e.nom));
      if (bavards.length > 0) {
        ko("⑤", ou, `${bavards.length} élément(s) sans destination annoncent « nouvel onglet » : ${bavards.map((b) => `"${b.nom}"`).join(", ")}`);
      } else {
        ok("⑤", ou, `aucune annonce trompeuse (${inertes.length} élément(s) inerte(s))`);
      }

      // ═══ Forme des éléments inertes ════════════════════════════════════════════
      const malFormes = inertes.filter(
        (e) => e.aHref || e.role !== null || (e.tabindex !== null && Number(e.tabindex) >= 0),
      );
      if (malFormes.length > 0) {
        ko("⑤", ou, `${malFormes.length} élément(s) inerte(s) portent href/role/tabindex — ce sont encore des liens`);
      }

      // ═══ ④ Aucun élément inerte n'est focalisable (EFFET, pas lecture d'attribut) ═
      const aEprouver = [...inertes, ...mortes].filter((e) => e.visible);
      if (aEprouver.length > 0) {
        const focalisables = await chrome.eval(`(() => {
          const pris = [];
          for (const cle of ${JSON.stringify(aEprouver.map((e) => e.cle))}) {
            const el = document.querySelector('[data-lc="' + cle + '"]');
            if (!el) continue;
            el.focus();
            if (document.activeElement === el) pris.push(cle);
          }
          document.activeElement?.blur();
          return pris;
        })()`);
        if (focalisables.length > 0) {
          ko("④", ou, `${focalisables.length} élément(s) sans destination PRENNENT le focus (donc sont dans l'ordre de tabulation)`);
        } else {
          ok("④", ou, `${aEprouver.length} élément(s) sans destination hors du fil de focus`);
        }
      }

      // ═══ ③ PREUVE D'EFFET — cliquer ne fait pas bouger la page ══════════════════
      //
      // 🔴 `globals.css` l.87 pose `scroll-behavior: smooth` : un relevé pris juste
      // après le clic lirait la position EN PLEIN VOL et rapporterait « n'a pas bougé »
      // sur une page en train de remonter. C'est EXACTEMENT le défaut d'instrument payé
      // en Story 5.4. On neutralise donc le lissage le temps de la mesure, ET on vérifie
      // d'abord que le défilement de départ est bien ARRIVÉ — une garde qui mesure
      // depuis scrollY=0 ne peut par construction jamais voir une remontée en haut.
      if (aEprouver.length > 0) {
        const verdict = await chrome.eval(`(async () => {
          const style = document.createElement("style");
          style.textContent = "html, body, * { scroll-behavior: auto !important; }";
          document.head.appendChild(style);
          const pause = () => new Promise(r => setTimeout(r, 120));

          window.scrollTo(0, document.body.scrollHeight);
          await pause();
          const depart = window.scrollY;
          if (depart < 100) return { inexploitable: depart };

          const coupables = [];
          for (const cle of ${JSON.stringify(aEprouver.map((e) => e.cle))}) {
            const el = document.querySelector('[data-lc="' + cle + '"]');
            if (!el) continue;
            el.click();
            await pause();
            if (Math.abs(window.scrollY - depart) > 2) {
              coupables.push({ cle, texte: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40), de: depart, a: window.scrollY });
              window.scrollTo(0, depart);
              await pause();
            }
          }
          style.remove();
          return { depart, coupables };
        })()`, true);

        if (verdict.inexploitable !== undefined) {
          // La page ne défile pas assez pour que la mesure ait un sens : on ne peut PAS
          // conclure « aucune remontée ». Une porte qui se dirait verte ici mentirait.
          ko("③", ou, `MESURE IMPOSSIBLE — la page ne défile pas (scrollY=${verdict.inexploitable}px) : une remontée en haut y serait indétectable`);
        } else if (verdict.coupables.length > 0) {
          ko("③", ou, `${verdict.coupables.length} élément(s) FONT BOUGER la page au clic : ` +
            verdict.coupables.map((c) => `"${c.texte}" (${c.de}px → ${c.a}px)`).join(", "));
        } else {
          ok("③", ou, `${aEprouver.length} clic(s) réel(s) depuis ${verdict.depart}px — la page n'a pas bougé`);
        }
      }

      // ═══ ⑥ Aucun élément inerte ne change d'apparence au survol ═════════════════
      const survolables = inertes.filter((e) => e.visible);
      const fautes6 = [];
      for (const e of survolables) {
        const avant = await chrome.eval(`(() => {
          const el = document.querySelector('[data-lc="${e.cle}"]');
          el.scrollIntoView({ block: "center", behavior: "instant" });
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return { style: [s.color, s.backgroundColor, s.borderColor, s.cursor].join("|"),
                   x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
        })()`);
        await chrome.bougerSouris(avant.x, avant.y);
        const apres = await chrome.eval(`(() => {
          const s = getComputedStyle(document.querySelector('[data-lc="${e.cle}"]'));
          return [s.color, s.backgroundColor, s.borderColor, s.cursor].join("|");
        })()`);
        // Remettre le pointeur hors de tout élément avant la mesure suivante.
        await chrome.bougerSouris(1, 1);
        if (apres !== avant.style) {
          fautes6.push(`"${e.nom || e.tag}" change au survol (${avant.style} → ${apres})`);
        }
      }
      if (fautes6.length > 0) ko("⑥", ou, fautes6.join(" · "));
      else if (survolables.length > 0) {
        ok("⑥", ou, `${survolables.length} élément(s) inerte(s) ne réagissent pas au survol`);
      }

      // ═══ Le panneau mobile, OUVERT ═════════════════════════════════════════════
      //
      // ⚠️ Il est TOUJOURS monté (`hidden` quand fermé, review 1.4 #2) : ses liens sont
      // donc déjà comptés par ① et ② ci-dessus, à toutes les largeurs. Mais `[hidden]`
      // les retire de l'arbre d'accessibilité et de la mise en page — ③, ④ et ⑥ ne
      // peuvent rien en dire tant qu'il est fermé. On l'ouvre pour les éprouver.
      if (largeur < 880) {
        // 🔴 ATTENDRE L'HYDRATATION, ET LA MESURER — surtout pas un délai en aveugle.
        // Diagnostic fait pendant la Story 5.5 : un clic envoyé juste après
        // `Page.loadEventFired` ne bascule PAS le panneau, parce que React n'a pas
        // encore hydraté le bouton. La porte rapportait alors « le panneau mobile ne
        // s'ouvre pas » — c'est-à-dire qu'elle ACCUSAIT LE PRODUIT pour un défaut
        // d'instrument, 9ᵉ occurrence sur ce projet (`pieges/instrument-non-valide.md`).
        // ⚠️ On relit l'état AVANT chaque clic : Next rejoue les événements discrets
        // captés avant hydratation, donc un 2ᵉ clic aveugle REFERMERAIT le panneau.
        //
        // 🔴 CORRECTIF R40 (rétro Epic 6) — LA BOUCLE CI-DESSOUS ÉTAIT ELLE-MÊME LA CAUSE
        // DU *FLAKY*, et son propre commentaire le disait sans qu'on l'entende.
        // Mesuré en revue de la 6.11 : 1ʳᵉ exécution ROUGE (« le panneau ne s'ouvre pas »
        // sur 2 pages), vertes ensuite, à exemptions identiques. La version précédente
        // cliquait en boucle AVANT hydratation ; relire `aria-expanded` entre deux clics
        // ne protège de rien, puisque les clics en attente ne sont pas encore appliqués.
        // Next les REJOUE tous à l'hydratation ⇒ c'est la PARITÉ du nombre de clics
        // aveugles qui décidait de l'état final. Un nombre pair = panneau refermé = porte
        // rouge sur un site sain — 10ᵉ instrument qui accuse le produit sur ce projet.
        // ⇒ On attend d'abord un TÉMOIN D'HYDRATATION, puis on clique UNE SEULE fois.
        // Le témoin : React 19 attache ses clés internes (`__reactFiber$…`/`__reactProps$…`)
        // au nœud au moment où il l'hydrate — leur présence prouve que le bouton RÉPOND.
        // ⚠️ C'est un détail d'implémentation de React, assumé et déclaré : il est le seul
        // témoin observable depuis le DOM, et une montée de React majeure doit le
        // re-vérifier (sans quoi la porte redeviendrait rouge sur un site sain).
        const ouvert = await chrome.eval(`(async () => {
          const b = document.querySelector('[aria-controls="mobile-menu"]');
          if (!b) return false;
          const hydrate = () => Object.keys(b).some(
            (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactProps$"),
          );
          for (let i = 0; i < 60 && !hydrate(); i++) {
            await new Promise(r => setTimeout(r, 50));
          }
          if (!hydrate()) return false;
          if (b.getAttribute("aria-expanded") !== "true") b.click();
          for (let i = 0; i < 20; i++) {
            if (b.getAttribute("aria-expanded") === "true") return true;
            await new Promise(r => setTimeout(r, 50));
          }
          return b.getAttribute("aria-expanded") === "true";
        })()`, true);
        if (!ouvert) {
          ko("④", `${ou} (menu)`, "le panneau mobile ne s'ouvre pas — impossible d'éprouver ses liens");
        } else {
          const dansPanneau = await chrome.eval(`(() => {
            const p = document.getElementById("mobile-menu");
            const pris = [];
            for (const el of p.querySelectorAll("[data-inerte], a[href^='#']")) {
              el.focus();
              if (document.activeElement === el) pris.push((el.textContent || el.getAttribute("aria-label") || "?").trim().slice(0, 40));
            }
            // Le piège de focus de la Story 1.4 se calcule sur cet ensemble : s'il
            // devenait VIDE, le piège se désactiverait EN SILENCE et la tabulation
            // s'échapperait derrière le panneau ouvert.
            const focalisables = p.querySelectorAll('a[href], button:not([disabled])').length;
            document.activeElement?.blur();
            return { pris, focalisables };
          })()`);
          if (dansPanneau.pris.length > 0) {
            ko("④", `${ou} (menu ouvert)`, `${dansPanneau.pris.length} élément(s) sans destination prennent le focus : ${dansPanneau.pris.join(", ")}`);
          } else {
            ok("④", `${ou} (menu ouvert)`, "aucun élément sans destination dans le fil de focus");
          }
          if (dansPanneau.focalisables === 0) {
            ko("④", `${ou} (menu ouvert)`, "🔴 le panneau n'a PLUS AUCUN élément focalisable — le piège de focus de la Story 1.4 est désactivé en silence");
          } else {
            ok("④", `${ou} (menu ouvert)`, `piège de focus alimenté (${dansPanneau.focalisables} élément(s) focalisable(s))`);
          }
        }
      }

      // ══════════════════════════════════════════════════════════════════════════════════
      // ⑦ UNE CARTE-LIEN N'EST PAS RECOUVERTE PAR SA PROPRE IMAGE (Story 9.3)
      // ══════════════════════════════════════════════════════════════════════════════════
      //
      // 🔴 GARDE NÉE D'UN DÉFAUT RÉEL, MESURÉ SUR STAGING LE 2026-08-14, ET QU'AUCUNE PORTE
      // NE POUVAIT VOIR. Sur `/tournois`, la carte entière est rendue cliquable par un
      // `::after { position: absolute; inset: 0 }` posé sur le lien du titre. Le cadre
      // `PhotoFrame` est LUI AUSSI positionné et vient APRÈS dans le DOM : deux descendants à
      // `z-index: auto` se peignent dans l'ordre de l'arbre, donc la photo passait AU-DESSUS
      // de l'overlay. `elementFromPoint` au centre de la photo rendait l'`<img>`, et cliquer
      // la photo ne menait NULLE PART — sur la moitié de la surface d'une carte dont le
      // livrable est d'être cliquable.
      //
      // 🔴 POURQUOI LES AUTRES GARDES DE CE FICHIER SONT AVEUGLES À ÇA : elles cliquent par
      // `el.click()` sur l'ancre elle-même, ce qui appelle le gestionnaire SANS passer par le
      // test de recouvrement du navigateur. C'est la bonne méthode pour mesurer un
      // défilement ; c'est exactement la mauvaise pour mesurer ce qui reçoit le clic.
      // ⚠️ Le survol, lui, continuait de fonctionner (il remonte la chaîne des ancêtres,
      // indépendante de l'empilement) : **la carte réagissait sans être cliquable**.
      //
      // ⚠️ GÉNÉRIQUE, ET PAS SPÉCIFIQUE AUX TOURNOIS : la garde vise tout `<li>` qui contient
      // à la fois une image et un lien interne — le patron « carte cliquable illustrée »
      // reviendra, et c'est le jour où il reviendra que cette garde sert.
      {
        const recouvrements = await chrome.eval(`(() => {
          const cartes = [...document.querySelectorAll("li")].filter(
            (li) => li.querySelector("img") && li.querySelector("a[href^='/']"),
          );
          const resultats = [];
          for (const li of cartes) {
            const img = li.querySelector("img");
            img.scrollIntoView({ block: "center" });
            const b = img.getBoundingClientRect();
            if (b.width < 8 || b.height < 8) continue;
            const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
            if (!el) continue;
            resultats.push({
              href: li.querySelector("a[href^='/']").getAttribute("href"),
              atteintLeLien: Boolean(el.closest("a")),
              recu: el.tagName.toLowerCase(),
            });
          }
          return resultats;
        })()`);

        if (recouvrements.length === 0) {
          // 🔴 « RIEN À MESURER » N'EST PAS « TOUT VA BIEN » — doctrine de la sonde de données
          // de `gate:carousel` (dette R46). Aucune carte illustrée sur cette page : on le DIT.
          exemptions.add(
            `⑦ recouvrement : aucune carte illustrée sur ${ou} — la garde n'a rien pu mesurer, ` +
              "et ce n'est pas un succès. Le cas se fabrique en donnant un visuel à un tournoi " +
              "publié depuis /admin/tournois ; aucun n'en porte aujourd'hui.",
          );
        } else {
          // En autotest on exige l'inverse de la vérité : la garde doit crier.
          const attendu = !AUTOTEST;
          for (const r of recouvrements) {
            if (r.atteintLeLien === attendu) {
              ok("⑦", `${ou} → ${r.href}`, "le centre de l'image atteint bien le lien de la carte");
            } else {
              // ⚠️ LE MESSAGE DIT CE QUI A ÉTÉ MESURÉ, PAS CE QU'ON SUPPOSE — et il doit
              // rester vrai DANS LES DEUX MODES. Une première version écrivait « reçoit <a>
              // et NON le lien », ce qui était absurde en autotest (où l'attendu est inversé
              // et où l'élément atteint EST le lien). Un instrument dont le message ment sur
              // sa propre mesure est la forme la plus discrète de `pieges/instrument-non-valide.md`.
              ko(
                "⑦",
                `${ou} → ${r.href}`,
                AUTOTEST
                  ? `attendu inversé (autotest) : le centre de l'image atteint le lien via <${r.recu}> — la garde voit donc bien ce qu'on lui présente`
                  : `le centre de l'image reçoit <${r.recu}> SANS atteindre le lien — la carte n'est ` +
                    "pas cliquable sur sa photo (overlay recouvert : `z-index` manquant sur `::after`)",
              );
            }
          }
        }
      }

      // ══════════════════════════════════════════════════════════════════════════════════
      // ⑧a UN LIEN DE NAV INTERNE SE MARQUE ACTIF — ET SEULEMENT SUR SA PAGE (Story 9.4)
      // ══════════════════════════════════════════════════════════════════════════════════
      //
      // 🔴 GARDE NÉE DU PIÈGE CENTRAL DE LA STORY 9.4, ET CE PIÈGE EST D'UNE FORME RARE :
      // le témoin annoncé passait au VERT en même temps que le défaut naissait.
      // `SiteHeader` portait `{ href: TOURNOI_URL, external: true }` — un drapeau écrit EN
      // LITTÉRAL, qui n'est PAS dérivé de l'URL, et qui choisit la branche de rendu de
      // `MobileMenu.renderNavLink`. En basculant `TOURNOI_URL` de l'ancienne plateforme vers
      // `/tournois`, les trois attributs de lien sortant disparaissaient TOUT SEULS (ils se
      // dérivent de `classerDestination`) — donc « plus aucune icône sortante sur Tournois »
      // était vrai. Mais si le drapeau restait, le lien demeurait un `<a>` NU : rechargement
      // complet à chaque clic, et JAMAIS d'`aria-current`.
      //
      // ⚠️ AUCUNE AUTRE GARDE DE CE DOSSIER NE VOYAIT ÇA : ① regarde les ancres mortes,
      // ② la sûreté des sortants, ③ la remontée au clic, ④ le focus des inertes, ⑤ l'annonce
      // trompeuse, ⑥ le survol, ⑦ le recouvrement. `gate` ne mesure que des largeurs de boîte
      // et Lighthouse n'exige pas `aria-current`.
      //
      // ⚠️ GÉNÉRIQUE, ET PAS ÉCRITE POUR « TOURNOIS » : elle vise TOUT lien de la nav dont
      // l'`href` commence par `/`. Le jour où un 7ᵉ lien s'ajoute, il est couvert sans geste.
      // ⚠️ Le panneau mobile est TOUJOURS monté (review 1.4 #2) : chaque lien apparaît donc
      // DEUX fois dans ce relevé, à toutes les largeurs — et c'est voulu, les deux rendus
      // doivent être justes.
      //
      // 🔴 MESURÉE DANS LES DEUX SENS, et c'est le point : `aria-current="page"` doit être
      // PRÉSENT sur le lien de la page courante ET ABSENT sur tous les autres. Une garde qui
      // n'exigerait que la présence serait satisfaite par un `aria-current` posé partout,
      // c'est-à-dire par un repère qui ne repère plus rien.
      {
        const liens = await chrome.eval(`(() => {
          const n = document.querySelector('nav[aria-label="Navigation principale"]');
          if (!n) return null;
          return [...n.querySelectorAll("a[href]")]
            .map((a) => ({
              href: a.getAttribute("href"),
              actif: a.getAttribute("aria-current") === "page",
              nom: (a.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 30),
            }))
            .filter((l) => l.href && l.href.startsWith("/"));
        })()`);

        if (liens === null) {
          ko("⑧a", ou, "aucune `nav[aria-label=\"Navigation principale\"]` — RIEN À MESURER, et ce n'est pas un succès");
        } else if (liens.length === 0) {
          ko("⑧a", ou, "la nav ne porte AUCUN lien interne — la garde serait vide, donc muette");
        } else {
          // `page` est le chemin demandé ; pour la fiche dérivée c'est aussi un chemin.
          const fautes = liens.filter((l) => l.actif !== (l.href === page));
          if (fautes.length > 0) {
            ko(
              "⑧a",
              ou,
              fautes
                .map((f) =>
                  f.href === page
                    ? `"${f.nom}" (${f.href}) est la page courante mais N'A PAS aria-current="page"`
                    : `"${f.nom}" (${f.href}) porte aria-current="page" alors qu'on est sur ${page}`,
                )
                .join(" · "),
            );
          } else {
            const actifs = liens.filter((l) => l.actif).length;
            ok("⑧a", ou, `${liens.length} lien(s) de nav interne(s), ${actifs} marqué(s) actif(s) — et c'est le bon`);
          }
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // ⑧b UN LIEN DE NAV INTERNE EST GÉRÉ PAR LE ROUTEUR CLIENT — MESURÉ PAR L'EFFET
  // ══════════════════════════════════════════════════════════════════════════════════════
  //
  // 🔴 RIEN DANS LE DOM NE DISTINGUE UN `next/link` D'UN `<a>` NU. `<Link>` rend un `<a>`
  // ordinaire, sans attribut ni classe qui le trahisse. Une garde par lecture d'attribut est
  // donc IMPOSSIBLE ici — et c'est précisément la doctrine de cette porte : *elle mesure des
  // EFFETS, pas des attributs*.
  //
  // 🔬 LE TÉMOIN : on pose une valeur sur `window`, on clique, on attend, on la relit.
  //   · navigation CLIENT (next/link) ⇒ le contexte JS survit ⇒ le témoin est TOUJOURS LÀ ;
  //   · navigation DURE (`<a>` nu)    ⇒ le document est remplacé ⇒ le témoin a DISPARU.
  // ⚠️ Et l'on exige que le CHEMIN AIT CHANGÉ : sans ça, « le témoin a survécu » serait aussi
  // vrai d'un clic qui n'a rien fait du tout. Un témoin qui répond « présent » pour une raison
  // qui n'est pas celle qu'on croit, c'est `pieges/faux-succes.md`.
  //
  // 🔴 ON ATTEND L'HYDRATATION, ET ON LA MESURE — leçon R40, payée DANS CE FICHIER. Un clic
  // envoyé avant hydratation navigue en DUR même sur un `next/link` : la garde accuserait
  // alors le produit pour un défaut d'instrument. Le témoin d'hydratation est le même que
  // celui du panneau mobile (clés internes de React 19 sur le nœud).
  //
  // ⚠️ COUVERTURE BORNÉE ET DÉCLARÉE : la mesure part de `/` à 1440px et éprouve CHAQUE lien
  // interne de la nav, un rechargement par lien. Le défaut visé est STATIQUE (un drapeau dans
  // un tableau de données rendu par le même composant sur les 7 pages) : l'éprouver depuis une
  // page suffit à le voir. Le balayer depuis les 7 pages coûterait ~70 chargements pour la
  // même information. ⑧a, elle, couvre bien les 7 pages × 2 largeurs.
  {
    const DEPUIS = "/";
    const SEL = 'nav[aria-label="Navigation principale"]';
    await chrome.setViewport(1440);
    await chrome.goto(BASE + DEPUIS);

    const candidats = await chrome.eval(`(() => {
      const n = document.querySelector('${SEL}');
      if (!n) return [];
      const vus = new Set();
      for (const a of n.querySelectorAll("a[href]")) {
        const h = a.getAttribute("href");
        if (h && h.startsWith("/") && h !== "${DEPUIS}") vus.add(h);
      }
      return [...vus];
    })()`);

    if (candidats.length === 0) {
      ko("⑧b", DEPUIS, "aucun lien de nav interne à éprouver depuis `/` — RIEN À MESURER");
    }

    for (const href of candidats) {
      await chrome.goto(BASE + DEPUIS);

      // 🔴 AUTO-VALIDATION : on REMPLACE le lien par un `<a>` nu, hors de tout gestionnaire
      // React. C'est exactement le défaut que la garde existe pour voir — un lien de nav qui
      // ressemble en tout point au bon et qui recharge la page.
      if (AUTOTEST) {
        await chrome.eval(`(() => {
          const a = document.querySelector('${SEL} a[href="${href}"]');
          if (!a) return false;
          const nu = document.createElement("a");
          nu.setAttribute("href", "${href}");
          nu.textContent = a.textContent;
          a.replaceWith(nu);
          return true;
        })()`);
      }

      const pret = await chrome.eval(`(async () => {
        const a = document.querySelector('${SEL} a[href="${href}"]');
        if (!a) return { impossible: "lien introuvable dans la nav" };
        // Le lien du panneau mobile peut être masqué à 1440px : on prend celui qui est rendu.
        const rendu = [...document.querySelectorAll('${SEL} a[href="${href}"]')]
          .find((el) => el.getBoundingClientRect().width > 0) ?? a;
        rendu.setAttribute("data-lc-nav", "1");
        const hydrate = () => Object.keys(rendu).some(
          (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactProps$"),
        );
        for (let i = 0; i < 60 && !hydrate(); i++) await new Promise(r => setTimeout(r, 50));
        // ⚠️ En autotest le lien injecté n'est PAS hydraté, et c'est normal : c'est ce qu'on
        // mesure. On ne bloque donc pas là-dessus, on le DIT.
        window.__gateNavTemoin = "EDS-9-4";
        return { hydrate: hydrate(), depart: location.pathname };
      })()`, true);

      if (pret.impossible) {
        ko("⑧b", `${DEPUIS} → ${href}`, `MESURE IMPOSSIBLE — ${pret.impossible}`);
        continue;
      }
      if (!pret.hydrate && !AUTOTEST) {
        ko("⑧b", `${DEPUIS} → ${href}`, "MESURE IMPOSSIBLE — le lien n'est pas hydraté, un clic ne prouverait rien (leçon R40)");
        continue;
      }

      // Le clic peut détruire le contexte d'exécution avant que la valeur de retour ne soit
      // sérialisée : on tolère l'exception, elle n'est pas un verdict.
      try {
        await chrome.eval(`(() => { document.querySelector('[data-lc-nav]').click(); return true; })()`);
      } catch {
        /* contexte détruit par une navigation dure — le relevé ci-dessous tranchera */
      }
      await new Promise((r) => setTimeout(r, 900));

      const apres = await chrome.eval(`(() => ({
        chemin: location.pathname,
        temoin: window.__gateNavTemoin === "EDS-9-4",
      }))()`);

      if (apres.chemin === pret.depart) {
        ko("⑧b", `${DEPUIS} → ${href}`, `MESURE IMPOSSIBLE — le clic n'a pas changé le chemin (toujours ${apres.chemin})`);
        continue;
      }

      // En autotest on exige l'INVERSE de la vérité : le témoin doit avoir disparu.
      const attendu = !AUTOTEST;
      if (apres.temoin === attendu) {
        ok(
          "⑧b",
          `${DEPUIS} → ${href}`,
          AUTOTEST
            ? `clic réel : le témoin a DISPARU (rechargement complet) — la garde voit bien le \`<a>\` nu qu'on lui présente`
            : `clic réel → ${apres.chemin}, le témoin JS a survécu : navigation gérée par le routeur client`,
        );
      } else {
        ko(
          "⑧b",
          `${DEPUIS} → ${href}`,
          AUTOTEST
            ? "attendu inversé (autotest) : le témoin a SURVÉCU alors qu'un `<a>` nu vient d'être injecté — la garde ne mesure rien"
            : `clic réel → ${apres.chemin}, mais le témoin JS a DISPARU : la page a été RECHARGÉE. ` +
              "Ce lien de nav n'est pas un `next/link` — vérifier le drapeau `external` de `NAV_LINKS` (Story 9.4)",
        );
      }
    }
  }
} finally {
  await chrome.close();
}

console.log();
for (const s of succes) console.log("  ✅ " + s);
if (exemptions.size > 0) {
  console.log();
  console.log(`  ⚠️  ${exemptions.size} EXEMPTION(S) DÉCLARÉE(S) — cette porte NE les couvre PAS :`);
  for (const e of [...exemptions].sort()) console.log("     · " + e);
  console.log("     Écart RÉEL à EXPERIENCE.md l.199, hors périmètre de la dette R12 (qui vise");
  console.log("     les CTA). Décision d'apparence sur le rendu d'une story mergée (4.2) ⇒ gate");
  console.log("     visuel de Brice. Une porte verte ne veut donc PAS dire « tout est couvert ».");
}
if (echecs.length > 0) {
  console.log();
  for (const e of echecs) console.log("  ❌ " + e);
}
console.log();

if (AUTOTEST) {
  if (echecs.length === 0) {
    console.log("🔴 AUTO-VALIDATION ÉCHOUÉE — le défaut a été INJECTÉ et la porte reste verte.");
    console.log("   L'instrument ne mesure rien : ne pas se fier à ses verdicts.");
    process.exit(1);
  }
  // 🔴 ON DIT **QUELLES** GARDES ONT CRIÉ, PAS SEULEMENT COMBIEN (Story 9.4). Un compte
  // global laisse croire que toutes les gardes sont éprouvées : il suffit qu'UNE crie pour
  // que l'autotest passe. C'est la leçon de `gate:ateliers`, dont l'autotest déclare les
  // gardes qu'il ne prouve PAS — une auto-validation muette sur sa propre couverture laisse
  // croire qu'elle couvre tout.
  const crie = [...new Set(echecs.map((e) => e.split(" ")[0]))].sort();
  console.log(`✅ INSTRUMENT VALIDE — défauts injectés, ${echecs.length} verdict(s) rouge(s).`);
  console.log(`   Gardes qui ont CRIÉ : ${crie.join(", ")}`);
  // 🔴 ⑧b S'AUTO-VALIDE PAR UN ✅, ET NON PAR UN ❌ — elle est la SEULE de ce fichier dans ce
  // cas, et ça se mesure plutôt que se supposer. En autotest, on lui injecte un `<a>` nu : le
  // témoin JS disparaît RÉELLEMENT, donc l'attendu inversé est SATISFAIT et elle rend un ✅.
  // ⚠️ ⑦, elle, a aussi un attendu inversé mais rend un ❌ (le centre de l'image atteint bien
  // le lien, ce que l'autotest déclare fautif) : elle apparaît donc dans la ligne ci-dessus.
  // Une première version de ce bloc rangeait ⑦ ICI — c'était faux, et le dire faux aurait
  // laissé croire que ⑦ n'était pas comptée dans les gardes qui ont crié.
  const inversees = [...new Set(succes.map((s) => s.split(" ")[0]))].filter((g) => g === "⑧b");
  console.log(
    inversees.length > 0
      ? `   Garde à ATTENDU INVERSÉ rendant un ✅ (sa preuve EST sa ligne verte) : ${inversees.join(", ")}`
      : "   ⚠️ ⑧b N'A RENDU AUCUN VERDICT — elle n'a donc PAS été éprouvée par cette exécution.",
  );
  console.log("   Un « PORTE VERTE » de links-check.mjs a donc du contenu.");
  process.exit(0);
}

if (echecs.length > 0) {
  console.log(`🔴 ${echecs.length} GARDE(S) EN ÉCHEC.`);
  process.exit(1);
}
console.log("✅ LIENS CONFORMES — comportement MESURÉ (clic, focus, survol réels), pas déduit du code.");
