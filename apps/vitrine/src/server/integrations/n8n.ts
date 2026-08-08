// `server-only` en TOUTE PREMIÈRE LIGNE (patron `server/db/client.ts` puis `server/mail/client.ts`,
// Garde-fou n°1) : fait échouer le build si ce module est jamais atteint depuis un composant
// client. Le jeton du webhook reste strictement côté serveur.
import "server-only";

import { publicationPayloadSchema, type PublicationPayload } from "@/lib/schemas/publication";

/**
 * L'UNIQUE point d'appel de n8n (FR23, AR-API2 — Story 6.7).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 POURQUOI CE FICHIER N'EST PAS RANGÉ AVEC `server/mail/`, SON JUMEAU FONCTIONNEL
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Le projet a **deux** intégrations sortantes et **deux** rangements : `server/mail/` (SMTP,
 * Story 5.1) et `server/integrations/` (ici). L'incohérence est réelle et **assumée**, pas
 * subie :
 *
 *   · **AR-API2 nomme littéralement ce chemin** — *« un seul utilitaire
 *     `src/server/integrations/n8n.ts` (POST webhook, payload typé Zod), jamais d'appel n8n
 *     dispersé »*. Un fichier neuf suit l'architecture ;
 *   · **on ne déplace pas `server/mail/` depuis cette story.** Doctrine posée par la 2.7 et
 *     tenue depuis : on ne change pas le rangement d'une story mergée depuis une autre. Le
 *     déplacement coûterait des imports dans trois fichiers pour un gain d'esthétique, et il
 *     ferait porter à cette story un risque qui n'est pas le sien.
 *
 * ⇒ Si l'unification vaut la peine un jour, elle vaut **une décision**, pas un effet de bord.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QUE CE MODULE NE FAIT PAS, ET QUI EST LA MOITIÉ DU LIVRABLE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Il **déclenche**. Il ne publie pas. Au 2026-08-07, le workflow n8n qu'il appelle reçoit,
 * valide et journalise — il ne porte **aucun** nœud Instagram / X / Discord, parce qu'aucun
 * compte social de l'association n'est renseigné (dette **R29**, gelée) et qu'aucun identifiant
 * d'API n'existe. Les nœuds sont **absents**, jamais « désactivés » : un nœud désactivé
 * *ressemble* à une livraison, et c'est très exactement la forme que prend la dette **R32**.
 * Le mode de défaillance est écrit dans **R42** (`deferred-work.md`).
 */

/**
 * ⚠️ **AUCUNE de ces deux variables n'est lue au niveau module.** C'est le garde-fou n°1 de la
 * Story 1.7, repayé par `mail/client.ts` : une lecture à l'import ferait **échouer `next build`
 * sans secret**, donc en CI, donc sur la porte qui tient tout le reste du projet. Elles sont
 * lues à l'appel, et leur absence produit un verdict utilisable — jamais une exception au
 * chargement.
 */
const VARIABLE_URL = "N8N_WEBHOOK_URL";
const VARIABLE_JETON = "N8N_WEBHOOK_TOKEN";

/**
 * En-tête portant le jeton — **Header Auth**, l'une des quatre méthodes du nœud Webhook
 * (Basic / Header / JWT / None, doc n8n lue le 2026-08-07).
 *
 * 🔴 EN EN-TÊTE, JAMAIS DANS L'URL NI DANS LE CORPS. Une URL part dans les journaux d'accès de
 * tout ce qu'elle traverse (proxy, Traefik, n8n lui-même) ; un corps part dans les **données
 * d'exécution** que n8n conserve et affiche. L'en-tête est le seul des trois que n8n ne
 * réaffiche pas dans le corps d'exécution. La garde ② de `gate:reseaux` mesure que la **valeur**
 * du jeton n'apparaît jamais dans le corps émis — même famille que la garde ⑬ de
 * `gate:sollicitations` sur `GMAIL_APP_PASSWORD`.
 */
const EN_TETE_JETON = "x-eds-webhook-token";

