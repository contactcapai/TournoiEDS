import type { Metadata } from "next";
import Link from "next/link";

import { formatLongDate } from "@/lib/date-paris";
import { trousDu } from "@/lib/reglement";
import { exigerRolePage } from "@/server/auth/guard";
import { getModelesReglement } from "@/server/db/queries/reglements";
import styles from "@/styles/admin-page.module.css";

// Les modèles de règlement. ⚠️ Rangés sous `/admin/tournois` : la section Tournois et son rôle
// `admin_tournoi` les couvrent, sans entrée de menu de plus.

export const metadata: Metadata = {
  title: "Modèles de règlement",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ModelesReglementPage() {
  await exigerRolePage("admin_tournoi");

  const modeles = await getModelesReglement();

  return (
    <>
      <h1 className={styles.titre}>Modèles de règlement</h1>
      <p className={styles.chapo}>
        Un modèle se choisit dans l&rsquo;onglet « Le règlement » d&rsquo;un tournoi : la
        fiche et le déroulé remplissent ce qu&rsquo;ils savent, une fenêtre demande le reste, et
        le texte obtenu est{" "}
        <strong>copié</strong> dans le tournoi. Modifier un modèle ne change donc pas le
        règlement des tournois déjà créés.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/tournois/reglements/nouveau">
          Ajouter un modèle
        </Link>
        <Link className={styles.lien} href="/admin/tournois">
          Retour aux tournois
        </Link>
      </div>

      {modeles.length === 0 ? (
        <p className={styles.vide}>Aucun modèle pour l&rsquo;instant.</p>
      ) : (
        <ul className={styles.liste}>
          {modeles.map((modele) => {
            const trous = trousDu(modele.body).length;
            return (
              <li key={modele.id} className={styles.ligne}>
                <div className={styles.ligneCorps}>
                  <p className={styles.ligneTitre}>{modele.name}</p>
                  <p className={styles.ligneLieu}>
                    {trous === 0
                      ? "Aucune information à compléter"
                      : `${trous} information${trous > 1 ? "s" : ""} à compléter`}{" "}
                    · modifié le {formatLongDate(modele.updatedAt)}
                  </p>
                </div>
                <div className={styles.ligneActions}>
                  <Link className={styles.lien} href={`/admin/tournois/reglements/${modele.id}`}>
                    Modifier
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
