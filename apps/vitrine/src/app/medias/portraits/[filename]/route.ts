import { cheminPortrait, nomFichierPortrait } from "@/lib/portraits";
import { db } from "@/server/db/client";
import { ouvrirMedia } from "@/server/medias";

/**
 * Service PUBLIC des portraits de membres — `/medias/portraits/<nom-de-fichier>` (Story 6.10).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 POURQUOI UNE **TROISIÈME** ROUTE, ET NON UNE BRANCHE DANS UNE EXISTANTE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Les deux routes publiques existantes interrogent chacune **une seule table** :
 * `/medias/[filename]` → `photo` (4.3), `/medias/logos/[filename]` → `partner` (6.5). Écrire
 * `/medias/<uuid>.webp` dans `member.portrait` rendrait donc **404 en silence** : fichier
 * présent sur le volume, ligne présente en base, `lint`/`typecheck`/`build` verts, et un cadre
 * cassé sur `/l-asso`. C'est le fait ① du cadrage de la 6.5, qui avait failli être payé — et la
 * famille de **R21** : *tout réussit, rien ne fonctionne*.
 *
 * 🔴 ET ON NE BRANCHE AUCUNE DES DEUX AUTRES — REFUS MOTIVÉ, MÊME ARGUMENT QU'EN 6.4 ET 6.5.
 * Leur sécurité repose sur le fait qu'il n'existe que **deux** réponses indiscernables de
 * l'extérieur (200 / 404). Un repli « et sinon, cherche dans `member` » ferait une **seconde
 * requête sur chaque 404**, y compris sur du trafic d'énumération.
 *
 * ⚠️ Et ici l'enjeu du 404 est plus élevé qu'ailleurs : **ce fichier est le visage de
 * quelqu'un**. Une route qui distinguerait « ce nom n'existe pas » de « ce membre n'est pas
 * publié » dirait à un inconnu qu'une personne figure dans la base sans être affichée.
 *
 * ⚠️ Le préfixe d'URL n'est PAS un dossier : le volume est plat, `ouvrirMedia` ne connaît que
 * des noms de fichier nus (voir `lib/portraits.ts`).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CE QUI EST REPRIS TEL QUEL — L'ORDRE ①②③④ N'EST PAS NÉGOCIABLE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 *   ① le paramètre d'URL sert de **clé de recherche** en base, jamais de chemin. La
 *      concaténation se fait avec une constante **du serveur** et une valeur **liée** par
 *      Drizzle — le paramètre ne touche ni le disque, ni la grammaire SQL ;
 *   ② le chemin disque ne se construit qu'à partir de la valeur **RELUE EN BASE** (qui, elle,
 *      a franchi le `CHECK` `member_portrait_valide` posé par la migration `0011`) ;
 *   ③ `ouvrirMedia` re-valide (`path.basename` + comparaison de préfixe résolu) — **module
 *      inchangé par cette route** ;
 *   ④ `Content-Type` depuis une table close, sur l'extension relue en base.
 *
 * La lecture est entourée d'un `try` pour la raison mesurée en 4.3 : certaines valeurs (`%00`)
 * font échouer le driver **avant** toute réponse de Postgres, et un 500 serait un troisième
 * état de réponse — c'est-à-dire un signal qui distingue une valeur d'une autre.
 *
 * ⚠️ **LES DEUX SENS SONT UTILISÉS, ET ILS NE SONT PAS SYMÉTRIQUES** :
 *   · `cheminPortrait(filename)` **recompose** la clé cherchée, à partir du paramètre ;
 *   · `nomFichierPortrait(ligne.portrait)` **décompose** la valeur **relue en base**, et
 *     seulement elle.
 */

export const dynamic = "force-dynamic";

/**
 * Une heure, et surtout pas `immutable` — même arbitrage que les deux autres routes.
 *
 * ⚠️ Ce qui change n'est pas le fichier (son nom est un UUID) mais son **autorisation** :
 * dépublier un membre, ou lui retirer son portrait, EST le mécanisme de retrait du
 * back-office. `immutable` ferait continuer de servir l'image aux visiteurs déjà servis
 * pendant un an. 🔴 Et sur une donnée personnelle, ce délai n'est pas qu'un confort : quelqu'un
 * qui demande le retrait de sa photo a le droit qu'elle cesse d'être servie.
 */
const CACHE = "public, max-age=3600, must-revalidate";

function introuvable() {
  // Corps muet et identique dans TOUS les cas d'échec (nom inconnu, membre non publié, fichier
  // absent du disque) : c'est ce qui rend l'énumération impossible.
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
    ligne = await db.query.member.findFirst({
      columns: { portrait: true },
      // 🔴 `is_published` EST LE FILTRE, et il n'est pas décoratif : un membre en brouillon est
      // une personne que personne n'a décidé de rendre publique — son portrait non plus. 404 et
      // jamais 403 : l'absence et le refus doivent être indiscernables.
      where: (table, { and, eq }) =>
        and(eq(table.portrait, cheminPortrait(filename)), eq(table.isPublished, true)),
    });
  } catch {
    // Base injoignable, valeur que le driver refuse (`%00`), délai dépassé… : dans tous les cas
    // le portrait n'est pas servable. Le diagnostic appartient aux logs, pas à la réponse.
    return introuvable();
  }
  if (!ligne?.portrait) return introuvable();

  // ② Le chemin se construit sur la valeur RELUE EN BASE. Le préfixe est retiré ICI, avant
  //    l'appel : `ouvrirMedia` ne connaît que des noms de fichier NUS, et il ne doit pas
  //    apprendre la notion de préfixe — il est la porte vers le disque, pas un routeur.
  const nom = nomFichierPortrait(ligne.portrait);
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