/**
 * Délai maximal d'un appel, en millisecondes.
 *
 * 🔴 EXPLICITE, ET LA VALEUR EST UN ARBITRAGE ÉCRIT. Sans lui, `fetch` attend le délai par
 * défaut du système d'exploitation (de l'ordre de **deux minutes** sous Linux) : un n8n muet —
 * conteneur redémarré, instance saturée, DNS qui pend — laisserait un bénévole devant un bouton
 * qui tourne, sans verdict, sur un geste qu'il n'ose pas rejouer parce qu'il pourrait publier
 * deux fois. C'est le finding *« délais manquants »* de la revue de la 5.1 (Edge Case Hunter),
 * transposé.
 *
 * **15 s** : n8n répond ici après validation du corps (mode « Respond to Webhook »), pas
 * immédiatement — il faut donc lui laisser exécuter deux nœuds, tout en restant sous le seuil
 * où quelqu'un conclut que l'écran est cassé.
 */
const DELAI_MS = 15_000;

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 `https` EXIGÉ — TRANSPOSITION DE `requireTLS` — **SAUF SUR LA BOUCLE LOCALE**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Ce `POST` transporte le **jeton d'authentification** du webhook et le contenu de l'annonce.
 * En clair, les deux sont lisibles par tout intermédiaire du chemin. Le finding de la revue de
 * la 5.1 (Blind Hunter) disait littéralement qu'un transport « opportuniste » retombe en clair
 * sans rien dire : ici on **fait échouer** plutôt que d'accepter.
 *
 * 🔴 **ET L'EXEMPTION DE BOUCLE LOCALE N'EST PAS UN CONFORT DE DÉVELOPPEMENT — C'EST CE QUI
 * REND LA GARDE MESURABLE.** Une première version de ce fichier refusait `http://` sans
 * exception. Conséquence immédiate, découverte en écrivant la porte : `gate:reseaux` ne pouvait
 * plus émettre **un seul vrai POST** vers son faux n8n sans fabriquer un certificat auto-signé
 * et désarmer la vérification TLS du processus — c'est-à-dire remplacer une mesure d'effet par
 * une lecture de source. Or c'est exactement le mécanisme de la dette **R32** : une garde
 * correcte sur le papier qui rend le maillon **invérifiable**, donc jamais vérifié. La règle ②
 * de `pieges/integration-tierce.md` dit l'inverse — *« choisir le transport vérifiable dans
 * l'environnement de développement »*.
 *
 * Le modèle de menace le justifie, il n'est pas plié pour la commodité : sur `127.0.0.1`, le
 * paquet **ne quitte pas la machine**. Il n'y a aucun intermédiaire à qui le cacher.
 *
 * ⚠️ **L'EXEMPTION EST ÉTROITE, ET LE PIÈGE EST LE SUFFIXE.** `http://localhost.attaquant.fr`
 * est un hôte **public** dont le nom commence par « localhost ». Le motif exige donc que
 * l'hôte soit suivi d'un `:`, d'un `/` ou de la fin de chaîne — jamais d'un point.
 *
 * ⚠️ Test sur la chaîne **BRUTE**, jamais sur `new URL(...).protocol` : `new URL` **normalise**,
 * et c'est ce qui avait laissé passer « HTTPS:// », « https:exemple.fr » et « https:/x » en
 * Story 6.5. Ici la casse compte : `HTTPS://` est refusé, comme dans `links.ts`.
 */
const LOOPBACK_EN_CLAIR = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

/** Vrai si l'URL du webhook peut transporter un jeton sans l'exposer. Exporté pour la porte. */
export function transportAcceptable(url: string): boolean {
  return url.startsWith("https://") || LOOPBACK_EN_CLAIR.test(url);
}

/** Ce que l'appelant apprend d'un appel. Aucun détail technique ne franchit cette frontière. */
export type ResultatPublication =
  | { ok: true }
  | { ok: false; error: string; cause: CausePublication };

/**
 * Pourquoi l'appel a échoué — **pour le journal serveur, jamais pour l'écran**.
 *
 * L'écran reçoit `error`, une phrase écrite pour un bénévole. Ce discriminant existe pour que
 * `console.error` dise quelque chose d'exploitable six mois plus tard, et pour que la porte
 * puisse distinguer les cas sans lire le texte français.
 */
export type CausePublication =
  | "configuration" // variable absente ou URL inutilisable
  | "reseau" // injoignable, DNS, TLS
  | "delai" // le webhook n'a pas répondu à temps
  | "refus" // le webhook a répondu, mais en erreur
  | "payload"; // le message construit ne respecte pas son propre contrat

