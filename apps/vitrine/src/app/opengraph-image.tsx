import { ImageResponse } from "next/og";
import { getPhotoDePartage } from "@/server/db/queries/photos";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * L'IMAGE DE PARTAGE (Story 7.3) — IL N'Y EN AVAIT AUCUNE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 MESURÉ LE 2026-09-01 : `openGraph` du layout ne portait que `title` et `description`.
 * Un lien du site collé dans **Discord** — c'est-à-dire là où vit la communauté — n'affichait
 * donc **aucune image**. Ce n'était pas une finition : c'est le premier contact que la
 * plupart des gens ont avec le site, avant même de cliquer.
 *
 * 🔴 GÉNÉRÉE, PAS VERSIONNÉE, ET C'EST CE QUI LA REND VIVANTE : elle suit la photo choisie
 * dans le back-office. Un fichier `og.png` figé dans `public/` aurait demandé un dev à
 * chaque changement — exactement ce que la 7.3 corrige pour le hero.
 *
 * ⚠️ **LE REPLI N'EST PAS UNE IMAGE VIDE** : sans photo choisie, on rend la marque sur le
 * fond de la charte. Une carte de partage sans image est *pire* qu'une carte sobre — les
 * réseaux affichent alors un bloc gris, ou rien. Il n'y a donc aucun état où le partage
 * n'a pas d'image.
 *
 * ⚠️ **`alt` OBLIGATOIRE** : Next l'exporte comme attribut de la balise `og:image:alt`.
 * Le taire priverait de description tout lecteur d'écran qui rencontre la carte.
 */
export const alt = "Esport des Sacres — association esport à Reims";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * 🔴 `force-dynamic` : cette image LIT LA BASE. Sans elle, Next tenterait de la générer au
 * build — c'est-à-dire sans `DATABASE_URL` en CI, et le build casserait. C'est exactement
 * le défaut que les deux pages légales ont payé le 2026-09-01, trouvé par la CI et par elle
 * seule ; on ne le refait pas.
 */
export const dynamic = "force-dynamic";

export default async function Image() {
  const photo = await getPhotoDePartage();

  // 🔴 URL ABSOLUE OBLIGATOIRE : le moteur de rendu va chercher l'image par le réseau, il
  // ne connaît pas l'origine de la page. Un chemin relatif ne serait pas résolu, et la
  // carte partirait sans son fond — sans erreur, puisque le rendu, lui, réussit.
  // ⚠️ `NEXT_PUBLIC_SITE_URL` est inlinée au build (cf. `Dockerfile`) et suit donc la
  // bascule DNS toute seule, comme la cible des redirections héritées.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://esportdessacres.fr";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          // Les couleurs sont EN DUR ici, et c'est la seule exception admise : ce rendu
          // n'a pas de CSS, donc pas de `var()`. Ce sont les valeurs de `--ink` et
          // `--gold`. ⚠️ Si la charte change, ce fichier est à reprendre à la main — il
          // n'y a pas de token à suivre.
          backgroundColor: "#141230",
        }}
      >
        {photo === null ? null : (
          // `next/image` n'existe pas dans un rendu Satori : `ImageResponse` ne connaît
          // que `<img>`. La règle ne s'applique donc pas ici — mais elle ne le sait pas.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${base}/medias/${photo.filename}`}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              // Le point focal, ici aussi : c'est le troisième cadre qu'il sert, et il
              // n'a fallu écrire aucune variante d'image pour ça.
              objectPosition: `${photo.focalX}% ${photo.focalY}%`,
            }}
          />
        )}

        {/* Le voile : même rôle que sur la bande citation — le nom doit rester lisible
            sur une photo dont on ne connaît pas la luminosité. */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(20, 18, 48, 0.55)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
          }}
        >
          <div style={{ fontSize: 86, color: "#f3efe3", letterSpacing: -1 }}>
            Esport des Sacres
          </div>
          <div style={{ fontSize: 34, color: "#dab265", marginTop: 12 }}>
            Le jeu vidéo qui rassemble, à Reims
          </div>
        </div>
      </div>
    ),
    size,
  );
}
