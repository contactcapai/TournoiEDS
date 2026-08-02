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
// `requireAdmin()` (`server/auth/guard.ts`), et celle du rendu est `app/admin/layout.tsx`.
// Les trois couches ne se remplacent pas.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "./server/auth/config";

/** Page de connexion — seule route sous `/admin` qui doit rester ouverte. */
const CHEMIN_LOGIN = "/admin/login";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 🔴 SANS CETTE SORTIE, LA REDIRECTION BOUCLE SUR ELLE-MÊME. Le matcher couvre
  // `/admin/:path*`, donc `/admin/login` en fait partie : un visiteur non connecté serait
  // renvoyé vers une page qui le renvoie vers elle-même. Le symptôme
  // (`ERR_TOO_MANY_REDIRECTS`) est franc, mais il n'apparaît qu'à l'exécution.
  if (pathname === CHEMIN_LOGIN) return NextResponse.next();

  const session = await auth();
  if (session) return NextResponse.next();

  // `next` porte la destination initiale pour que la page de login puisse y ramener après
  // connexion — sinon un lien profond vers `/admin/agenda` (Story 6.3) retomberait toujours
  // sur le tableau de bord.
  const destination = new URL(CHEMIN_LOGIN, request.url);
  destination.searchParams.set("next", pathname);
  return NextResponse.redirect(destination);
}

// 🔴 MATCHER POSITIF ET ÉTROIT, JAMAIS UN MATCHER NÉGATIF LARGE. Un `/((?!api|_next).*)`
// couvrirait tout le site public et casserait deux choses : `/api/auth/*` (le flux OAuth
// lui-même, qui ne peut pas revenir si on le bloque) et `/medias/[filename]` (route de
// service des photos, Story 4.3). Il ferait aussi entrer chaque page publique dans une
// requête de session inutile, alors que FR28 exige l'inverse.
export const config = {
  matcher: "/admin/:path*",
};