/**
 * Envoie un événement au webhook n8n.
 *
 * 🔴 **NE LÈVE JAMAIS.** Toute erreur de transport devient un `{ ok: false }`. L'appelant est
 * une Server Action dont l'échec doit rester lisible : une exception y remonterait au client
 * sous forme de « An error occurred in the Server Components render », qui est exactement
 * l'« erreur technique brute » que l'AC de cette story interdit d'exposer.
 *
 * ⚠️ **AUCUNE REPRISE AUTOMATIQUE, ET C'EST DÉLIBÉRÉ.** Un `POST` rejoué peut produire **deux
 * annonces publiques**, que ce back-office ne sait pas dépublier. On ne réessaie donc jamais
 * dans le dos de l'utilisateur : une tentative, un verdict, et c'est lui qui décide. C'est la
 * différence de nature avec un envoi d'e-mail, où un doublon se supprime.
 */
export async function publierEvenement(
  payload: PublicationPayload,
): Promise<ResultatPublication> {
  // Le contrat est vérifié AVANT le réseau : un message malformé n'a aucune raison de partir,
  // et le diagnostic « le payload est faux » ne doit pas se déguiser en « n8n a refusé ».
  const analyse = publicationPayloadSchema.safeParse(payload);
  if (!analyse.success) {
    return {
      ok: false,
      cause: "payload",
      error: "L'annonce n'a pas pu être préparée. Signalez-le : c'est un défaut du site.",
    };
  }

  const brut = process.env[VARIABLE_URL];
  if (!brut || brut.trim() === "") {
    return {
      ok: false,
      cause: "configuration",
      error:
        "La publication réseaux n'est pas configurée sur ce site : la variable " +
        `${VARIABLE_URL} est absente. Rien n'a été envoyé.`,
    };
  }

  const url = brut.trim();

  if (!transportAcceptable(url)) {
    return {
      ok: false,
      cause: "configuration",
      error:
        `L'adresse du webhook (${VARIABLE_URL}) doit commencer par « https:// ». ` +
        "Rien n'a été envoyé : en clair, le jeton d'accès serait lisible en chemin.",
    };
  }

  const jeton = process.env[VARIABLE_JETON];

  try {
    const reponse = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Le jeton n'est ajouté que s'il existe : une instance n8n peut légitimement exposer un
        // webhook sans authentification (méthode « None » du nœud). Envoyer un en-tête vide
        // ferait échouer une configuration valide.
        ...(jeton && jeton.trim() !== "" ? { [EN_TETE_JETON]: jeton.trim() } : {}),
      },
      body: JSON.stringify(analyse.data),
      signal: AbortSignal.timeout(DELAI_MS),
      // Pas de cache : c'est une mutation, et Next met en cache les `fetch` GET par défaut.
      cache: "no-store",
    });

    if (!reponse.ok) {
      // 🔴 LE CODE HTTP RESTE ICI. Il part au journal serveur par l'appelant, jamais à l'écran :
      // « 401 » ne dit rien à un bénévole, et un code de statut est une information sur notre
      // infrastructure.
      return {
        ok: false,
        cause: "refus",
        error:
          "Le service de publication a refusé l'annonce. Réessayez dans un moment ; " +
          "si cela persiste, prévenez la personne qui gère le site.",
      };
    }

    return { ok: true };
  } catch (erreur) {
    // `AbortSignal.timeout` rejette avec un `TimeoutError` ; tout le reste est un échec réseau.
    const delai = erreur instanceof Error && erreur.name === "TimeoutError";
    return {
      ok: false,
      cause: delai ? "delai" : "reseau",
      error: delai
        ? "Le service de publication n'a pas répondu à temps. L'annonce n'est peut-être pas " +
          "partie : vérifiez sur vos réseaux avant de réessayer."
        : "Le service de publication est injoignable. L'annonce n'a pas été envoyée.",
    };
  }
}

/**
 * Le nom des variables d'environnement, **exporté pour la porte**.
 *
 * ⚠️ Exporté pour que `gate:reseaux` garde l'**unicité** de l'appel (AR-API2) en cherchant le
 * nom réel plutôt qu'une chaîne recopiée dans l'instrument — `pieges/garde-nominale.md`.
 */
export const VARIABLES_N8N = { url: VARIABLE_URL, jeton: VARIABLE_JETON } as const;

/** L'en-tête du jeton, exporté pour la porte (même motif que `VARIABLES_N8N`). */
export const EN_TETE_JETON_N8N = EN_TETE_JETON;

/** Le délai maximal, exporté pour que la porte mesure le contrat réel et non une copie. */
export const DELAI_PUBLICATION_MS = DELAI_MS;
