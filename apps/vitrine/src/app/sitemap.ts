import type { MetadataRoute } from "next";

import { baseDuSite } from "@/lib/site-url";
import { getSlugsTournoisPublies } from "@/server/db/queries/tournaments";

/**
 * 🔴 `force-dynamic` — ET CE N'EST PAS UNE PRÉCAUTION, C'EST LE DÉFAUT QUE LA 12.5 A PAYÉ
 * LE JOUR MÊME OÙ ELLE A ÉTÉ ÉCRITE, ET LA 7.3 APRÈS ELLE.
 *
 * Ce fichier **lit la base** (les slugs des tournois publiés). Sans cette ligne, Next le
 * prérend au build — et la CI construit **sans aucun secret**, donc sans `DATABASE_URL` :
 * le build casse. ⚠️ **Invisible en local par construction** : `.env.local` fournit la DSN,
 * la lecture réussit, et le plan de site se génère très bien sur le poste. C'est la CI, et
 * elle seule, qui voit ce défaut.
 * ⚠️ Un sitemap prérendu serait par ailleurs **faux dès le premier tournoi publié après le
 * build** : figé sur l'état du jour de la construction de l'image.
 */
export const dynamic = "force-dynamic";

/**
 * Le plan du site — **né avec la bascule en production (Story 7.5)**.
 *
 * 🔴 IL N'EN EXISTAIT AUCUN : mesuré le 2026-09-02, `/sitemap.xml` rendait **404**. Le
 * `layout.tsx` de la Story 1.6 le disait d'ailleurs en toutes lettres (« pas de sitemap ici,
 * hors périmètre ») — c'était vrai tant que le site n'était pas public.
 *
 * 🔴 CE QUI N'Y FIGURE PAS Y EST ABSENT POUR UNE RAISON, PAS PAR OUBLI :
 *   · `/profil` porte `robots: noindex` (12.1) et sert des données personnelles — une URL
 *     annoncée dans un plan de site *et* interdite d'index est une contradiction envoyée
 *     à un moteur ;
 *   · `/connexion`, `/admin/**`, `/overlay/**` et `/api/**` sont refusés par `robots.ts` —
 *     les lister ici contredirait le fichier d'à côté.
 * ⇒ **La règle est : ce qu'un visiteur peut lire sans compte.** Neuf entrées fixes plus une
 *   par tournoi publié.
 *
 * ⚠️ `lastModified` VIENT DE LA DONNÉE QUAND ELLE EXISTE, JAMAIS DE L'HORLOGE. Écrire
 * `new Date()` sur les pages fixes annoncerait à chaque requête que tout le site vient d'être
 * modifié — un signal faux, et qui apprend au moteur à ne plus croire ce champ. Les pages
 * éditoriales n'ont pas de date de modification en base : elles n'en portent donc pas.
 * Les fiches de tournoi, elles, ont un `updatedAt` réel.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseDuSite();
  const tournois = await getSlugsTournoisPublies();

  // Les pages éditoriales, dans l'ordre du chrome — `priority` dit seulement l'importance
  // RELATIVE entre nos propres URLs (aucun effet sur le classement face aux autres sites).
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/agenda`, priority: 0.9 },
    { url: `${base}/tournois`, priority: 0.9 },
    { url: `${base}/animations`, priority: 0.8 },
    { url: `${base}/l-asso`, priority: 0.8 },
    { url: `${base}/partenaires`, priority: 0.7 },
    // Obligatoires (Story 12.5), et donc légitimement indexables — mais ce n'est pas par
    // elles qu'on cherche une association.
    { url: `${base}/mentions-legales`, priority: 0.3 },
    { url: `${base}/confidentialite`, priority: 0.3 },
  ];

  return [
    ...pages,
    ...tournois.map((tournoi) => ({
      url: `${base}/tournois/${tournoi.slug}`,
      lastModified: tournoi.updatedAt,
      priority: 0.6,
    })),
  ];
}
