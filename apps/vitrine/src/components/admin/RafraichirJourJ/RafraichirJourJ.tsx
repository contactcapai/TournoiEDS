"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Le jour J se relit seul (~15 s) pour montrer ce que les collègues ont saisi — patron de
 * `RafraichirAuto` (overlays).
 *
 * 🔴 JAMAIS PENDANT QU'UN BÉNÉVOLE TAPE : on saute le cycle si un champ du bloc a le focus, ou si
 * une valeur diffère de celle affichée par le serveur (modifiée, pas encore enregistrée).
 */
export function RafraichirJourJ({ secondes, children }: { secondes: number; children: ReactNode }) {
  const router = useRouter();
  const bloc = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const minuterie = setInterval(() => {
      const racine = bloc.current;
      if (!racine || document.hidden) return;
      const actif = document.activeElement;
      if (actif && racine.contains(actif) && actif.matches("input, select, textarea")) return;
      const modifie = [...racine.querySelectorAll("input")].some((champ) =>
        champ.type === "checkbox" || champ.type === "radio"
          ? champ.checked !== champ.defaultChecked
          : champ.type !== "hidden" && champ.value !== champ.defaultValue,
      );
      if (modifie) return;
      router.refresh();
    }, secondes * 1000);
    return () => clearInterval(minuterie);
  }, [router, secondes]);

  return <div ref={bloc}>{children}</div>;
}
