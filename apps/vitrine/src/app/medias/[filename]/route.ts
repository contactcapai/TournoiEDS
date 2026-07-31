import { db } from "@/server/db/client";
import { ouvrirMedia } from "@/server/medias";

/**
 * Route de service des médias — `/medias/<nom-de-fichier>` (Story 4.3, FR15, FR21).
 *
 * ⚠️ PREMIER ROUTE HANDLER DU PROJET. Aucun `route.ts` n'existait dans
 * `apps/vitrine/src/app` avant cette story : il n'y a donc **aucune convention interne à
 * suivre**, et il ne faut pas prétendre le contraire. Ce qui s'applique : les codes HTTP
 * sémantiques d'`architecture.md` (l.403), et la frontière `src/server/**` (l.546).
 *
 * ══════════════════════════════════════════════════════════════════════════════════
 * 🔴 RISQUE N°1 DE CETTE STORY : LA TRAVERSÉE DE RÉPERTOIRE
 * ══════════════════════════════════════════════════════════════════════════════════
 *
 * Concaténer un paramètre d'URL à un chemin disque permet de lire un fichier arbitraire
 * du conteneur — au premier rang duquel `.env.prod`, qui porte la chaîne de connexion
 * Postgres. Le risque n'existait pas avec un stockage tiers ; la révision d'architecture
 * du 2026-07-29 (sortie de Supabase Storage) le crée, et c'est ici qu'il se traite.
 *
 * 🔴 CETTE ROUTE NE CONCATÈNE JAMAIS LE PARAMÈTRE D'URL À UN CHEMIN. L'ordre ci-dessous
 * n'est pas négociable, et chaque étape est une garde INDÉPENDANTE :
 *
 *   ① INTERROGER LA TABLE avec le paramètre, en égalité SQL paramétrée, filtrée sur
 *      `is_published`. Aucune ligne ⇒ 404 immédiat. Le paramètre ne sert QUE de clé de
 *      recherche : il ne touche jamais le système de fichiers.
 *   ② NE CONSTRUIRE LE CHEMIN QU'À PARTIR DE LA VALEUR RELUE EN BASE — jamais du
 *      paramètre, même quand les deux sont égaux. La valeur en base a franchi le `CHECK`
 *      `photo_filename_safe` ; le paramètre n'a franchi rien du tout.
 *   ③ RE-VALIDER MALGRÉ TOUT dans `server/medias` (`path.basename` + comparaison de
 *      préfixe sur le chemin résolu). Défense en profondeur : si un `CHECK` était un jour
 *      relâché, ou si la table était peuplée par une restauration antérieure à cette
 *      story, cette ligne tient encore.
 *   ④ `Content-Type` DEPUIS UNE TABLE CLOSE, sur l'extension relue en base — jamais
 *      devinée, jamais reprise d'un en-tête de requête.
 *
 * 🔴 404 ET JAMAIS 403 pour une photo non publiée : un 403 CONFIRME l'existence de la
 * ressource, donc transforme cette route en moyen d'ÉNUMÉRER le contenu non publié — ce
 * que le back-office (6.4) produira dès qu'un bénévole préparera un retour d'événement.
 * L'absence et le refus doivent être indiscernables de l'extérieur.
 *
 * 🔴 AUCUN CHEMIN SYSTÈME DANS LA RÉPONSE, y compris en erreur. Un message du type
 * « ENOENT: /repo/apps/vitrine/medias/x.avif » divulguerait l'arborescence du conteneur.
 * Le corps est un texte fixe ; le diagnostic vit dans les logs serveur, pas dans la
 * réponse.
 */

/**
 * `force-dynamic` : cette route lit la base à chaque appel. Sans lui, Next tenterait de
 * la prérendre au build — et la CI tourne SANS `DATABASE_URL` (garde-fou n°2 de la Story
 * 1.7, structurel dans `.github/workflows/ci.yml`). Même raison que sur `/` et `/agenda`.
 */
export const dynamic = "force-dynamic";

/**
 * Un an, `immutable` : le nom de fichier IDENTIFIE le contenu (le back-office de la 6.4
 * écrira un nouveau nom plutôt que d'écraser un fichier servi). Remplacer un fichier en
 * gardant son nom serait donc le seul geste que ce cache prendrait mal — à rappeler au
 * point de saisie quand la 6.4 arrivera.
 */
const CACHE = "public, max-age=31536000, immutable";

function introuvable() {
  // Corps volontairement muet et identique dans TOUS les cas d'échec (inconnu, non
  // publié, absent du disque) : c'est ce qui rend l'énumération impossible.
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  // ── ① Le paramètre sert de CLÉ DE RECHERCHE, jamais de chemin ────────────────────
  // `eq()` est paramétré par Drizzle : pas d'injection SQL possible. Et une valeur
  // biscornue (`../../.env`) ne peut ici que ne rien trouver — elle n'atteint pas le
  // disque, elle n'atteint même pas `server/medias`.
  const ligne = await db.query.photo.findFirst({
    columns: { filename: true },
    where: (table, { and, eq }) =>
      and(eq(table.filename, filename), eq(table.isPublished, true)),
  });
  if (!ligne) return introuvable();

  // ── ② Le chemin se construit sur la valeur RELUE EN BASE, pas sur le paramètre ───
  // ③ et ④ vivent dans `ouvrirMedia` (basename, préfixe résolu, table MIME close).
  const media = await ouvrirMedia(ligne.filename);
  // Fichier absent du disque : la base et le volume peuvent diverger (restauration
  // partielle, sauvegarde base sans médias — le cas que `backup-medias.sh` documente).
  // On rend 404, on ne jette pas : une photo manquante ne casse pas le rendu public (NFR8).
  if (!media) return introuvable();

  return new Response(media.flux, {
    status: 200,
    headers: {
      "Content-Type": media.typeMime,
      "Content-Length": String(media.taille),
      "Cache-Control": CACHE,
      // Défense en profondeur : même si un fichier au type inattendu franchissait la
      // liste blanche, le navigateur ne devinerait pas son type à partir du contenu.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
