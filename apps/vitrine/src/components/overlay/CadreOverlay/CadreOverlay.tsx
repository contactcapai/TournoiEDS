import type { ReactNode } from "react";

import { RafraichirAuto } from "@/components/overlay/RafraichirAuto/RafraichirAuto";
import styles from "./overlay.module.css";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LE CADRE COMMUN AUX DEUX OVERLAYS OBS (Story 10.6)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **HORS CHARTE DU SITE, ET C'EST L'ARBITRAGE A6** : fond transparent au besoin, taille
 * fixe, lisibilité **à la diffusion**. Les tailles sont donc en **px** et volontairement
 * énormes — une incrustation se lit sur un flux compressé, souvent redimensionné, parfois sur
 * un téléphone. Les **couleurs**, elles, restent celles de la charte : c'est la même
 * association à l'écran, et rien n'obligeait à en changer.
 *
 * 🔴 **PAS DE CHROME** (ni en-tête, ni pied, ni skip-link) : ces routes vivent **hors du groupe
 * `(public)`**, exactement comme les routes d'admin. C'est ce que l'ancienne app obtenait en
 * plaçant ses overlays hors de son `<Layout>`.
 *
 * 🔴 **LE TÉMOIN DE FRAÎCHEUR EST OBLIGATOIRE, ET IL PAIE LE CHOIX DU RAFRAÎCHISSEMENT.**
 * L'ancienne app affichait `isConnected`, un témoin de socket. En passant au rafraîchissement
 * périodique, on hérite d'un risque précis : si le site tombe, la requête suivante échoue
 * **en silence** et l'overlay continue d'afficher un classement figé qui **a l'air à jour** —
 * une info fausse pendant un direct, sans que rien ne le montre. ⇒ On écrit **l'heure du rendu
 * serveur** : si elle cesse d'avancer, le caster le voit.
 * ⚠️ C'est bien l'heure du **serveur**, donc de la donnée — un compteur côté client dirait
 * seulement qu'on a *demandé*, ce qui est précisément ce qu'on ne veut pas savoir.
 *
 * ⚠️ **LA TRANSPARENCE SE POSE SUR `html` ET `body`, PAS SEULEMENT ICI.** `globals.css` pose
 * `body { background: var(--navy-deep) }` : un cadre transparent laisserait voir ce fond-là,
 * et le chroma key n'aurait rien à découper. La règle est rendue **côté serveur** dans un
 * `<style>`, parce que la valeur vient de l'URL et qu'aucun JavaScript n'a à en décider.
 */
export function CadreOverlay({
  transparent,
  secondesDeRafraichissement,
  heureDuRendu,
  titre,
  sousTitre,
  children,
}: {
  transparent: boolean;
  secondesDeRafraichissement: number;
  /** L'heure du rendu SERVEUR, déjà formatée par la page — jamais lue ici. */
  heureDuRendu: string;
  titre: string;
  sousTitre: string | null;
  children: ReactNode;
}) {
  return (
    <>
      {transparent ? (
        // ⚠️ `dangerouslySetInnerHTML` sur un LITTÉRAL CONSTANT — aucune donnée n'y entre, donc
        // aucune injection possible. C'est la seule façon d'écrire une règle CSS globale depuis
        // un Server Component sans passer par un fichier chargé pour toutes les routes.
        <style
          dangerouslySetInnerHTML={{
            __html: "html,body{background:transparent !important}",
          }}
        />
      ) : null}

      <RafraichirAuto secondes={secondesDeRafraichissement} />

      <main className={transparent ? styles.cadreTransparent : styles.cadre}>
        <header className={styles.tete}>
          <h1 className={styles.titre}>{titre}</h1>
          {sousTitre ? <p className={styles.sousTitre}>{sousTitre}</p> : null}
        </header>

        {children}

        {/* ⚠️ DISCRET MAIS PRÉSENT : il ne doit pas manger l'image, et il ne doit pas
            disparaître. C'est le seul élément de la page qui dise si ce qu'on regarde est
            encore vivant. */}
        <p className={styles.fraicheur}>Mis à jour à {heureDuRendu}</p>
      </main>
    </>
  );
}
