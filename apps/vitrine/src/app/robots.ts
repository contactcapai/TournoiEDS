import type { MetadataRoute } from "next";

import { baseDuSite } from "@/lib/site-url";

/**
 * `robots.txt` — **né avec la bascule en production (Story 7.5)**.
 *
 * 🔴 IL N'EN EXISTAIT AUCUN : mesuré le 2026-09-02, `https://staging.esportdessacres.fr/robots.txt`
 * rendait **404**. Tant que l'apex servait le site Hostinger c'était sans conséquence ; à partir
 * de la bascule, c'est la première chose qu'un moteur demande.
 *
 * 🔴 CE FICHIER NE DÉCIDE PAS DE L'INDEXATION DU STAGING, ET IL NE DOIT PAS ESSAYER.
 * La seule garde effective est l'en-tête HTTP `X-Robots-Tag`, posé par Traefik et piloté par
 * `VITRINE_ROBOTS` (`docker/.env`) : `"noindex, nofollow"` sur le staging, **vide** en production
 * — une valeur vide dans `customresponseheaders` *supprime* l'en-tête, elle ne le pose pas à vide.
 * Deux raisons de ne pas dupliquer la règle ici :
 *   ① un `robots.txt` n'interdit que le **parcours**, jamais l'**indexation** (une URL seulement
 *     interdite au crawl peut être indexée sur la foi de liens entrants, sans son contenu) ;
 *   ② dériver l'hôte au build pour choisir quoi écrire ferait une **seconde** source de vérité,
 *     qui se contredirait avec l'en-tête le jour où l'une des deux serait oubliée.
 * ⇒ Ce fichier dit ce qui n'a **jamais** à être parcouru, quel que soit l'hôte. L'en-tête dit
 *   si cet hôte s'indexe. Une question, une source.
 *
 * ⚠️ `/medias/**` RESTE AUTORISÉ : ce sont les photos **publiées** de la galerie (un brouillon
 * rend 404), donc les images du site lui-même — les interdire retirerait le site de la recherche
 * d'images sans rien protéger.
 */
export default function robots(): MetadataRoute.Robots {
  const base = baseDuSite();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // Le back-office. Le proxy est fail-closed dessous : un robot n'y verrait qu'une
        // redirection vers la connexion, mais autant ne pas l'y envoyer.
        "/admin",
        // La connexion et ses deux chemins hérités (Story 12.4) — rien à indexer, et une
        // page de connexion dans les résultats est un faux départ pour qui cherche l'asso.
        "/connexion",
        // Données personnelles (la page porte déjà `robots: noindex`, Story 12.1).
        "/profil",
        // Les incrustations OBS (Story 10.6) : hors charte, sans chrome, et elles se
        // rafraîchissent toutes les 10 s. Elles s'affichent dans un stream, pas dans Google.
        "/overlay",
        // Les routes d'API, dont `/api/auth/**`.
        "/api",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
