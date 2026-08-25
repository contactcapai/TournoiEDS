"use server";

// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 NE PAS CONFONDRE AVEC `actions/sollicitations.ts` — UN `l` ET UN `s` D'ÉCART
// ══════════════════════════════════════════════════════════════════════════════════════
//
//   · CE FICHIER (`solicitation.ts`) → **PUBLIQUE, NON AUTHENTIFIÉE** (Story 5.1). Un seul
//     export, `submitSolicitation`, appelé par le formulaire de `/partenaires`. Sa garde
//     n'est PAS une session : c'est un rate-limit, un honeypot et Zod.
//   · `actions/sollicitations.ts` → **ADMIN** (Story 6.11). `await exigerRoleAction("admin_site")` y est la
//     première ligne de chaque export.
//
// Un import qui se trompe de module **compile**, passe le lint et passe le typecheck. D'où ce
// bandeau dans les deux fichiers. ⚠️ Ne jamais ajouter d'export authentifié ICI : la garde ⑧
// de `gate:sollicitations` vérifie que TOUT export de l'autre fichier commence par
// une garde de rôle — une propriété qu'un module mixte rendrait impossible à écrire.

import { headers } from "next/headers";

import { HONEYPOT_FIELD, solicitationInputSchema } from "../../lib/schemas/solicitation";
import { db } from "../db/client";
import { solicitation } from "../db/schema";
import { notifySolicitation } from "../mail/notifySolicitation";

export type SubmitSolicitationResult = { ok: true } | { ok: false; error: string };

/**
 * 🔴 Rate-limit EN MÉMOIRE DE PROCESSUS, volontairement pas extrait en abstraction générique
 * (un seul consommateur aujourd'hui — règle « payé deux fois », METHODE.md §5). Se réinitialise
 * à chaque redémarrage/déploiement : limite DÉCLARÉE, pas masquée (une seule instance Next).
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 3;
const submissionsByIp = new Map<string, number[]>();

/**
 * `x-forwarded-for` absente ⇒ IP INCONNUE, pas « 127.0.0.1 ». Trouvé en revue (Blind Hunter
 * finding #2) : un littéral partagé aurait regroupé TOUS les appelants sans en-tête dans le
 * même compteur — trois vrais visiteurs distincts, chacun sans en-tête, s'auto-excluraient
 * mutuellement en moins de trois requêtes. `null` signale « on ne sait pas qui c'est » et
 * `isRateLimited` traite ce cas à part (voir plus bas) plutôt que de fabriquer une identité.
 */
async function resolveClientIp(): Promise<string | null> {
  // `headers()` est ASYNC depuis Next 15+ — l'oublier ne casse pas la compilation si le
  // typage est trop lâche, donc `await` explicite ici (garde-fou de la story).
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || null;
}

/**
 * 🔴 IP inconnue (pas d'en-tête) ⇒ ON N'APPLIQUE PAS LA LIMITE plutôt que de regrouper des
 * inconnus sous une clé commune (voir `resolveClientIp`). En production derrière Traefik,
 * l'en-tête est TOUJOURS posé (`epics.md` AR-SEC3) — ce cas ne couvre que le développement
 * local ou un accès qui contourne le reverse proxy, jamais le trafic public réel.
 */
function isRateLimited(ip: string | null): boolean {
  if (ip === null) return false;

  const now = Date.now();

  // Purge opportuniste des clés dont TOUS les jetons sont expirés — trouvé en revue (Blind
  // Hunter + Edge Case Hunter) : sans elle, une IP différente à chaque requête (triviale à
  // fabriquer, l'en-tête est un simple en-tête HTTP) fait grossir `submissionsByIp` sans
  // borne pour toute la durée de vie du processus.
  for (const [key, timestamps] of submissionsByIp) {
    if (timestamps.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) {
      submissionsByIp.delete(key);
    }
  }

  const timestamps = (submissionsByIp.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  timestamps.push(now);
  submissionsByIp.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

/**
 * Server Action de soumission du formulaire de sollicitation (FR32, Story 5.1).
 *
 * 🔴 PREMIÈRE Server Action mutante réellement câblée du projet public. Retour discriminé SANS
 * `data` (variante assumée : rien côté public ne consomme le résultat au-delà de `ok`).
 *
 * Ordre non négociable : rate-limit → honeypot → Zod → consentement (re-vérifié serveur) →
 * `INSERT` → tentative d'envoi SMTP DÉCOUPLÉE (son échec ne fait jamais échouer la réponse).
 * ⚠️ Le rate-limit passe AVANT le honeypot (inversé par rapport à la 1ʳᵉ version de cette
 * story) : trouvé en revue (Edge Case Hunter) — un honeypot vérifié en premier laisse un bot
 * qui le remplit contourner ENTIÈREMENT le rate-limit et marteler la route sans aucune limite.
 * Le honeypot reste avant Zod et avant toute écriture, ce que l'AC exige explicitement.
 */
export async function submitSolicitation(
  formData: FormData,
): Promise<SubmitSolicitationResult> {
  // 1. Rate-limit — avant tout, y compris le honeypot (voir commentaire ci-dessus).
  const ip = await resolveClientIp();
  if (isRateLimited(ip)) {
    return {
      ok: false,
      error: "Trop de demandes en peu de temps, merci de réessayer dans une minute.",
    };
  }

  // 2. Honeypot — vérifié AVANT toute validation Zod et AVANT toute écriture. Ne révèle
  // jamais la détection : retourne le même succès qu'un envoi réel.
  const honeypot = formData.get(HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.length > 0) {
    return { ok: true };
  }

  // 3. Validation Zod — un seul schéma, partagé avec le formulaire client.
  const parsed = solicitationInputSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    requestType: formData.get("requestType"),
    message: formData.get("message"),
    consentGiven: formData.get("consentGiven") === "on",
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      ok: false,
      error: firstIssue?.message ?? "Le formulaire contient une erreur.",
    };
  }

  const input = parsed.data;

  // 4. Consentement re-vérifié côté serveur — ne jamais faire confiance à la seule
  // validation client. (Le schéma Zod l'exige déjà, cette ligne est une garde explicite.)
  if (!input.consentGiven) {
    return {
      ok: false,
      error:
        "Coche la case de consentement pour qu'on ait le droit de te répondre — c'est le RGPD qui l'exige.",
    };
  }

  // 5. Persistance et envoi NE PARTAGENT PAS LE MÊME SORT.
  let insertedId: string;
  try {
    const [row] = await db
      .insert(solicitation)
      .values({
        name: input.name,
        email: input.email,
        requestType: input.requestType,
        message: input.message,
        consentGiven: input.consentGiven,
      })
      .returning({ id: solicitation.id });
    insertedId = row.id;
  } catch (err) {
    // Trouvé en revue (Edge Case Hunter) : sans ce log, un échec d'écriture en production
    // (pool épuisé, base injoignable) est totalement invisible — aucune trace nulle part.
    console.error("[submitSolicitation] Échec de l'écriture en base :", err);
    return {
      ok: false,
      error: "Une erreur est survenue à l'enregistrement, merci de réessayer.",
    };
  }

  try {
    await notifySolicitation(input);
  } catch (err) {
    // La donnée est en sécurité en base (visible à la Story 6.11) : l'échec d'envoi ne fait
    // JAMAIS échouer la réponse affichée à l'utilisateur. Aucune file de re-tentative en v1.
    console.error(
      `[submitSolicitation] Notification email échouée pour solicitation ${insertedId} :`,
      err,
    );
  }

  return { ok: true };
}
