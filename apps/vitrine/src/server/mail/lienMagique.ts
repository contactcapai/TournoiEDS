import "server-only";

import { delaiLisible } from "../../lib/delai";
import { COMPTE_SMTP, getMailTransport } from "./client";

/**
 * Envoie le lien de connexion à usage unique (Story 8.1, PR ②).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 IL RÉUTILISE `getMailTransport()`, IL NE DÉCLARE PAS SON PROPRE SMTP
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Le fournisseur `Nodemailer` d'Auth.js accepte une option `server` qui construirait un
 * second transport à partir d'une seconde configuration. **On ne s'en sert pas**, et c'est
 * un choix de sécurité, pas de style : la configuration de `./client.ts` porte `requireTLS`
 * et trois délais explicites, tous les quatre AJOUTÉS EN REVUE de la Story 5.1 parce qu'ils
 * manquaient. Une seconde configuration serait fidèle le jour où on l'écrit, puis
 * divergerait en silence — et la moitié qui divergerait ici enverrait des **liens de
 * connexion** sur une liaison possiblement en clair.
 * (`00 référence/pieges/garde-sur-une-copie.md`, forme n°3 : « l'instrument qui recopie les
 * constantes qu'il devrait lire ».)
 *
 * ⚠️ `from` reste `COMPTE_SMTP` et NON l'adresse de contact saisissable au back-office :
 * Gmail réécrit ou refuse un expéditeur qui n'est pas le compte authentifié. Même
 * raisonnement que `notifySolicitation`, et il est écrit au long dans `./client.ts`.
 */
export async function envoyerLienMagique({
  destinataire,
  url,
  expiration,
}: {
  destinataire: string;
  url: string;
  expiration: Date;
}): Promise<void> {
  const transport = getMailTransport();

  // ⚠️ Le domaine est tiré de l'URL RÉELLE du lien, jamais écrit en dur : ce message part
  // depuis staging comme depuis la production, et une phrase qui nommerait le mauvais
  // domaine ferait douter de l'authenticité du courriel — exactement ce qu'on ne veut pas
  // sur un message qui demande de cliquer.
  const domaine = new URL(url).host;

  // 🔴 DÉFAUT MESURÉ SUR STAGING LE 2026-08-25, avec 222 tests au vert : cette phrase
  // rendait toujours des minutes, et la durée de vie par défaut d'un lien Auth.js étant de
  // 24 h, le courriel réel annonçait « expire dans 1440 minutes ». La règle vit maintenant
  // dans `lib/delai.ts`, où elle est testée — un formatage se trompe SANS RIEN CASSER.
  const delai = delaiLisible(expiration.getTime() - Date.now());

  await transport.sendMail({
    from: COMPTE_SMTP,
    to: destinataire,
    subject: "Votre lien de connexion — Esport des Sacres",
    text: [
      "Bonjour,",
      "",
      `Voici votre lien de connexion à ${domaine} :`,
      "",
      url,
      "",
      `Ce lien ne fonctionne qu'une seule fois et expire dans ${delai}.`,
      "",
      // 🔴 CETTE PHRASE N'EST PAS UNE FORMULE DE POLITESSE. Un lien magique est une clé
      // envoyée par courriel : la personne qui en reçoit un sans l'avoir demandé doit savoir
      // qu'elle n'a RIEN à faire — surtout pas cliquer pour « vérifier ».
      "Si vous n'avez pas demandé ce lien, ignorez ce message : personne ne peut se",
      "connecter à votre place tant que vous ne cliquez pas.",
      "",
      "— Esport des Sacres",
    ].join("\n"),
  });
}
