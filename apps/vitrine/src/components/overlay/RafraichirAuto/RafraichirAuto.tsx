"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * L'OVERLAY SE MET À JOUR TOUT SEUL (Story 10.6)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **IL REMPLACE LE SOCKET.IO DE L'ANCIENNE APP, ET C'EST UN ARBITRAGE DE BRICE
 * (2026-08-26).** L'arbitrage **A13** (2026-08-13) prévoyait *« un service de diffusion
 * (socket) pour le direct et les overlays »* — il est **antérieur au recalibrage du 15 août**.
 * Un socket, c'est un état serveur, sa reconnexion et sa surveillance, pour gagner quelques
 * secondes sur un classement qui ne bouge **qu'à la fin d'une manche**, c'est-à-dire toutes les
 * quinze minutes environ. ⇒ La page redemande ses données, et rien de plus.
 *
 * 🔴 **`router.refresh()` ET NON `location.reload()`** — la différence est visible à l'écran.
 * `reload()` repeint la page entière : sur un direct, cela fait **clignoter l'incrustation** à
 * chaque cycle. `refresh()` redemande le rendu serveur et réconcilie le DOM : les lignes qui
 * n'ont pas changé ne bougent pas.
 * ⚠️ Il exige que la page soit `force-dynamic` — sans quoi il resservirait le même rendu mis en
 * cache, indéfiniment et **sans erreur**.
 *
 * ⚠️ **CE COMPOSANT NE REND RIEN**, et c'est voulu : le témoin de fraîcheur est **l'heure du
 * rendu serveur**, écrite par la page. Un témoin calculé ici dirait « j'ai demandé », pas
 * « j'ai reçu » — voir le bloc de `CadreOverlay`.
 */
export function RafraichirAuto({ secondes }: { secondes: number }) {
  const router = useRouter();

  useEffect(() => {
    const minuterie = setInterval(() => router.refresh(), secondes * 1000);
    return () => clearInterval(minuterie);
  }, [router, secondes]);

  return null;
}
