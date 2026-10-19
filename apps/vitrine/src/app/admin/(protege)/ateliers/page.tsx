import type { Metadata } from "next";
import Link from "next/link";

import { AtelierActions } from "@/components/admin/AtelierActions/AtelierActions";
import { TitrePage } from "@/components/admin/TitrePage/TitrePage";
import { LIBELLES_FAMILLE } from "@/lib/familles-ateliers";
import { WORKSHOP_FAMILIES } from "@/lib/schemas/workshop";
import { cleanText } from "@/lib/text";
import { exigerRolePage } from "@/server/auth/guard";
import { getWorkshopsForAdmin, type AdminWorkshop } from "@/server/db/queries/workshops";
import styles from "@/styles/admin-page.module.css";
import propre from "./ateliers.module.css";

// Liste des ateliers du back-office (Story 6.9) — Server Component pur.
//
// 🔴 CETTE PAGE PORTE SA PROPRE GARDE, ET CE N'EST PAS UNE REDONDANCE — DÉFAUT MESURÉ EN
// STORY 6.1. Une garde placée dans un `layout` N'EMPÊCHE PAS la `page` enfant de s'exécuter :
// Next rend l'arbre de segments EN PARALLÈLE, et le `redirect()` du layout n'arrête pas un
// rendu déjà commencé ailleurs.
//
// ⚠️ Cette page rend des lignes NON PUBLIÉES.

export const metadata: Metadata = {
  title: "Ateliers",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Borne EXPLICITE, jamais de lecture non bornée : une page dont le temps de rendu dépend du
 * nombre d'entrées est un défaut qui n'apparaîtrait qu'une fois la base remplie — c'est-à-dire
 * en production, chez quelqu'un d'autre. 200 est très au-delà de l'offre d'une association
 * (FR10 en annonce « environ 8 ») tout en restant borné. « Généreux » n'est pas « non borné ».
 */
const ATELIERS_MAX = 200;

function LigneAtelier({
  atelier,
  ordre,
  position,
}: {
  atelier: AdminWorkshop;
  ordre: readonly string[];
  position: number;
}) {
  // `cleanText` : filet du rendu contre une écriture qui contournerait Zod et les `CHECK`
  // (`UPDATE` direct, restauration). Jamais un fragment vide à l'écran.
  const resume = cleanText(atelier.summary);
  const publicVise = cleanText(atelier.audience);

  return (
    <li className={styles.ligne}>
      <div className={styles.ligneCorps}>
        <p className={styles.ligneDate}>Position {position + 1}</p>
        <p className={styles.ligneTitre}>{atelier.title}</p>
        {resume ? <p className={styles.ligneLieu}>{resume}</p> : null}
        {publicVise ? <p className={propre.publicVise}>Public : {publicVise}</p> : null}

        <span
          className={`${styles.etat} ${atelier.isPublished ? styles.etatPublie : styles.etatBrouillon}`}
        >
          {atelier.isPublished ? "Publié" : "Brouillon"}
        </span>
      </div>

      <div className={styles.ligneActions}>
        <Link className={styles.lienPrincipal} href={`/admin/ateliers/${atelier.id}`}>
          Modifier
        </Link>
        <AtelierActions
          id={atelier.id}
          intitule={atelier.title}
          isPublished={atelier.isPublished}
          famille={atelier.family}
          ordre={ordre}
          position={position}
        />
      </div>
    </li>
  );
}

export default async function AdminAteliersPage() {
  await exigerRolePage("admin_site");

  const ateliers = await getWorkshopsForAdmin(ATELIERS_MAX);

  // 🔴 GROUPÉ PAR FAMILLE, DANS L'ORDRE DE `WORKSHOP_FAMILIES` — c'est-à-dire celui de l'enum
  // Postgres, donc celui du `ORDER BY family` de la requête publique. Grouper n'est pas un
  // confort d'affichage : l'ordre manuel ne s'applique QU'À L'INTÉRIEUR d'une famille (l'enum
  // tranche avant `sort_order`), donc une liste à plat laisserait croire qu'on peut monter un
  // atelier au-dessus d'une autre famille.
  const groupes = WORKSHOP_FAMILIES.map((family) => ({
    family,
    entrees: ateliers.filter((a) => a.family === family),
  }));

  return (
    <>
      <TitrePage
        info={[
          <>
            L&rsquo;offre d&rsquo;animations présentée sur la page <strong>Animations</strong>.
            Rien n&rsquo;apparaît sur le site tant que ce n&rsquo;est pas publié — et le
            changement se voit au rechargement suivant.
          </>,
          "Une famille sans atelier publié garde simplement sa description, sans liste ni case vide — même sans aucun atelier publié, la page Animations reste entière : c'est son état normal, pas une page cassée.",
          <>
            L&rsquo;ordre se règle <strong>à l&rsquo;intérieur d&rsquo;une famille</strong>. Les
            familles, elles, se suivent toujours dans le même ordre sur la page Animations —
            ateliers et tournois, sensibilisation, puis animations sur événement.
          </>,
        ]}
      >
        Ateliers
      </TitrePage>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/ateliers/nouveau">
          Ajouter un atelier
        </Link>
        <Link className={styles.lien} href="/admin/ateliers/apercu">
          Voir le rendu du catalogue
        </Link>
      </div>

      {ateliers.length > 0 ? (
        groupes.map(({ family, entrees }) => {
          const ordre = entrees.map((a) => a.id);
          return (
            <section
              key={family}
              className={styles.section}
              aria-labelledby={`admin-ateliers-${family}`}
            >
              <h2 className={propre.famille} id={`admin-ateliers-${family}`}>
                {LIBELLES_FAMILLE[family]}
              </h2>
              {entrees.length > 0 ? (
                <ul className={styles.liste}>
                  {entrees.map((atelier, position) => (
                    <LigneAtelier
                      key={atelier.id}
                      atelier={atelier}
                      ordre={ordre}
                      position={position}
                    />
                  ))}
                </ul>
              ) : (
                /* ⚠️ Une famille vide est nommée ici mais n'a AUCUNE trace côté public : sa
                   description reste, la liste n'apparaît pas. Le dire évite qu'on croie à un
                   trou sur le site. */
                <p className={propre.familleVide}>
                  Aucun atelier dans cette famille. Sur la page Animations, elle garde sa
                  description — il n&rsquo;y aura ni liste, ni case vide.
                </p>
              )}
            </section>
          );
        })
      ) : (
        /* ⚠️ Un état vide qui dirait « aucun atelier » se lirait comme une panne. Celui-ci dit
           quoi faire — même doctrine que les états vides de la home (3.2), d'/agenda (3.3),
           du tableau de bord (6.1), de l'agenda (6.3), de la galerie (6.4) et des
           partenaires (6.5). */
        <p className={styles.vide}>
          Aucun atelier pour l&rsquo;instant, et la page Animations fonctionne très bien
          ainsi : elle présente les trois familles et explique que le format se cale avec la
          structure qui vous sollicite. Ajoutez un atelier quand vous voulez en nommer un
          précisément — vous pourrez voir le rendu avant de publier.
        </p>
      )}
    </>
  );
}
