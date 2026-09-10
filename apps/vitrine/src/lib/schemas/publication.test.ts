import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { composerMessages } from "../message-reseaux";
import { PAYLOAD_SOURCE, PAYLOAD_VERSION, publicationPayloadSchema } from "./publication";

/**
 * 🔴 LA RÈGLE VIT EN DEUX EXEMPLAIRES, ET C'EST LE README DE `n8n/` QUI LE DIT : le schéma
 * ci-contre, et le validateur du workflow. Ils ne se voient pas l'un l'autre — un champ ajouté
 * ici et oublié là-bas produit un refus que PERSONNE ne voit avant qu'un bénévole ne clique.
 *
 * Ce fichier exécute le **vrai** code du nœud, extrait du JSON versionné, contre des payloads
 * construits par le **vrai** schéma. Il ne réimplémente ni l'un ni l'autre — une porte qui
 * recopie la règle qu'elle garde valide sa propre copie (`pieges/garde-nominale.md`).
 */

const CHEMIN_WORKFLOW = path.join(process.cwd(), "n8n", "publication-reseaux.json");

/** Extrait le code du nœud Code et le rend appelable avec un faux `$input`. */
function validateurDuWorkflow(): (corps: unknown) => { valide: boolean; manques: string[] } {
  const workflow = JSON.parse(fs.readFileSync(CHEMIN_WORKFLOW, "utf8")) as {
    nodes: { type: string; parameters: { jsCode?: string } }[];
  };
  const noeuds = workflow.nodes.filter((n) => n.type.endsWith(".code"));
  assert.equal(noeuds.length, 1, "le workflow doit porter exactement un nœud Code");
  const code = noeuds[0].parameters.jsCode;
  assert.ok(code, "le nœud Code est vide");

  const executer = new Function("$input", code) as (
    input: unknown,
  ) => [{ json: { valide: boolean; manques: string[] } }];
  return (corps) => executer({ first: () => ({ json: { body: corps } }) })[0].json;
}

const DEBUT = new Date("2026-09-24T18:00:00+02:00");
const LIEN = "https://esportdessacres.fr/agenda";

function payloadEvenement() {
  return {
    version: PAYLOAD_VERSION,
    source: PAYLOAD_SOURCE,
    evenement: {
      id: "0b1e6a5c-9d3a-4e2b-8f11-2c7d5a6b3e40",
      titre: "Party Game - Guitar Hero",
      type: "thursday" as const,
      debut: "2026-09-24T18:00:00+02:00",
      lieu: "Le Dropkick Bar Reims",
      adresse: "Reims Courlancy, Reims",
      jeux: "Guitar Hero",
      description: null,
      lien: LIEN,
    },
    messages: composerMessages({
      titre: "Party Game - Guitar Hero",
      debut: DEBUT,
      lieu: "Le Dropkick Bar Reims",
      adresse: "Reims Courlancy, Reims",
      jeux: "Guitar Hero",
      lien: LIEN,
    }),
    // 🔴 AJOUTÉ LE 2026-09-10 AVEC LE CHAMP LUI-MÊME : sans lui ces deux tests tombent, et
    // c'est très bien — ils gardent le contrat ENTRE le site et le workflow, donc ils doivent
    // rougir dès qu'un champ obligatoire apparaît d'un côté sans l'autre.
    reseaux: ["discord" as const],
    // ⚠️ AVEC image : c'est le cas que Brice a trouvé cassé le 2026-09-10 — on en choisissait
    // une, elle ne partait pas. Le cas SANS image est couvert juste en dessous, et c'est lui
    // le nominal : Discord REFUSE un embed dont l'URL est vide, donc les deux doivent passer.
    imageUrl: `${LIEN.replace("/agenda", "")}/medias/abc123.webp`,
  };
}

test("🔴 ce que le site ÉMET, le workflow l'ACCEPTE — annonce d'événement", () => {
  const payload = payloadEvenement();
  assert.ok(publicationPayloadSchema.safeParse(payload).success, "refusé par le schéma du site");
  const rendu = validateurDuWorkflow()(payload);
  assert.deepEqual(rendu.manques, []);
  assert.equal(rendu.valide, true);
});

test("🔴 un post SANS image passe les deux — c'est le cas NOMINAL", () => {
  // Discord refuse un embed dont l'URL est vide (mesuré : 400). Le workflow doit donc pouvoir
  // recevoir `imageUrl: null` et décider de ne rien attacher — jamais recevoir une URL vide.
  const payload = { ...payloadEvenement(), imageUrl: null };
  assert.ok(publicationPayloadSchema.safeParse(payload).success, "refusé par le schéma du site");
  assert.deepEqual(validateurDuWorkflow()(payload).manques, []);
});

test("🔴 un post LIBRE (sans événement) passe les deux", () => {
  // C'est le cas que l'écran /admin/reseaux a introduit, et que l'ancien validateur refusait.
  const payload = { ...payloadEvenement(), evenement: null };
  assert.ok(publicationPayloadSchema.safeParse(payload).success, "refusé par le schéma du site");
  const rendu = validateurDuWorkflow()(payload);
  assert.deepEqual(rendu.manques, []);
  assert.equal(rendu.valide, true);
});

test("le workflow refuse un numéro de version qu'il ne connaît pas", () => {
  // ⚠️ La garde qui explique pourquoi `PAYLOAD_VERSION` reste à 1 : la bouger casserait tout
  // jusqu'au ré-import.
  const rendu = validateurDuWorkflow()({ ...payloadEvenement(), version: 2 });
  assert.equal(rendu.valide, false);
  assert.match(rendu.manques.join(" "), /version attendue 1/);
});

test("le workflow refuse un texte manquant, et NOMME lequel", () => {
  const payload = payloadEvenement();
  const rendu = validateurDuWorkflow()({
    ...payload,
    messages: { ...payload.messages, instagram: "   " },
  });
  assert.equal(rendu.valide, false);
  assert.match(rendu.manques.join(" "), /messages\.instagram absent/);
});

test("🔴 le workflow refuse un X trop long — c'est l'API de X qui refuserait sinon", () => {
  const payload = payloadEvenement();
  const rendu = validateurDuWorkflow()({
    ...payload,
    messages: { ...payload.messages, x: "T".repeat(281) },
  });
  assert.equal(rendu.valide, false);
  assert.match(rendu.manques.join(" "), /281 caracteres/);
});

test("un événement présent mais incomplet reste refusé", () => {
  // La souplesse ajoutée porte sur l'ABSENCE d'événement, pas sur un événement bancal.
  const payload = payloadEvenement();
  const rendu = validateurDuWorkflow()({
    ...payload,
    evenement: { ...payload.evenement, debut: "2026-09-24T18:00:00Z" },
  });
  assert.equal(rendu.valide, false);
  assert.match(rendu.manques.join(" "), /ISO avec offset/);
});
