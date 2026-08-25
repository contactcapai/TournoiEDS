import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FAMILLES_ADMIN,
  LIBELLE_FAMILLE,
  SECTIONS_ADMIN,
  type SectionAdmin,
  cheminCouvertPar,
  famillesUtiles,
  grouperParFamille,
  sectionCourante,
  sectionsPour,
} from "../../app/admin/_sections";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LE REGROUPEMENT DU MENU (Story 13.2) — CE QUI PEUT DEVENIR FAUX SANS RIEN CASSER
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Le `role` et la `famille` sont des champs OBLIGATOIRES du type : une section qui en
 * oublierait un ne compile pas. Ces tests ne réparent donc pas un oubli — ils gardent les
 * deux règles que le compilateur ne peut PAS voir : l'accord entre la famille et ce que le
 * code fait réellement, et la dégradation du groupement.
 *
 * ⚠️ CE QU'ILS NE COUVRENT PAS : le rendu du menu (l'œil le voit mieux), et le fait qu'un
 * lien masqué ne protège rien — masquer n'a jamais été une garde, c'est le proxy qui l'est.
 */

// ── ① L'accord entre la famille et le CODE, pas entre la famille et une intention ──────

const PHRASE_APERCU = "Voir le rendu avant de publier.";

test("🔴 toute section rangée en « publication » promet bien un aperçu", () => {
  // ══════════════════════════════════════════════════════════════════════════════════════
  // ⚠️ CET INVARIANT NE VAUT QUE DANS UN SENS, ET C'EST UNE CORRECTION DU CADRAGE
  // ══════════════════════════════════════════════════════════════════════════════════════
  //
  // La story affirmait : « PUBLICATION = EXACTEMENT les cinq qui portent Voir le rendu avant
  // de publier ». **Faux, mesuré le 2026-08-25 au premier lancement de ce test : elles sont
  // SIX.** `/admin/tournois` porte la phrase depuis la Story 9.3 (sa route `apercu/` existe)
  // et reste rangée en `gestion` — c'est un espace qu'on PILOTE, et la séparation des rôles
  // fait qu'un admin site ne le voit même pas.
  //
  // Forcer la réciproque aurait été tordre le rangement pour sauver une jolie phrase. Le sens
  // qui reste est celui qui PROTÈGE quelque chose : ranger une section en « publication »
  // promet au bénévole qu'il pourra voir avant de publier. Si la promesse n'existe pas, le
  // titre de famille ment — c'est la « porte sans pièce » que `_sections.ts` combat depuis
  // deux occurrences.
  for (const section of SECTIONS_ADMIN) {
    if (section.famille !== "publication") continue;
    assert.ok(
      section.description.endsWith(PHRASE_APERCU),
      `${section.href} est rangée en « publication » mais ne promet aucun aperçu`,
    );
  }
});

test("la réciproque est FAUSSE, et c'est mesuré — pas supposé", () => {
  // Ce test existe pour que la correction ci-dessus ne se fasse pas « re-corriger » un jour
  // par quelqu'un qui relirait le cadrage sans relancer la mesure.
  const prometteuses = SECTIONS_ADMIN.filter((section) =>
    section.description.endsWith(PHRASE_APERCU),
  );
  assert.equal(prometteuses.length, 6, "six sections promettent un aperçu, pas cinq");
  assert.ok(
    prometteuses.some((section) => section.famille !== "publication"),
    "au moins une (les tournois) promet un aperçu SANS être en publication",
  );
});

test("chaque famille déclarée porte au moins une section", () => {
  // Une famille sans section est un titre qui ne rangerait rien — le mécanisme « porte sans
  // pièce » que `_sections.ts` existe pour empêcher, appliqué au niveau du dessus.
  for (const famille of FAMILLES_ADMIN) {
    assert.ok(
      SECTIONS_ADMIN.some((section) => section.famille === famille),
      `la famille « ${famille} » ne range aucune section`,
    );
    assert.ok(LIBELLE_FAMILLE[famille], `la famille « ${famille} » n'a pas de libellé`);
  }
});

// ── ② La dégradation — conséquence directe du filtrage par rôle (Story 8.1) ───────────

const SECTION = (href: string, famille: SectionAdmin["famille"]): SectionAdmin => ({
  href,
  libelle: href,
  description: "peu importe",
  role: "admin_site",
  famille,
  icone: "agenda",
});

test("une famille sans section visible ne s'affiche pas", () => {
  const groupes = grouperParFamille([SECTION("/a", "gestion")]);
  assert.deepEqual(
    groupes.map((groupe) => groupe.famille),
    ["gestion"],
    "les familles vides doivent disparaître, pas rendre un titre nu",
  );
});

test("🔴 une seule famille visible ⇒ AUCUN titre", () => {
  // Cas réel depuis la 8.1 : un « admin tournoi » ne voit qu'UNE entrée. Trois titres de
  // famille au-dessus d'un seul lien ajouteraient trois lignes de chrome à un menu qui en
  // compte une.
  const seul = sectionsPour(["admin_tournoi"]);
  assert.equal(seul.length, 1, "un admin tournoi ne devrait voir qu'une section");
  assert.equal(famillesUtiles(grouperParFamille(seul)), false);
});

test("plusieurs familles visibles ⇒ on titre", () => {
  const groupes = grouperParFamille(sectionsPour(["admin_site"]));
  assert.ok(groupes.length > 1);
  assert.equal(famillesUtiles(groupes), true);
});

test("l'ordre des familles est celui du registre, pas celui des sections", () => {
  const groupes = grouperParFamille([
    SECTION("/z", "configuration"),
    SECTION("/a", "publication"),
  ]);
  assert.deepEqual(groupes.map((groupe) => groupe.famille), ["publication", "configuration"]);
});

// ── ③ Quelle entrée est « courante » ──────────────────────────────────────────────────

test("une sous-route marque la section qui la contient", () => {
  assert.equal(sectionCourante("/admin/agenda/bars/42", SECTIONS_ADMIN)?.href, "/admin/agenda");
});

test("🔴 un chemin qui COMMENCE comme une section n'est pas dedans", () => {
  // Même règle que la garde du proxy, et c'est la MÊME fonction : `/admin/agendas` marqué
  // actif serait le pendant visuel d'une route ouverte par erreur.
  assert.equal(cheminCouvertPar("/admin/agendas", "/admin/agenda"), false);
  assert.equal(sectionCourante("/admin/agendas", SECTIONS_ADMIN), null);
});

test("le tableau de bord ne marque aucune section", () => {
  // `/admin` n'est pas une section : le marquer ferait clignoter une entrée au hasard.
  assert.equal(sectionCourante("/admin", SECTIONS_ADMIN), null);
});
