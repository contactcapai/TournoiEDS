import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PartenaireActions } from "@/components/admin/PartenaireActions/PartenaireActions";
import { estLogoDuVolume, sourceLogo } from "@/lib/logos";
import { PARTNER_CATEGORIES, type PartnerCategory } from "@/lib/schemas/partner";
import { cleanText } from "@/lib/text";
import { exigerRolePage } from "@/server/auth/guard";
import { getPartnersForAdmin, type AdminPartner } from "@/server/db/queries/partners";
import styles from "@/styles/admin-page.module.css";
import propre from "./partenaires.module.css";

// Liste des partenaires du back-office (Story 6.5) — Server Component pur.
//
// 🔴 CETTE PAGE PORTE SA PROPRE GARDE, ET CE N'EST PAS UNE REDONDANCE — DÉFAUT MESURÉ EN
// STORY 6.1. Une garde placée dans un `layout` N'EMPÊCHE PAS la `page` enfant de s'exécuter :
// Next rend l'arbre de segments EN PARALLÈLE, et le `redirect()` du layout n'arrête pas un
// rendu déjà commencé ailleurs.
//
// ⚠️ Cette page rend des lignes NON PUBLIÉES — et en sert les logos (via
// `/admin/medias/logos/[filename]`, gardée elle aussi).

