import { detientRole } from "@/lib/roles";
import { lireCompte } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { ouvrirMedia } from "@/server/medias";

/**
 * Service des médias POUR LE BACK-OFFICE — `/admin/medias/<nom-de-fichier>` (Story 6.4).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 POURQUOI UNE SECONDE ROUTE PLUTÔT QU'UNE BRANCHE DANS LA ROUTE PUBLIQUE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `app/medias/[filename]/route.ts` filtre sur `is_published` et rend **404** sinon —
 * volontairement, et son commentaire nomme cette story : *« 404 ET JAMAIS 403 … ce que le
 * back-office (6.4) produira dès qu'un bénévole préparera un retour d'événement. »*
 * ⇒ Un aperçu naïf afficherait des **cadres cassés exactement sur les photos qu'on veut
 * regarder avant de publier**.
 *
 * 🔴 ET ON NE TOUCHE PAS À LA ROUTE PUBLIQUE, C'EST UN REFUS MOTIVÉ. Sa sécurité repose sur
 * le fait qu'il n'existe que DEUX réponses indiscernables de l'extérieur (200 / 404) : y
 * ajouter une branche « admin » ferait lire une session sur CHAQUE 404, y compris sur du
 * trafic d'énumération, et introduirait un troisième chemin de code dans la surface la plus
 * exposée du site.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CE QUI EST REPRIS TEL QUEL DE LA ROUTE PUBLIQUE, ET CE QUI CHANGE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * REPRIS — l'ordre ①②③④ de son en-tête reste la doctrine, et il n'a rien d'optionnel :
 *   ① le paramètre d'URL sert de CLÉ DE RECHERCHE en base, jamais de chemin ;
 *   ② le chemin se construit sur la valeur RELUE EN BASE (qui, elle, a franchi le `CHECK`
 *      `photo_filename_safe`) ;
 *   ③ `ouvrirMedia` re-valide (basename + préfixe résolu) — module INCHANGÉ par cette route ;
 *   ④ `Content-Type` depuis une table close, sur l'extension relue en base.
 * La lecture est entourée d'un `try` pour la même raison mesurée en 4.3 : certaines valeurs
 * (`%00`) font échouer le driver AVANT toute réponse de Postgres, et un 500 serait un
 * troisième état de réponse.
 *
 * CE QUI CHANGE, et seulement cela :
 *   · une GARDE de rôle `admin_site` en PREMIÈRE INSTRUCTION — le matcher `/admin/:path*` de
 *     `proxy.ts` couvre bien ce chemin (vérifié), mais la couche ③ ne se délègue pas :
 *     c'est la leçon littérale de la 6.1, où une garde de `layout` n'arrêtait pas le rendu
 *     de la page enfant ;
 *   · AUCUN filtre `is_published` — c'est toute la raison d'être de cette route ;
 *   · `Cache-Control: no-store` — un brouillon n'a rien à faire dans un cache, ni du
 *     navigateur ni d'un intermédiaire. Et l'écart avec la route publique (`max-age=3600`)
 *     est voulu : là-bas le cache sert la performance publique, ici il ne servirait qu'à
 *     faire survivre une image qu'on vient peut-être de supprimer.
 */

export const dynamic = "force-dynamic";

function introuvable() {
  // Corps muet et identique dans TOUS les cas d'échec (pas de session, nom inconnu, fichier
  // absent du disque) : même doctrine que la route publique — l'absence et le refus doivent
  // être indiscernables. Un 403 ici dirait « ce nom existe », donc renseignerait.
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  // 🔴 PREMIÈRE INSTRUCTION, AVANT TOUTE LECTURE. Cette route sert des BROUILLONS : sans
  // cette ligne, elle serait une fuite de données, pas une commodité.
  // ⚠️ Ni `exigerRolePage` (elle redirige) ni `exigerRoleAction` (elle lève) : cette route
  // répond 404 sur TOUT refus, à dessein — l'absence et le refus doivent être
  // indiscernables. Elle nomme donc son rôle elle-même.
  const compte = await lireCompte();
  if (compte === null || !detientRole(compte.roles, "admin_site")) return introuvable();

  const { filename } = await params;

  let ligne;
  try {
    ligne = await db.query.photo.findFirst({
      columns: { filename: true },
      // ⚠️ AUCUN filtre sur `is_published` — c'est la seule différence de requête avec la
      // route publique, et c'est ce que cette route existe pour faire.
      where: (table, { eq }) => eq(table.filename, filename),
    });
  } catch {
    return introuvable();
  }
  if (!ligne) return introuvable();

  const media = await ouvrirMedia(ligne.filename);
  if (!media) return introuvable();

  return new Response(media.flux, {
    status: 200,
    headers: {
      "Content-Type": media.typeMime,
      "Content-Length": String(media.taille),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
