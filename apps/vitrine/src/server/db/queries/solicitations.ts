// `server-only` en TOUTE PREMIÈRE LIGNE, comme `client.ts` et les cinq autres familles de
// requêtes (garde-fou n°1 de la Story 1.7) : ce module lit la base, il ne doit jamais être
// atteint depuis un composant client. ⚠️ Ici la garde vaut plus qu'ailleurs — ce module lit
// des NOMS, des ADRESSES E-MAIL et des MESSAGES LIBRES DE TIERS (AR-DB3, NFR5).
import "server-only";
import { count } from "drizzle-orm";

import { db } from "../client";
import { solicitation } from "../schema";

/**
 * Lectures des sollicitations reçues (Story 6.11, FR36 → FR32).
 *
 * Emplacement conforme à `architecture.md` (l.515) : une famille de requêtes par domaine sous
 * `server/db/queries/`. Les composants ne requêtent JAMAIS eux-mêmes — la page appelle puis
 * distribue en props (patron AC1 de la 3.2).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE MODULE NE SERT AUCUNE SURFACE PUBLIQUE — C'EST LE PREMIER DANS CE CAS
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Les cinq autres familles (`events`, `photos`, `partners`, `workshops`, `members`) exportent
 * chacune une requête PUBLIQUE et une requête d'ADMIN. Ici il n'y a que la seconde : une
 * sollicitation ne se publie pas. Ne pas ajouter de `getPublishedSolicitations()` « par
 * symétrie » — ce serait une fuite de données personnelles de tiers.
 */

/**
 * 🔴 LA BORNE DE L'ÉCRAN, PARTAGÉE — et son enjeu n'est PAS celui des cinq autres tables.
 *
 * `MEMBRES_MAX`, `ATELIERS_MAX` & co. bornent des tables **curées** : on y ajoute et on y
 * retire, l'ordre de grandeur est connu et stable. **`solicitation` ne fait que CROÎTRE** —
 * chaque visiteur y écrit, et personne n'y fait le ménage tant que ce n'est pas cet écran.
 *
 * ⚠️ CONSÉQUENCE : une borne posée EN SILENCE rendrait les demandes les plus anciennes
 * inatteignables **sans aucun signal**, sur la seule donnée du site qu'on ne peut pas
 * re-fabriquer. D'où `compterSollicitations()` juste en dessous, et la mention que l'écran
 * affiche quand la borne mord. « Généreux » n'est pas « non borné », mais « borné » n'est pas
 * « tu ne sauras pas ».
 */
export const SOLLICITATIONS_MAX = 200;

/**
 * Les sollicitations d'un état donné, **antéchronologiques**.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 L'ORDRE EST EN SQL, ET IL EST **TOTAL** — ICI CE N'EST MÊME PAS UNE PRÉCAUTION
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `ORDER BY created_at DESC, id DESC` :
 *
 *   · `created_at DESC` — l'AC : la plus récente en haut.
 *   · `id DESC` ensuite, **et c'est la dette R31 qui l'exige**. Le bouton du formulaire public
 *     n'est JAMAIS désactivé (`SolicitationForm`, AC5 de la 5.1) et `submitSolicitation` n'a
 *     aucune clé d'idempotence : un double-clic écrit deux lignes à quelques millisecondes
 *     d'écart, donc **potentiellement au même `created_at`**. Sans second terme, Postgres ne
 *     garantit alors PAS l'ordre — les deux doublons scintilleraient d'un rafraîchissement à
 *     l'autre, sur l'écran même dont le travail est de les distinguer. Un tri départage tout
 *     ou n'est pas déterministe ; il n'y a pas de « suffisamment déterministe ».
 *
 * `is_processed` d'abord dans le `where`, puis `created_at` dans l'ordre — c'est exactement
 * l'index `solicitation_processed_created_at_idx`, posé par la migration `0004` (Story 5.1)
 * **pour cette requête**, avec le commentaire qui l'annonce.
 *
 * 🔴 `columns` EXPLICITES, ET L'ABSENCE EST LE POINT : **ni `email`, ni `message`**. La liste
 * n'en a pas besoin (elle rend l'expéditeur, l'objet, la date et l'état), et une donnée qui
 * n'est pas lue ne peut pas fuiter dans la charge RSC. C'est de la minimisation au sens de
 * NFR5, pas une micro-optimisation : le détail (`getSollicitationById`) les charge, lui, parce
 * que c'est son objet.
 *
 * @param traitee `false` = « à traiter », `true` = « traitées ». Deux appels, deux sections.
 * @param limite borne EXPLICITE, jamais de lecture non bornée.
 */