export const metadata: Metadata = {
  title: "Partenaires",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Borne EXPLICITE, jamais de lecture non bornée : une page dont le temps de rendu dépend du
 * nombre d'entrées est un défaut qui n'apparaîtrait qu'une fois la base remplie — c'est-à-dire
 * en production, chez quelqu'un d'autre. 200 est très au-delà du réseau d'une association
 * (11 aujourd'hui) tout en restant borné. « Généreux » n'est pas « non borné ».
 */
const PARTENAIRES_MAX = 200;

/**
 * Libellés PUBLICS des quatre catégories.
 *
 * ⚠️ **VOLONTAIREMENT LES MÊMES QUE `/partenaires`** (Story 4.2) : cet écran doit nommer les
 * murs comme le visiteur les voit, sinon « Nos participations » d'un côté et « Participations »
 * de l'autre feraient douter qu'il s'agisse du même mur.
 * 🔴 `Record<PartnerCategory, string>` EXHAUSTIF : ajouter une valeur à l'enum sans lui donner
 * de libellé CASSE LE TYPECHECK — un objet indexé librement rendrait un titre anonyme.
 */
const LIBELLES: Record<PartnerCategory, string> = {
  sponsor: "Nos sponsors",
  partenaire: "Nos partenaires",
  soutien: "Ils nous soutiennent",
  participation: "Nos participations",
};

function LignePartenaire({
  partenaire,
  ordre,
  position,
  dansLeBandeau,
}: {
  partenaire: AdminPartner;
  ordre: readonly string[];
  position: number;
  dansLeBandeau: boolean;
}) {
  const description = cleanText(partenaire.description);

  return (
    <li className={styles.ligne}>
      {/* 🔴 `unoptimized` — L'OPTIMISEUR NE PEUT PAS LIRE UNE ROUTE GARDÉE. `/_next/image`
          requête depuis le serveur, sans cookie de session : il reçoit le `307 → /admin/login`
          de la garde, pas une image. Mesuré au gate visuel de la 6.4, où AUCUNE vignette ne
          s'affichait. `sourceLogo(..., true)` porte les deux faits à la fois (d'où vient
          l'image ET qu'elle ne doit pas être optimisée) — voir `lib/logos.ts`. */}
      <div className={propre.vignette}>
        {partenaire.logo !== null ? (
          <span className={propre.vignetteZone}>
            <Image
              src={sourceLogo(partenaire.logo, true)}
              // `alt=""` : le nom du partenaire est écrit juste à côté, en toutes lettres.
              // Le répéter ici ferait dire deux fois la même chose au lecteur d'écran.
              alt=""
              fill
              sizes="150px"
              className={propre.vignetteImage}
              unoptimized
            />
          </span>
        ) : (
          /* ⚠️ « Pas de logo » N'EST PAS UN VIDE : c'est l'état de 7 entrées sur 11, et il a
             une conséquence (absent du bandeau de l'accueil) que la ligne dit plus bas. */
          <span className={`${propre.vignetteZone} ${propre.sansLogo}`}>Pas de logo</span>
        )}
      </div>

      <div className={styles.ligneCorps}>
        <p className={styles.ligneDate}>Position {position + 1}</p>
        <p className={styles.ligneTitre}>{partenaire.name}</p>
        {description ? <p className={styles.ligneLieu}>{description}</p> : null}
        {partenaire.link ? <p className={propre.fichier}>{partenaire.link}</p> : null}

        <span
          className={`${styles.etat} ${partenaire.isPublished ? styles.etatPublie : styles.etatBrouillon}`}
        >
          {partenaire.isPublished ? "Publié" : "Brouillon"}
        </span>
        {dansLeBandeau ? (
          <span className={propre.accueil}>Dans le bandeau de l&rsquo;accueil</span>
        ) : null}
      </div>

      <div className={styles.ligneActions}>
        <Link className={styles.lien} href={`/admin/partenaires/${partenaire.id}`}>
          Modifier
        </Link>
        <PartenaireActions
          id={partenaire.id}
          nom={partenaire.name}
          isPublished={partenaire.isPublished}
          categorie={partenaire.category}
          ordre={ordre}
          position={position}
          logoSurLeVolume={estLogoDuVolume(partenaire.logo)}
        />
      </div>
    </li>
  );
}

export default async function AdminPartenairesPage() {
  await exigerRolePage("admin_site");

  const partenaires = await getPartnersForAdmin(PARTENAIRES_MAX);

  // 🔴 GROUPÉ PAR CATÉGORIE, DANS L'ORDRE DE `PARTNER_CATEGORIES` — c'est-à-dire celui de
  // l'enum Postgres, donc celui du `ORDER BY category` des requêtes publiques. Grouper n'est
  // pas un confort d'affichage : l'ordre manuel ne s'applique QU'À L'INTÉRIEUR d'une
  // catégorie (l'enum tranche avant `sort_order`), donc une liste à plat laisserait croire
  // qu'on peut monter un sponsor au-dessus d'un partenaire.
  const groupes = PARTNER_CATEGORIES.map((category) => ({
    category,
    entrees: partenaires.filter((p) => p.category === category),
  }));

  // Ce qui entre réellement dans le bandeau de l'accueil : publié ET avec un logo.
  const dansLeBandeau = new Set(
    partenaires.filter((p) => p.isPublished && p.logo !== null).map((p) => p.id),
  );

  return (
    <>
      <h1 className={styles.titre}>Partenaires</h1>
      <p className={styles.chapo}>
        Les sponsors, partenaires, soutiens et participations. Rien n&rsquo;apparaît sur le site
        tant que ce n&rsquo;est pas publié — et le changement se voit au rechargement suivant.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/partenaires/nouveau">
          Ajouter un partenaire
        </Link>
        <Link className={styles.lien} href="/admin/partenaires/apercu">
          Voir le rendu des murs
        </Link>
      </div>

      {/* 🔴 CE QU'UN GESTE DÉCIDE AILLEURS, ÉCRIT EN TOUTES LETTRES (AC7). Personne ne devine
          qu'enlever un logo fait disparaître une entrée de la page d'accueil — ni, à la
          limite, qu'enlever le DERNIER fait disparaître une section entière. */}
      <p className={styles.mention} role="note">
        Le <strong>bandeau de l&rsquo;accueil</strong> ne montre que les partenaires{" "}
        <strong>publiés qui ont un logo</strong> — {dansLeBandeau.size} aujourd&rsquo;hui.
        {dansLeBandeau.size === 0
          ? " Il n'y en a aucun : la bande « Reconnus, soutenus, connectés » n'apparaît donc pas du tout sur l'accueil."
          : dansLeBandeau.size === 1
            ? " S'il n'en reste aucun, la bande « Reconnus, soutenus, connectés » disparaît ENTIÈREMENT de l'accueil — titre compris."
            : " S'il n'en restait aucun, la bande « Reconnus, soutenus, connectés » disparaîtrait ENTIÈREMENT de l'accueil — titre compris."}{" "}
        La page <strong>Partenaires</strong>, elle, affiche toutes les entrées publiées : celles
        sans logo y montrent leur nom dans la tuile.
      </p>

      {/* ⚠️ FAIT À DIRE, PAS À TAIRE : l'ordre manuel ne franchit jamais une catégorie. Sans
          cette phrase, « monter » se lit comme un classement global et les flèches semblent
          ne rien faire quand on atteint le haut d'un groupe. */}
      <p className={styles.mention} role="note">
        L&rsquo;ordre se règle <strong>à l&rsquo;intérieur d&rsquo;une catégorie</strong>. Les
        catégories, elles, se suivent toujours dans le même ordre — sponsors, partenaires,
        soutiens, participations — sur l&rsquo;accueil comme sur la page Partenaires.
      </p>

      {partenaires.length > 0 ? (
        groupes.map(({ category, entrees }) => {
          const ordre = entrees.map((p) => p.id);
          return (
            <section
              key={category}
              className={styles.section}
              aria-labelledby={`admin-partenaires-${category}`}
            >
              <h2 className={propre.categorie} id={`admin-partenaires-${category}`}>
                {LIBELLES[category]}
              </h2>
              {entrees.length > 0 ? (
                <ul className={styles.liste}>
                  {entrees.map((partenaire, position) => (
                    <LignePartenaire
                      key={partenaire.id}
                      partenaire={partenaire}
                      ordre={ordre}
                      position={position}
                      dansLeBandeau={dansLeBandeau.has(partenaire.id)}
                    />
                  ))}
                </ul>
              ) : (
                /* ⚠️ Une catégorie vide est nommée ici mais ENTIÈREMENT OMISE côté public
                   (AC4 de la 4.2 : pas de titre orphelin). Le dire évite qu'on croie à un
                   mur vide sur le site. */
                <p className={propre.categorieVide}>
                  Aucune entrée dans cette catégorie. Elle n&rsquo;apparaît pas du tout sur la
                  page Partenaires — il n&rsquo;y aura ni titre, ni case vide.
                </p>
              )}
            </section>
          );
        })
      ) : (
        /* ⚠️ Un état vide qui dirait « aucun partenaire » se lirait comme une panne. Celui-ci
           dit quoi faire — même doctrine que les états vides de la home (3.2), d'/agenda
           (3.3), du tableau de bord (6.1), de l'agenda (6.3) et de la galerie (6.4). */
        <p className={styles.vide}>
          Aucun partenaire pour l&rsquo;instant. « Ajouter un partenaire » ouvre la fiche —
          vous pourrez y téléverser le logo, décrire la structure et voir le rendu avant de
          publier quoi que ce soit.
        </p>
      )}
    </>
  );
}
