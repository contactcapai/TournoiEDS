/**
 * Lire la réponse du service de rédaction — la partie qui ne parle à personne.
 *
 * 🔴 SÉPARÉE DE `server/integrations/gemini.ts` PARCE QU'ELLE EST PURE, DONC TESTABLE. Le
 * transport a besoin d'une clé et du réseau ; l'analyse de ce qui revient n'a besoin de rien,
 * et c'est là que les deux défauts du 2026-09-08 vivaient.
 */

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LE TEXTE N'EST PAS FORCÉMENT DANS `output_text` — MESURÉ SUR LA RÉPONSE RÉELLE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Un appel réel du 2026-09-08 rend un corps SANS `output_text` au premier niveau : ses clés
 * sont `id, model, object, service_tier, status, steps, updated, usage`, et le texte vit dans
 * `steps[].content[].text`. Le SDK peut le synthétiser — mais s'y fier seul, c'est parier sur
 * une commodité qu'on n'a jamais vue fonctionner, alors que la forme du fil est, elle, mesurée.
 *
 * ⚠️ Les `steps` portent aussi des étapes de réflexion sans `content` : on les traverse sans
 * supposer qu'elles ont la même forme.
 */
export function texteRendu(interaction: unknown): string {
  if (typeof interaction !== "object" || interaction === null) return "";
  const objet = interaction as Record<string, unknown>;

  const direct = objet.output_text;
  if (typeof direct === "string" && direct.trim() !== "") return direct;

  const steps = objet.steps;
  if (!Array.isArray(steps)) return "";
  const morceaux: string[] = [];
  for (const etape of steps) {
    if (typeof etape !== "object" || etape === null) continue;
    const contenu = (etape as Record<string, unknown>).content;
    if (!Array.isArray(contenu)) continue;
    for (const bloc of contenu) {
      if (typeof bloc !== "object" || bloc === null) continue;
      const b = bloc as Record<string, unknown>;
      if (b.type === "text" && typeof b.text === "string") morceaux.push(b.text);
    }
  }
  return morceaux.join("").trim();
}

/**
 * Le service a-t-il REFUSÉ (4xx) plutôt que manqué à l'appel ?
 *
 * ⚠️ On cherche le statut à deux endroits parce que le SDK le pose aux deux : sur l'erreur
 * elle-même et sur la réponse brute qu'elle transporte. Un 429 (quota) compte comme un refus :
 * recliquer tout de suite ne fait que le confirmer.
 */
export function estRefus(erreur: unknown): boolean {
  const statut = statutHttp(erreur);
  return statut !== null && statut >= 400 && statut < 500;
}

function statutHttp(valeur: unknown): number | null {
  if (typeof valeur !== "object" || valeur === null) return null;
  const objet = valeur as Record<string, unknown>;
  if (typeof objet.status === "number") return objet.status;
  const brute = objet.rawResponse;
  if (typeof brute === "object" && brute !== null) {
    const s = (brute as Record<string, unknown>).status;
    if (typeof s === "number") return s;
  }
  return null;
}
