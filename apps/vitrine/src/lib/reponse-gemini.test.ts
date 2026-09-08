import assert from "node:assert/strict";
import { test } from "node:test";

import { estRefus, texteRendu } from "./reponse-gemini";

/**
 * Les deux défauts trouvés le 2026-09-08 en éprouvant un appel RÉEL depuis le VPS — aucun des
 * deux n'était visible au typecheck, au lint ni au build.
 */

/** La forme réelle du corps rendu par l'API, relevée sur l'appel du 2026-09-08. */
const REPONSE_REELLE = {
  id: "v1_Chc…",
  model: "gemini-3.8-flash",
  object: "interaction",
  status: "completed",
  usage: { total_tokens: 2038 },
  steps: [
    { signature: "EqskCqgkARFNMg8…" }, // étape de réflexion : AUCUN `content`
    { content: [{ type: "text", text: '{"discord":"ok"}' }] },
  ],
};

test("🔴 le texte se lit dans `steps` quand `output_text` est ABSENT", () => {
  // C'est le cas mesuré : les clés du corps réel sont id, model, object, service_tier,
  // status, steps, updated, usage — pas d'`output_text`. S'y fier seul rendait "" , donc
  // un `JSON.parse` en échec, donc « réponse inexploitable » sur un appel parfaitement réussi.
  assert.equal(texteRendu(REPONSE_REELLE), '{"discord":"ok"}');
});

test("`output_text` l'emporte quand le SDK le fournit", () => {
  assert.equal(
    texteRendu({ output_text: "direct", steps: [{ content: [{ type: "text", text: "x" }] }] }),
    "direct",
  );
});

test("une étape de réflexion sans `content` ne fait pas tomber la lecture", () => {
  // ⚠️ L'appel réel en portait une, avec une `signature` et rien d'autre.
  assert.equal(texteRendu({ steps: [{ signature: "abc" }] }), "");
  assert.equal(texteRendu({}), "");
  assert.equal(texteRendu(null), "");
  assert.equal(texteRendu("pas un objet"), "");
});

test("plusieurs blocs de texte se recollent dans l'ordre", () => {
  assert.equal(
    texteRendu({
      steps: [
        { content: [{ type: "text", text: '{"a":' }] },
        { content: [{ type: "thinking" }, { type: "text", text: '"b"}' }] },
      ],
    }),
    '{"a":"b"}',
  );
});

test("🔴 un 403 est un REFUS, pas une absence de réponse", () => {
  // Vécu : la clé portait une restriction d'IP. L'écran disait « le service n'a pas répondu »,
  // donc le bénévole aurait recliqué sans fin sur un problème d'administration.
  assert.equal(estRefus({ status: 403 }), true);
  assert.equal(estRefus({ rawResponse: { status: 403 } }), true);
  assert.equal(estRefus({ status: 429 }), true, "un quota se lit aussi comme un refus");
});

test("un 5xx ou une panne réseau ne sont PAS des refus — là, réessayer a un sens", () => {
  assert.equal(estRefus({ status: 500 }), false);
  assert.equal(estRefus({ status: 503 }), false);
  assert.equal(estRefus(new Error("fetch failed")), false);
  assert.equal(estRefus(null), false);
});
