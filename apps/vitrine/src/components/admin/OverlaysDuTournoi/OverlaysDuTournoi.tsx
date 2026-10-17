import { baseDuSite } from "@/lib/site-url";
import admin from "@/styles/admin-page.module.css";
import { BoutonCopier } from "./BoutonCopier";
import styles from "./OverlaysDuTournoi.module.css";

/**
 * Les adresses des overlays OBS d'un tournoi. Elles dérivent du slug : elles existent dès la
 * création, et répondent une fois le tournoi publié (un brouillon rend 404).
 */
export function OverlaysDuTournoi({
  slug,
  publie,
  aUneFinale,
}: {
  slug: string;
  publie: boolean;
  aUneFinale: boolean;
}) {
  const base = `${baseDuSite()}/overlay/${slug}`;
  const adresses = [
    { libelle: "l'overlay", url: base },
    { libelle: "l'overlay sur fond transparent", url: `${base}?transparent=1` },
    ...(aUneFinale
      ? [
          { libelle: "l'overlay de la finale", url: `${base}/finale` },
          { libelle: "l'overlay de la finale sur fond transparent", url: `${base}/finale?transparent=1` },
        ]
      : []),
  ];

  return (
    <section className={admin.section} aria-labelledby="overlays-titre">
      <h2 id="overlays-titre" className={admin.sectionTitre}>
        Overlays pour le stream
      </h2>
      <p className={styles.aide}>
        À coller comme source « Navigateur » dans OBS (1920×1080). Une seule adresse suit le
        format de la phase en cours : classement aux points, poules ou tableau.
        {publie ? null : (
          <>
            {" "}
            <strong>Disponibles une fois le tournoi publié</strong> — d&rsquo;ici là, elles
            répondent « page introuvable ».
          </>
        )}
      </p>
      <ul className={styles.liste}>
        {adresses.map((adresse) => (
          <li className={styles.ligne} key={adresse.url}>
            <code className={styles.url}>{adresse.url}</code>
            <BoutonCopier texte={adresse.url} libelle={adresse.libelle} />
          </li>
        ))}
      </ul>
    </section>
  );
}
