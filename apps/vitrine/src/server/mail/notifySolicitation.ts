import "server-only";

import { SOLICITATION_TYPE_LABELS, type SolicitationInput } from "@/lib/schemas/solicitation";
import { lireReglages } from "@/server/db/queries/settings";

import { COMPTE_SMTP, getMailTransport } from "./client";

/**
 * Envoie la notification de sollicitation à l'asso elle-même (Q7 : SMTP Gmail depuis
 * `esportdessacres@gmail.com`, tranchée le 2026-07-31).
 *
 * 🔴 N'appelle JAMAIS cette fonction depuis un chemin dont l'échec ferait perdre la
 * sollicitation déjà persistée : voir `submitSolicitation`, qui découple l'`INSERT` de cet envoi.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 `from` ET `to` NE VIENNENT PAS DU MÊME ENDROIT — STORY 6.13, ET C'EST DÉLIBÉRÉ
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 *   · `from` = `COMPTE_SMTP`, **constante** : c'est le compte authentifié, celui auquel
 *     `GMAIL_APP_PASSWORD` est lié. Gmail réécrit ou refuse un expéditeur qui n'est pas lui.
 *     Voir l'en-tête de `./client.ts` — le rendre saisissable casserait l'envoi **en silence**.
 *   · `to` = `contactEmail` **lu en base** : c'est ce que la story promet. Quand l'association
 *     change d'adresse, les notifications suivent, sans dev et sans redéploiement.
 *
 * ⚠️ `getMailTransport()` RESTE SYNCHRONE. Ne pas le faire lire la base « pour uniformiser » :
 * son `auth.user` ne doit pas bouger, et le rendre `async` propagerait un `await` dans un
 * singleton construit au premier envoi.
 */
export async function notifySolicitation(input: SolicitationInput): Promise<void> {
  const transport = getMailTransport();
  const { contactEmail } = await lireReglages();

  await transport.sendMail({
    from: COMPTE_SMTP,
    to: contactEmail,
    replyTo: input.email,
    subject: `[Site] Nouvelle sollicitation — ${SOLICITATION_TYPE_LABELS[input.requestType]}`,
    text: [
      `Nom / structure : ${input.name}`,
      `Email : ${input.email}`,
      `Type de demande : ${SOLICITATION_TYPE_LABELS[input.requestType]}`,
      "",
      "Message :",
      input.message,
    ].join("\n"),
  });
}
