import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { SECTIONS_ADMIN } from "../../app/admin/_sections";
import { ROLES_ADMIN, detientRole } from "../roles";
import { exigencePour } from "../../server/auth/sections";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LA SÉPARATION DES RÔLES (Story 8.1) — LA RÈGLE QUI PEUT ÊTRE FAUSSE EN SILENCE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Ces tests existent pour une raison écrite dans l'epic : **une garde de rôle oubliée est
 * SILENCIEUSE**. Ni le lint, ni le typecheck, ni le gate visuel ne voient une page ouverte
 * à qui ne devrait pas l'atteindre — elle s'affiche, simplement.
 *
 * ⚠️ CE QU'ILS NE COUVRENT PAS, ÉCRIT À CÔTÉ D'EUX (`00 référence/pieges/garde-nominale.md`,
 * corollaire) : ils exercent la RÉSOLUTION chemin → rôle, pas l'exécution du proxy ni celle
 * des Server Actions. Qu'un rôle soit effectivement lu en base et refusé se prouve contre
 * staging (`gate:admin`), pas ici. Et les deux gardes anti-verrouillage d'`actions/acces.ts`
 * touchent la base : elles ne sont pas testées ici non plus.
 *
 * ✅ CONTRE-ÉPREUVE JOUÉE LE 2026-08-25 (recette non négociable de `pieges/garde-nominale.md`
 * — « écrire le contournement trivial et vérifier qu'elle rougit »). Trois défauts réintroduits,
 * trois rouges, un par test :
 *   · une page `app/admin/orpheline/page.tsx` non déclarée  → ③ « toute route est rattachée »
 *   · `couvre()` ramené à un `startsWith` nu                → « /admin/agendas » n'est pas agenda
 *   · `detientRole()` figé à `true` (garde inerte)          → ① la séparation des rôles
 *
 * ✅ DEUX DE PLUS À LA PR ② (lien magique), même recette :
 *   · `/admin/login/verifier` retiré des routes ouvertes    → DEUX rouges, dont ③ qui l'a
 *     attrapé par un second chemin (la route existe sur le disque, plus rien ne la couvre)
 *   · l'ouverture du login passée en PRÉFIXE                → « n'est PAS un préfixe »
 */

// ── ① La résolution nomme le bon rôle, dans les deux sens ────────────────────────────

test("chaque section déclarée se résout sur SON rôle, et sur aucun autre", () => {
  for (const section of SECTIONS_ADMIN) {
    const exigence = exigencePour(section.href);
    assert.deepEqual(
      exigence,
      { type: "role", role: section.role },
      `${section.href} devrait exiger « ${section.role} »`,
    );

    // 🔴 L'AUTRE SENS, et c'est lui qui prouve la SÉPARATION : sans cette moitié, un montage
    // qui accorderait tout à tout le monde passerait la moitié ① sans broncher.
    for (const autre of ROLES_ADMIN) {
      if (autre === section.role) continue;
      assert.equal(
        detientRole([autre], section.role),
        false,
        `porter « ${autre} » ne doit PAS ouvrir ${section.href}`,
      );
    }
  }
});

test("une sous-route hérite du rôle de sa section", () => {
  assert.deepEqual(exigencePour("/admin/agenda/bars/42"), {
    type: "role",
    role: "admin_site",
  });
  assert.deepEqual(exigencePour("/admin/tournois/abc/engages"), {
    type: "role",
    role: "admin_tournoi",
  });
});

test("un chemin qui COMMENCE comme une section n'en fait pas partie", () => {
  // `/admin/agendas` n'est pas `/admin/agenda` : un `startsWith` nu les confondrait, et
  // ouvrirait une route inconnue avec le rôle de sa voisine.
  assert.deepEqual(exigencePour("/admin/agendas"), { type: "inconnu" });
});

// ── ② Les routes ouvertes le restent, et elles seules ────────────────────────────────

test("les chemins hérités de la connexion restent OUVERTS, pour pouvoir rediriger", () => {
  // 🔴 CE TEST A CHANGÉ DE SUJET AVEC LA 12.4, ET C'EST LE POINT DÉLICAT DE LA STORY. Ces
  // deux chemins n'ont plus de page : les écrans vivent en `/connexion`. S'ils cessaient
  // d'être déclarés ouverts, le fail-closed du proxy les refuserait AVANT que
  // `next.config.ts` ait pu les rediriger — à moins que les `redirects` ne s'exécutent
  // avant le proxy, un ordre qui dépend de la version de Next et qu'aucune porte ne mesure.
  // ⚠️ Ce sont donc bien des chemins SANS page qui doivent rester ouverts. Les retirer
  // « puisqu'ils ne servent plus » casserait la redirection, en silence, pour les bénévoles
  // qui ont `/admin/login` en favori.
  assert.deepEqual(exigencePour("/admin/login"), { type: "ouvert" });
  assert.deepEqual(exigencePour("/admin/login/verifier"), { type: "ouvert" });
});

test("le refus reste atteignable sans rôle", () => {
  assert.deepEqual(exigencePour("/admin/refus"), { type: "connecte" });
  assert.deepEqual(exigencePour("/admin"), { type: "connecte" });
});

test("la connexion elle-même n'est plus sous /admin, donc hors de ce registre", () => {
  // 🔴 `exigencePour` ne répond QUE pour les chemins couverts par le matcher du proxy
  // (`/admin/:path*`). `/connexion` n'en fait pas partie : elle est ouverte parce qu'AUCUNE
  // garde ne la regarde, pas parce qu'une liste l'y autorise.
  // ⚠️ Ce test existe pour empêcher qu'on « répare » ce `inconnu` en ajoutant `/connexion`
  // à `CHEMINS_OUVERTS` : elle y serait inerte, et l'entrée ferait croire à une garde.
  assert.deepEqual(exigencePour("/connexion"), { type: "inconnu" });
});

test("l'ouverture du login n'est PAS un préfixe", () => {
  // Ouvrir `/admin/login/*` ouvrirait aussi ce qu'on y ajouterait plus tard sans y penser.
  assert.deepEqual(exigencePour("/admin/login/autre-chose"), { type: "inconnu" });
});

test("un chemin inconnu sous /admin est REFUSÉ, jamais toléré", () => {
  assert.deepEqual(exigencePour("/admin/section-qui-nexiste-pas"), { type: "inconnu" });
});

// ── ③ Aucune route réelle n'échappe au registre ──────────────────────────────────────

/**
 * 🔴 CE TEST LIT LES ROUTES SUR LE DISQUE, PAS UNE LISTE ÉCRITE À LA MAIN.
 * Une liste recopiée serait fidèle le jour où on l'écrit et fausse au premier ajout, en
 * restant verte (`00 référence/pieges/garde-sur-une-copie.md`, forme n°3). Il énumère donc
 * les dossiers réels de `app/admin` et fait passer chacun par la VRAIE fonction de
 * résolution — celle que le proxy appelle.
 */
function routesReelles(base: string, prefixe = "/admin"): string[] {
  const trouvees: string[] = [];

  for (const entree of readdirSync(base, { withFileTypes: true })) {
    if (entree.isFile() && (entree.name === "page.tsx" || entree.name === "route.ts")) {
      trouvees.push(prefixe);
      continue;
    }
    if (!entree.isDirectory()) continue;

    // Les groupes `(…)` n'apparaissent pas dans l'URL ; un segment dynamique `[x]` se
    // remplace par une valeur quelconque — la résolution ne regarde que les préfixes.
    const segment = entree.name.startsWith("(")
      ? ""
      : entree.name.startsWith("[")
        ? "/valeur"
        : `/${entree.name}`;

    trouvees.push(...routesReelles(join(base, entree.name), `${prefixe}${segment}`));
  }

  return trouvees;
}

test("toute route servie sous /admin est rattachée au registre", () => {
  const routes = [...new Set(routesReelles(join(process.cwd(), "src", "app", "admin")))];

  // Contre-épreuve du test lui-même : s'il ne trouvait plus rien (chemin faux, arborescence
  // déplacée), il serait vert en ne mesurant RIEN.
  assert.ok(routes.length >= 30, `seulement ${routes.length} routes trouvées — parcours cassé ?`);

  const orphelines = routes.filter((route) => exigencePour(route).type === "inconnu");
  assert.deepEqual(
    orphelines,
    [],
    "ces routes ne sont rattachées à aucune section : elles seront REFUSÉES par le proxy. " +
      "Déclarer leur section dans `app/admin/_sections.ts`, ou leur préfixe dans " +
      "`server/auth/sections.ts` si elles ne sont pas navigables.",
  );
});

test("les sections et les routes hors navigation sont des ensembles DISJOINTS", () => {
  // Si une route hors navigation portait le préfixe d'une section, l'une masquerait l'autre
  // selon l'ordre d'évaluation — un rôle appliqué par hasard plutôt que par déclaration.
  for (const section of SECTIONS_ADMIN) {
    assert.deepEqual(
      exigencePour(section.href),
      { type: "role", role: section.role },
      `${section.href} est masquée par une route hors navigation`,
    );
  }
  assert.deepEqual(exigencePour("/admin/medias/photo.jpg"), {
    type: "role",
    role: "admin_site",
  });
});
