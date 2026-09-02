/**
 * L'adresse publique du site — **une seule idée de « où vit ce site »**.
 *
 * 🔴 EXTRAITE À LA STORY 7.5 PARCE QUE LA BASCULE EN CRÉAIT LA CINQUIÈME COPIE. Le même
 * repli (`?? "https://esportdessacres.fr"`) était déjà écrit trois fois — `app/layout.tsx`
 * (`metadataBase`, 1.6), `app/opengraph-image.tsx` (7.3) et `server/actions/reseaux.ts`
 * (6.7) — et `robots.ts` / `sitemap.ts` en demandaient deux de plus. C'est la famille
 * garde-sur-une-copie : cinq écritures de la même adresse divergent au premier changement
 * d'hôte, et la copie oubliée reste **verte à toutes les portes** tout en publiant un lien
 * vers le mauvais domaine.
 *
 * ⚠️ `NEXT_PUBLIC_SITE_URL` EST INLINÉE AU BUILD (cf. `Dockerfile`), pas lue à l'exécution.
 * Un changement d'hôte exige donc `docker compose build vitrine` — un `up -d` seul laisserait
 * les canoniques, le sitemap et les liens d'annonce pointer vers l'hôte précédent. C'est écrit
 * dans `docker/.env.example`, en face de `VITRINE_HOST`.
 *
 * ⚠️ En développement la valeur est `http://localhost:3000` : les liens produits pointent vers
 * le poste. C'est visible et assumé — le prix d'un maillon vérifiable en local.
 *
 * Le repli vaut le domaine **de production** et non celui du staging : une variable absente
 * doit tomber sur l'adresse définitive, jamais sur un hôte qui porte `noindex`.
 */
export function baseDuSite(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://esportdessacres.fr").replace(/\/+$/, "");
}
