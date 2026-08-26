import type { LigneDeClassement } from "@/lib/tournoi/classement";
import styles from "@/components/overlay/CadreOverlay/overlay.module.css";

/**
 * Le classement tel que le stream le montre (Story 10.6).
 *
 * 🔴 **IL NE CALCULE RIEN.** Les lignes arrivent de `classer()` / `agregerParEngage()`, déjà
 * filtrées par `classementPubliable` — les mêmes que la fiche publique (14.2). Recalculer un
 * total ici donnerait un jour un overlay qui contredit le site **sur le même tournoi, au même
 * instant**, et c'est le pire endroit pour ça : l'un des deux passe à l'antenne.
 *
 * 🔴 **LES COLONNES SONT CELLES DE L'ANCIEN `RankingTable`** (README § Overlays : *« Place/Pts
 * par round, Moy, Top 1/4, Dern. »*), traduites dans le vocabulaire du nouveau moteur :
 * `moitieHaute` remplace « Top 4 » parce que la moitié haute d'un lobby de 6 est le top 3 —
 * compter les places 1 à 4 y récompenserait les deux tiers du plateau (10.3).
 *
 * ⚠️ **`marque` NE PORTE PAS DE COULEUR PROPRE** : c'est la même ligne, mise en avant. Deux
 * gestes voisins prennent deux formes, jamais deux couleurs (principe ② de l'Epic 13) — et
 * l'or reste l'accent.
 */
export function TableauOverlay({
  lignes,
  marques,
  colonneDeSeuil,
}: {
  lignes: readonly LigneDeClassement[];
  /** Les engagés à mettre en avant — le vainqueur, ou ceux en position de gagner. */
  marques?: ReadonlySet<string>;
  /**
   * Le seuil de la finale, quand on est dans son espace de points : la colonne devient une
   * **progression vers la victoire**. `null` en qualifications, où aucun seuil n'a de sens.
   */
  colonneDeSeuil?: number | null;
}) {
  const seuil = colonneDeSeuil ?? null;

  return (
    <table className={styles.tableau}>
      <thead>
        <tr>
          <th className={styles.colRang} scope="col">
            #
          </th>
          <th className={styles.colNom} scope="col">
            Joueur
          </th>
          <th className={styles.colNombre} scope="col">
            Pts
          </th>
          {seuil === null ? (
            <>
              <th className={styles.colNombre} scope="col">
                Moy.
              </th>
              <th className={styles.colNombre} scope="col">
                Top 1
              </th>
              <th className={styles.colNombre} scope="col">
                Moitié haute
              </th>
            </>
          ) : (
            <th className={styles.colProgression} scope="col">
              Progression
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {lignes.map((ligne) => {
          const marquee = marques?.has(ligne.id) ?? false;
          // ⚠️ BORNÉ À 100 : un finaliste peut dépasser le seuil sans avoir gagné (c'est même
          // tout le sens de la règle « 20 points PUIS un top 1 »), et une barre à 140 % sortirait
          // de sa boîte à l'écran.
          const progression =
            seuil === null ? 0 : Math.min(100, (ligne.stats.total / seuil) * 100);

          return (
            <tr className={marquee ? styles.ligneMarquee : styles.ligne} key={ligne.id}>
              <td className={styles.colRang}>{ligne.rang}</td>
              <td className={styles.colNom}>
                {ligne.nom}
                {/* ⚠️ LE MOT EST ÉCRIT, la mise en avant ne le remplace pas (a11y AA, et un
                    flux compressé écrase les nuances bien avant les mots). */}
                {marquee ? <span className={styles.marque}>peut gagner</span> : null}
              </td>
              <td className={styles.colNombre}>{ligne.stats.total}</td>
              {seuil === null ? (
                <>
                  {/* Une décimale : « 4,3 » se lit à l'antenne, « 4,333333 » non. */}
                  <td className={styles.colNombre}>
                    {ligne.stats.moyenne.toFixed(1).replace(".", ",")}
                  </td>
                  <td className={styles.colNombre}>{ligne.stats.premieres}</td>
                  <td className={styles.colNombre}>{ligne.stats.moitieHaute}</td>
                </>
              ) : (
                <td className={styles.colProgression}>
                  <span className={styles.barre}>
                    <span className={styles.jauge} style={{ width: `${progression}%` }} />
                  </span>
                  <span className={styles.ratio}>
                    {ligne.stats.total}/{seuil}
                  </span>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
