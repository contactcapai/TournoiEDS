import "server-only";

import { CONTACT_EMAIL } from "@/lib/links";
import { SOLICITATION_TYPE_LABELS, type SolicitationInput } from "@/lib/schemas/solicitation";

import { getMailTransport } from "./client";

/**
 * Envoie la notification de sollicitation à l'asso elle-même (Q7 : SMTP Gmail depuis
 * `esportdessacres@gmail.com`, tranchée le 2026-07-31).
 *
 * 🔴 N'appelle JAMAIS cette fonction depuis un chemin dont l'échec ferait perdre la
 * sollicitation déjà persistée : voir `submitSolicitation`, qui découple l'`INSERT` de cet envoi.
 */
export async function notifySolicitation(input: SolicitationInput): Promise<void> {
  const transport = getMailTransport();

  await transport.sendMail({
    from: CONTACT_EMAIL,
    to: CONTACT_EMAIL,
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
