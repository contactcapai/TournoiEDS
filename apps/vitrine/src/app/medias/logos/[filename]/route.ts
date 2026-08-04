import { cheminLogo, nomFichierLogo } from "@/lib/logos";
import { db } from "@/server/db/client";
import { ouvrirMedia } from "@/server/medias";

/**
 * Service PUBLIC des logos de partenaires — `/medias/logos/<nom-de-fichier>` (Story 6.5).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 POURQUOI UNE ROUTE DE PLUS, ET NON UNE BRANCHE DANS `/medias/[filename]`
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * **Fait mesuré au cadrage de cette story, et rien ne le disait nulle part** : les deux routes
 * de médias existantes interrogent **`db.query.photo`**, et elles seules. `schema.ts` annonçait
 * pourtant que `partner.logo` porterait « demain la route de service des médias posée par la
 * Story 4.3 », et que *« ce qui changera est la VALEUR écrite, pas la colonne »* — vrai pour la
 * colonne, **faux pour la route**.
 *
 * ⚠️ Écrire `/medias/<uuid>.webp` dans `partner.logo` aurait donc rendu **404 en silence** :
 * fichier présent sur le volume, ligne présente en base, `lint`/`typecheck`/`build` verts, et
 * un cadre vide sur la page d'accueil. C'est la famille de **R21** (la base `vitrine` créée à
 * la main) et du montage Docker corrigé en 4.3 : *tout réussit, rien ne fonctionne*.
 *
 * 🔴 ET ON NE BRANCHE PAS LA ROUTE PHOTO — REFUS MOTIVÉ, MÊME ARGUMENT QU'EN 6.4. Sa sécurité
 * repose sur le fait qu'il n'existe que **deux** réponses indiscernables de l'extérieur
 * (200 / 404). Y ajouter un repli « et sinon, cherche dans `partner` » ferait une **seconde
 * requête sur chaque 404**, y compris sur du trafic d'énumération, et introduirait un
 * troisième chemin de code dans la surface la plus exposée du site.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CE QUI EST REPRIS TEL QUEL DE LA ROUTE PHOTO — L'ORDRE ①②③④ N'EST PAS NÉGOCIABLE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 *   ① le paramètre d'URL sert de **clé de recherche** en base, jamais de chemin. Ici la clé
 *      est `PREFIXE_LOGO + filename` : la colonne stocke un chemin complet, pas un nom nu.
 *      ⚠️ La concaténation se fait avec une constante **du serveur** et une valeur **liée** par
 *      Drizzle — le paramètre ne touche ni le disque, ni la grammaire SQL ;
 *   ② le chemin disque ne se construit qu'à partir de la valeur **RELUE EN BASE** (qui, elle,
 *      a franchi le `CHECK` `partner_logo_valide` posé par la migration `0009`) ;
 *   ③ `ouvrirMedia` re-valide (`path.basename` + comparaison de préfixe résolu) — **module
 *      inchangé par cette route** ;
 *   ④ `Content-Type` depuis une table close, sur l'extension relue en base.
 *
 * La lecture est entourée d'un `try` pour la raison mesurée en 4.3 : certaines valeurs (`%00`)
 * font échouer le driver **avant** toute réponse de Postgres, et un 500 serait un troisième
 * état de réponse — c'est-à-dire un signal qui distingue une valeur d'une autre.
 *
 * ⚠️ **LES DEUX SENS SONT UTILISÉS, ET ILS NE SONT PAS SYMÉTRIQUES** — c'est la relecture la
 * plus facile à rater de ce fichier :
 *   · `cheminLogo(filename)` **recompose** la clé cherchée, à partir du paramètre. On ne
 *     décompose PAS la valeur reçue : la différence est exactement celle entre « faire
 *     confiance au paramètre » et « s'en servir comme clé » ;
 *   · `nomFichierLogo(ligne.logo)` **décompose** la valeur **relue en base**, et seulement
 *     elle. Il re-vérifie le préfixe au passage — inutile aujourd'hui (le `WHERE` vient de
 *     l'imposer), mais c'est la même défense en profondeur que le `path.basename` d'
 *     `ouvrirMedia` : elle tiendra le jour où la requête changera.
 */

export const dynamic = "force-dynamic";

/**
 * Une heure, et surtout pas `immutable` — même arbitrage que la route photo (revue 4.3).
 *
 * ⚠️ Ce qui change n'est pas le fichier (son nom est un UUID) mais son **autorisation** :
 * dépublier un partenaire, ou lui retirer son logo, EST le mécanisme de retrait du
 * back-office. `immutable` ferait continuer de servir l'image aux visiteurs déjà servis
 * pendant un an. Le compromis est entre la fraîcheur du RETRAIT et le trafic.
 */
const CACHE = "public, max-age=3600, must-revalidate";

function introuvable() {
  // Corps muet et identique dans TOUS les cas d'échec (nom inconnu, partenaire non publié,
  // fichier absent du disque) : c'est ce qui rend l'énumération impossible.
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

  let ligne;
  try {
    ligne = await db.query.partner.findFirst({
      columns: { logo: true },
      // 🔴 `is_published` EST LE FILTRE, et il n'est pas décoratif : un partenaire en
      // brouillon est une information que personne n'a décidé de rendre publique — son logo
      // non plus. 404 et jamais 403 : l'absence et le refus doivent être indiscernables.
      where: (table, { and, eq }) =>
        and(eq(table.logo, cheminLogo(filename)), eq(table.isPublished, true)),
    });
  } catch {
    // Base injoignable, valeur que le driver refuse (`%00`), délai dépassé… : dans tous les
    // cas le logo n'est pas servable. Le diagnostic appartient aux logs, pas à la réponse.
    return introuvable();
  }
  if (!ligne?.logo) return introuvable();

  // ② Le chemin se construit sur la valeur RELUE EN BASE. Le préfixe est retiré ICI, avant
  //    l'appel : `ouvrirMedia` ne connaît que des noms de fichier NUS, et il ne doit pas
  //    apprendre la notion de préfixe — il est la porte vers le disque, pas un routeur.
  const nom = nomFichierLogo(ligne.logo);
  if (nom === null) return introuvable();

  const media = await ouvrirMedia(nom);
  if (!media) return introuvable();

  return new Response(media.flux, {
    status: 200,
    headers: {
      "Content-Type": media.typeMime,
      "Content-Length": String(media.taille),
      "Cache-Control": CACHE,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
