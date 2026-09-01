// ══════════════════════════════════════════════════════════════════════════════════════
// COUCHE ① DE LA GARDE D'ACCÈS — `/admin/*` (Story 6.1, FR27, AR-SEC2)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 CE FICHIER S'APPELLE `proxy.ts` ET NON `middleware.ts`. Next 16 a renommé la
// convention : la fonction exportée est `proxy`, et `middleware.ts` est DÉPRÉCIÉ (« sera
// retiré dans une version future »). `architecture.md` prescrivait `middleware.ts` à trois
// endroits — corrigé à la source par cette story.
//
// 🔴 AUCUNE OPTION `runtime` ICI, ET CE N'EST PAS UN OUBLI : depuis Next 16.0.0 le Proxy
// tourne en **Node.js par défaut**, et l'option `runtime` n'est pas disponible dans un
// fichier Proxy — **la déclarer lève une erreur**. C'est ce runtime Node qui rend possible
// l'appel à `auth()` ci-dessous (session en base, driver `postgres`) : sous Edge — le défaut
// jusqu'à Next 15 — il aurait fallu scinder la configuration d'Auth.js en deux.
//
// ⚠️ CETTE COUCHE NE PROTÈGE QUE L'ACCÈS AUX ROUTES. Elle est AVEUGLE aux Server Actions
// déplacées ou réutilisées ailleurs (doc Next, § Execution order). La garde des mutations est
// `exigerRoleAction()` (`server/auth/guard.ts`), et celle du rendu est `exigerRolePage()`,
// appelée par chaque page. Les trois couches ne se remplacent pas.
//
// 🔴 DEPUIS LA STORY 8.1, ELLE NE DEMANDE PLUS « ES-TU CONNECTÉ ? » MAIS « AS-TU LE RÔLE DE
// CE CHEMIN ? ». L'exigence est DÉRIVÉE du registre des sections (`server/auth/sections.ts`),
// jamais recopiée ici : une seconde liste de chemins divergerait au premier renommage, en
// restant verte (`00 référence/pieges/garde-sur-une-copie.md`).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { detientRole } from "./lib/roles";
import { lireCompte } from "./server/auth/guard";
import { CHEMIN_CONNEXION } from "./lib/auth/chemins";
import { exigencePour } from "./server/auth/sections";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const exigence = exigencePour(pathname);

  // 🔴 CETTE SORTIE LAISSE PASSER LES DEUX CHEMINS HÉRITÉS pour que `next.config.ts` puisse
  // les rediriger vers `/connexion`. Depuis la 12.4 la page de connexion vit HORS du matcher
  // `/admin/:path*`, donc la boucle de redirection d'origine n'est plus possible ; ce qui le
  // serait, sans cette sortie, c'est un refus opposé à `/admin/login` AVANT sa redirection.
  if (exigence.type === "ouvert") return NextResponse.next();

  const compte = await lireCompte();

  // `next` porte la destination initiale pour que la page de login puisse y ramener après
  // connexion — sinon un lien profond vers `/admin/agenda` retomberait sur le tableau de bord.
  if (compte === null) {
    const destination = new URL(CHEMIN_CONNEXION, request.url);
    destination.searchParams.set("next", pathname);
    return NextResponse.redirect(destination);
  }

  // 🔴 UN CHEMIN SOUS `/admin` QUE LE REGISTRE NE COUVRE PAS EST REFUSÉ, PAS TOLÉRÉ.
  // C'est la garde de la story suivante, pas de celle-ci : une page ajoutée sous
  // `/admin/…` sans entrée dans `SECTIONS_ADMIN` serait autrement ouverte à tout compte
  // connecté, par simple omission — et rien ne le dirait. Fermée, ça se voit tout de suite.
  if (exigence.type === "inconnu") {
    return NextResponse.redirect(new URL("/admin/refus?role=inconnu", request.url));
  }

  if (exigence.type === "role" && !detientRole(compte.roles, exigence.role)) {
    return NextResponse.redirect(new URL(`/admin/refus?role=${exigence.role}`, request.url));
  }

  return NextResponse.next();
}

// 🔴 MATCHER POSITIF ET ÉTROIT, JAMAIS UN MATCHER NÉGATIF LARGE. Un `/((?!api|_next).*)`
// couvrirait tout le site public et casserait deux choses : `/api/auth/*` (le flux OAuth
// lui-même, qui ne peut pas revenir si on le bloque) et `/medias/[filename]` (route de
// service des photos, Story 4.3). Il ferait aussi entrer chaque page publique dans une
// requête de session inutile, alors que FR28 exige l'inverse.
export const config = {
  matcher: "/admin/:path*",
};
