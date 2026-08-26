"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { basculerMaVenue } from "@/server/actions/venues";
import styles from "./BoutonVenue.module.css";

/**
 * « J'y serai » — le seul geste interactif de l'agenda (Story 12.2).
 *
 * 🔴 **`'use client'` SUR CE SEUL BOUTON.** `EventList` / `EventRow` et `NextEventCard` sont des
 * Server Components **purs** depuis la 3.2, et ils le restent : la frontière client s'arrête à
 * ce bouton. Remonter l'interactivité d'un cran ferait basculer toute la liste — et sa
 * sémantique de liste, que l'en-tête d'`EventList` explique avoir eu du mal à obtenir.
 *
 * 🔴 **UN ANONYME VOIT LE BOUTON, ET IL MÈNE À LA CONNEXION** (arbitrage de Brice, 2026-08-26).
 * C'est la première vraie raison d'avoir un compte sur ce site : le cacher reviendrait à ne le
 * montrer qu'à ceux qui n'en ont plus besoin. ⚠️ C'est un `<a>`, pas un bouton désactivé — un
 * bouton qui ne fait rien est « une porte sans pièce », défaut déjà payé deux fois ici.
 * ⚠️ Le retour passe par `?next=`, borné par `lib/auth/retour.ts` : sans lui, on se connecterait
 * pour annoncer sa venue et l'on atterrirait sur le back-office.
 */
export function BoutonVenue({
  evenementId,
  jyVais,
  connecte,
}: {
  evenementId: string;
  jyVais: boolean;
  connecte: boolean;
}) {
  const chemin = usePathname();
  const [enTransition, demarrer] = useTransition();
  const [etat, setEtat] = useState(jyVais);
  const [erreur, setErreur] = useState(false);

  if (!connecte) {
    return (
      <Link
        className={styles.bouton}
        href={`/admin/login?next=${encodeURIComponent(chemin)}`}
      >
        J&rsquo;y serai
      </Link>
    );
  }

  const basculer = () => {
    demarrer(async () => {
      setErreur(false);
      try {
        const resultat = await basculerMaVenue(evenementId);
        if (!resultat.ok) {
          setErreur(true);
          return;
        }
        setEtat(resultat.data.jyVais);
      } catch {
        setErreur(true);
      }
    });
  };

  return (
    <button
      // ⚠️ `aria-pressed` PLUTÔT QU'UN SIMPLE LIBELLÉ : c'est un interrupteur, et un lecteur
      // d'écran doit entendre l'ÉTAT, pas seulement le mot. Sans lui, « J'y serai » et « J'y
      // serai » se ressemblent trop pour qu'on sache si le clic a pris.
      aria-pressed={etat}
      className={etat ? styles.boutonActif : styles.bouton}
      disabled={enTransition}
      onClick={basculer}
      type="button"
    >
      {erreur ? "Réessayer" : etat ? "J’y serai ✓" : "J’y serai"}
    </button>
  );
}