export async function getSollicitationsForAdmin(traitee: boolean, limite: number) {
  return db.query.solicitation.findMany({
    columns: {
      id: true,
      name: true,
      requestType: true,
      isProcessed: true,
      createdAt: true,
    },
    where: (table, { eq: egal }) => egal(table.isProcessed, traitee),
    orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
    limit: limite,
  });
}

/** Une ligne de la liste, **dérivée de la requête** et non réécrite à la main. */
export type AdminSollicitation = Awaited<
  ReturnType<typeof getSollicitationsForAdmin>
>[number];

/**
 * Le décompte réel par état — **pour dire quand la borne mord**, rien d'autre.
 *
 * 🔴 CE N'EST PAS UNE VIOLATION DE FR16. FR16 interdit les chiffres de **communauté** sur les
 * surfaces **PUBLIQUES**. Ce décompte vit derrière une session, sur un écran qui n'est pas
 * indexé, et il ne compte pas des adhérents mais des demandes reçues. Précédent **tranché en
 * revue de la Story 6.10** : le « N brouillons sur M » de l'aperçu a été jugé conforme pour
 * cette raison exacte, et les écrans d'ateliers et de partenaires font de même depuis la 6.5.
 *
 * ⚠️ UNE SEULE REQUÊTE pour les deux états, et pas deux `count(*)` : l'écran en affiche deux,
 * les faire diverger d'un aller-retour à l'autre n'apporterait rien.
 */
export async function compterSollicitations(): Promise<{
  aTraiter: number;
  traitees: number;
}> {
  const lignes = await db
    .select({ traitee: solicitation.isProcessed, total: count() })
    .from(solicitation)
    .groupBy(solicitation.isProcessed);

  // `groupBy` ne rend PAS de ligne pour un état absent — d'où les deux zéros par défaut
  // plutôt qu'une lecture d'index qui rendrait `undefined` en silence.
  let aTraiter = 0;
  let traitees = 0;
  for (const ligne of lignes) {
    if (ligne.traitee) traitees = ligne.total;
    else aTraiter = ligne.total;
  }
  return { aTraiter, traitees };
}

/**
 * Une sollicitation par son identifiant, pour l'écran de détail. `undefined` si elle n'existe
 * plus (supprimée entre-temps depuis un autre onglet).
 *
 * ⚠️ CELLE-CI charge `email` et `message` : c'est son objet. Elle n'est appelée que par
 * `app/admin/(protege)/sollicitations/[id]/page.tsx`, qui pose sa propre garde `lireAdmin()`
 * en première instruction.
 *
 * `consentGiven` est chargé **et rendu** : le visiteur a coché une case pour qu'on ait le
 * droit de lui répondre (RGPD), et le bénévole qui s'apprête à répondre doit pouvoir le voir.
 * ⚠️ Sa valeur est TOUJOURS `true` — le `CHECK (consent_given = true)` de la `0004` rend une
 * ligne sans consentement **inexistante**. On l'affiche comme un fait acquis, jamais comme une
 * branche de rendu à traiter.
 */
export async function getSollicitationById(id: string) {
  return db.query.solicitation.findFirst({
    columns: {
      id: true,
      name: true,
      email: true,
      requestType: true,
      message: true,
      consentGiven: true,
      isProcessed: true,
      createdAt: true,
    },
    where: (table, { eq: egal }) => egal(table.id, id),
  });
}

/** Le détail d'une sollicitation, dérivé de la requête (même règle que ci-dessus). */
export type SollicitationDetail = NonNullable<
  Awaited<ReturnType<typeof getSollicitationById>>
>;
