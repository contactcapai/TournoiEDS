import styles from "@/components/overlay/CadreOverlay/overlay.module.css";
import { LIBELLE_TABLEAU } from "@/lib/libelles-tournoi";
import { lettreDePoule } from "@/lib/tournoi/parcours";
import type { PoulePublique } from "@/lib/tournoi/poules-publiques";
import type { GroupeDeRencontres, PlacePublique } from "@/lib/tournoi/rencontres-publiques";

/** Les poules d'une phase, côte à côte : V, différence, et « qualifié » ÉCRIT. */
export function PoulesOverlay({
  poules,
  enEquipe,
}: {
  poules: readonly PoulePublique[];
  enEquipe: boolean;
}) {
  return (
    <div className={styles.grillePoules}>
      {poules.map((poule) => (
        <section className={styles.poule} key={poule.poule ?? 0}>
          {poule.poule !== null ? (
            <h2 className={styles.pouleTitre}>
              Poule {lettreDePoule(poule.poule)}
              {poule.terminee ? " — terminée" : null}
            </h2>
          ) : null}
          <table className={styles.tableau}>
            <thead>
              <tr>
                <th className={styles.colRang} scope="col">
                  #
                </th>
                <th className={styles.colNom} scope="col">
                  {enEquipe ? "Équipe" : "Joueur"}
                </th>
                <th className={styles.colNombre} scope="col">
                  V
                </th>
                <th className={styles.colNombre} scope="col">
                  Diff.
                </th>
              </tr>
            </thead>
            <tbody>
              {poule.lignes.map((ligne) => (
                <tr className={ligne.qualifie ? styles.ligneMarquee : styles.ligne} key={ligne.id}>
                  <td className={styles.colRang}>{ligne.rang}</td>
                  <td className={styles.colNom}>
                    {ligne.nom ?? "—"}
                    {ligne.qualifie ? <span className={styles.marque}>{enEquipe ? "qualifiée" : "qualifié"}</span> : null}
                  </td>
                  <td className={styles.colNombre}>{ligne.victoires}</td>
                  <td className={styles.colNombre}>
                    {ligne.difference > 0 ? `+${ligne.difference}` : ligne.difference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

const titreDuGroupe = (groupe: GroupeDeRencontres) =>
  [
    groupe.pool === null ? LIBELLE_TABLEAU[groupe.bracket] : `Poule ${lettreDePoule(groupe.pool)}`,
    `Tour ${groupe.round}`,
  ]
    .filter(Boolean)
    .join(" — ");

const resultat = (place: PlacePublique) =>
  place.forfait ? "forfait" : place.score !== null ? String(place.score) : null;

/** Un tour de tableau en liste plate (pas d'arbre, décision 14.3). */
function TourOverlay({ groupe, libelle }: { groupe: GroupeDeRencontres; libelle: string }) {
  return (
    <section>
      <h2 className={styles.pouleTitre}>
        {libelle} — {titreDuGroupe(groupe)}
      </h2>
      <ol className={styles.rencontresOverlay}>
        {groupe.rencontres.map((rencontre) => (
          <li className={styles.rencontreOverlay} key={rencontre.id}>
            {rencontre.places.map((place, rang) => (
              <span className={styles.rencontrePlace} key={place.position}>
                {rang > 0 ? (
                  <span className={styles.rencontreContre}>contre</span>
                ) : null}
                <span className={styles.rencontreNom}>{place.nom ?? "—"}</span>
                {resultat(place) !== null ? (
                  <span className={styles.rencontreScore}>{resultat(place)}</span>
                ) : null}
              </span>
            ))}
            {!rencontre.depouillee ? <span className={styles.rencontreAttente}>à jouer</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Le tour en cours (ou le dernier joué) et, s'il existe, le suivant. */
export function TableauOverlayDeTours({
  courant,
  suivant,
  termine,
}: {
  courant: GroupeDeRencontres;
  suivant: GroupeDeRencontres | null;
  termine: boolean;
}) {
  // Au tour en cours, une rencontre sans résultat et sans ses deux noms (exemption, attente) ne
  // dit rien à l'antenne : seules les jouées et les jouables restent.
  const lisibles = courant.rencontres.filter(
    (r) => r.depouillee || (!termine && r.places.every((p) => p.nom !== null)),
  );
  return (
    <div className={styles.tours}>
      <TourOverlay
        groupe={{ ...courant, rencontres: lisibles }}
        libelle={termine ? "Résultats" : "En cours"}
      />
      {suivant ? <TourOverlay groupe={suivant} libelle="À venir" /> : null}
    </div>
  );
}
