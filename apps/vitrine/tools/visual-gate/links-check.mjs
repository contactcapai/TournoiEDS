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
import { PAGES, BASE as BASE_DEFAUT } from "./config.mjs";

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

const chrome = await launchChrome(9358);

try {
  for (const page of PAGES) {
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
          // et le corriger changerait le rendu d'une story MERGÉE (4.2) : c'est une
          // décision d'apparence, donc une décision de Brice au gate visuel.
          // ⚠️ Une porte qui tairait cet écart se lirait « tout est couvert ». Elle le
          // NOMME, et la story porte la question ouverte correspondante.
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
        const ouvert = await chrome.eval(`(async () => {
          const b = document.querySelector('[aria-controls="mobile-menu"]');
          if (!b) return false;
          for (let i = 0; i < 20; i++) {
            if (b.getAttribute("aria-expanded") === "true") return true;
            b.click();
            await new Promise(r => setTimeout(r, 150));
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
  console.log(`✅ INSTRUMENT VALIDE — défaut injecté, ${echecs.length} garde(s) l'ont vu.`);
  console.log("   Un « PORTE VERTE » de links-check.mjs a donc du contenu.");
  process.exit(0);
}

if (echecs.length > 0) {
  console.log(`🔴 ${echecs.length} GARDE(S) EN ÉCHEC.`);
  process.exit(1);
}
console.log("✅ LIENS CONFORMES — comportement MESURÉ (clic, focus, survol réels), pas déduit du code.");
