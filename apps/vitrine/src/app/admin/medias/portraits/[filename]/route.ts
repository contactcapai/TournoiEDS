import { cheminPortrait, nomFichierPortrait } from "@/lib/portraits";
import { detientRole } from "@/lib/roles";
import { lireCompte } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { ouvrirMedia } from "@/server/medias";

/**
 * Service des portraits POUR LE BACK-OFFICE — `/admin/medias/portraits/<nom>` (Story 6.10).
 *
 * Même montage que `/admin/medias/[filename]` (6.4) et `/admin/medias/logos/[filename]` (6.5),
 * pour la même raison : la route publique filtre sur `is_published` et rend **404** sinon,
 * volontairement. Un aperçu naïf afficherait donc des **cadres cassés exactement sur les
 * portraits qu'on veut regarder avant de publier** — c'est-à-dire au seul moment où l'écran
 * doit dire la vérité.
 *
 * CE QUI CHANGE PAR RAPPORT À LA ROUTE PUBLIQUE, ET SEULEMENT CELA :
 *   · une garde de rôle `admin_site` en **PREMIÈRE INSTRUCTION**. Le matcher `/admin/:path*` de
 *     `proxy.ts` couvre bien ce chemin, mais la couche ne se délègue pas : c'est la leçon
 *     littérale de la 6.1, où une garde de `layout` n'arrêtait pas le rendu de la page
 *     enfant ;
 *   · **aucun filtre `is_published`** — c'est toute la raison d'être de cette route ;
 *   · `Cache-Control: no-store` — un brouillon n'a rien à faire dans un cache, ni du navigateur
 *     ni d'un intermédiaire. 🔴 Et il s'agit ici du **visage d'une personne que l'association
 *     n'a pas encore publiée** : c'est la donnée du site qu'il faut le moins laisser traîner.
 *
 * 🔴 ET LES IMAGES QUI PASSENT PAR ICI NE PEUVENT PAS ÊTRE OPTIMISÉES. `/_next/image` requête
 * **depuis le serveur, sans cookie de session** : il reçoit le `307 → /admin/login`, pas une
 * image. Aucune entrée `/admin/medias/**` n'est donc ajoutée à `images.localPatterns` — une
 * autorisation que plus rien ne consomme est une « porte sans pièce ». Le rendu passe
 * `unoptimized`, et les deux faits voyagent ensemble dans le booléen `sourceAdmin`
 * (`lib/portraits.ts`). Mesuré au gate visuel de la 6.4 : sans cela, **aucune vignette ne
 * s'affiche**.
 */

export const dynamic = "force-dynamic";

function introuvable() {
  // Corps muet et identique dans tous les cas d'échec (pas de session, nom inconnu, fichier
  // absent) : même doctrine que la route publique. Un 403 ici dirait « ce nom existe ».
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  // 🔴 PREMIÈRE INSTRUCTION, AVANT TOUTE LECTURE. Cette route sert les portraits de membres
  // NON PUBLIÉS : sans cette ligne, elle serait une fuite de données personnelles, pas une
  // commodité.
  // ⚠️ Ni `exigerRolePage` (elle redirige) ni `exigerRoleAction` (elle lève) : cette route
  // répond 404 sur TOUT refus, à dessein — l'absence et le refus doivent être
  // indiscernables. Elle nomme donc son rôle elle-même.
  const compte = await lireCompte();
  if (compte === null || !detientRole(compte.roles, "admin_site")) return introuvable();

  const { filename } = await params;

  let ligne;
  try {
    ligne = await db.query.member.findFirst({
      columns: { portrait: true },
      // ⚠️ AUCUN filtre sur `is_published` — c'est la seule différence de requête avec la route
      // publique, et c'est ce que cette route existe pour faire.
      where: (table, { eq }) => eq(table.portrait, cheminPortrait(filename)),
    });
  } catch {
    return introuvable();
  }
  if (!ligne?.portrait) return introuvable();

  const nom = nomFichierPortrait(ligne.portrait);
  if (nom === null) return introuvable();

  const media = await ouvrirMedia(nom);
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
