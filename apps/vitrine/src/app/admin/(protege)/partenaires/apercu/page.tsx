import type { Metadata } from "next";
import Link from "next/link";

import { PartnerWall } from "@/components/proof/PartnerWall/PartnerWall";
import { ProofBand } from "@/components/proof/ProofBand/ProofBand";
import { PARTNER_CATEGORIES, type PartnerCategory } from "@/lib/schemas/partner";
import { exigerRolePage } from "@/server/auth/guard";
import { getPartnersForAdmin } from "@/server/db/queries/partners";
import styles from "@/styles/admin-page.module.css";
import propre from "../partenaires.module.css";

// ══════════════════════════════════════════════════════════════════════════════════════
// PRÉVISUALISATION DES MURS DE LOGOS (Story 6.5, FR25 — 3ᵉ consommateur du mécanisme)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 CE SONT LES COMPOSANTS PUBLICS RÉELS, PAS UNE MAQUETTE DE L'ÉCRAN. `ProofBand` (et le
// `PartnerMarquee` qu'il monte) et `PartnerWall` sont importés depuis `components/proof/`, les
// MÊMES modules que rendent `/` (Story 4.1) et `/partenaires` (Story 4.2), avec tous leurs
// garde-fous : bascule mur ↔ piste défilante, bouton de pause, tuile à hauteur fixe,
// `object-fit: contain`, variante `.inst` des soutiens, repli sur le nom quand il n'y a pas de
// logo. Une reproduction « fidèle » écrite ici divergerait au premier changement du rendu
// public, et mentirait exactement au moment où on lui demande de dire la vérité.
//
// 🔴 ET C'EST CE QUI FERME LA DETTE **R27** — COMME **ACCEPTÉE**, PAS COMME SOLDÉE.
// Son routage pariait que cette story serait le **3ᵉ consommateur de la géométrie de tuile**
// (`height: 76px`, `--radius-tile`, voile crème 5 %, filet 12 %, base 150 / plafond 210),
// écrite deux fois — dans `PartnerMarquee.module.css` et `PartnerWall.module.css` — et donc
// que l'extraction se paierait ici. **Elle ne se paie pas** : cet écran n'est pas une
// troisième COPIE de la géométrie, c'est un troisième APPELANT des mêmes fichiers. Les trois
// raisons de ne pas extraire, écrites dans `PartnerWall.module.css` l.194-212, tiennent donc
// toujours — et la seule qui devait être réévaluée est réfutée par la conception retenue.
// ⚠️ La vignette d'inventaire de la LISTE (`partenaires.module.css`) n'en est pas une non
// plus : elle emprunte deux valeurs au rendu (la hauteur et le fond `--navy`), et aucune des
// six déclarations que R27 recense.
//
// 🔴 CETTE ROUTE REND DES PARTENAIRES NON PUBLIÉS — c'est une FUITE DE DONNÉES si elle est
// atteignable sans session. D'où la garde en PREMIÈRE INSTRUCTION (une garde de `layout`
// n'arrête pas le rendu de la page enfant : défaut mesuré en Story 6.1). `gate:partenaires` en
// fait sa garde n°1, et vérifie le HTML SERVI, pas le code de statut.
//
// ⚠️ DEUX PLATEAUX, DEUX FONDS, et ce n'est pas décoratif : le bandeau est posé sur
// `--navy-deep` sur la home, les murs sur `--navy` sur /partenaires. Le contraste d'un texte
// dépend de son fond EFFECTIF (leçon 4.2 — « un fond effectif n'est pas un token ») :
// prévisualiser les deux sur un même fond montrerait un rendu qui n'existe nulle part.

export const metadata: Metadata = {
  title: "Aperçu des murs de logos",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Même borne que l'écran de liste, et pour la même raison : jamais de lecture non bornée. */
const PARTENAIRES_MAX = 200;

/**
 * Libellés PUBLICS des quatre catégories.
 *
 * ⚠️ **VERBATIM de `/partenaires`** (Story 4.2, UX-DR18, contractuels) : trois viennent de la
 * maquette, le quatrième de l'AC d'`epics.md`. Un aperçu qui les reformulerait ne
 * prévisualiserait pas la page réelle.
 */
const LIBELLES: Record<PartnerCategory, string> = {
  sponsor: "Nos sponsors",
  partenaire: "Nos partenaires",
  soutien: "Ils nous soutiennent",
  participation: "Nos participations",
};

/** La variante `.inst` est posée sur les SOUTIENS et sur eux seuls (comme sur /partenaires). */
const CATEGORIE_INSTITUTIONNELLE: PartnerCategory = "soutien";

export default async function ApercuPartenairesPage() {
  await exigerRolePage("admin_site");

  // 🔴 BROUILLONS INCLUS, ET C'EST LA RAISON D'ÊTRE DE CET ÉCRAN. `getPublishedPartners()`
  // filtrerait sur `is_published` : l'aperçu ne montrerait alors rien de ce qu'on vient de
  // préparer.
  const toutes = await getPartnersForAdmin(PARTENAIRES_MAX);

  // Ce que le BANDEAU de l'accueil montrerait : les entrées avec un logo, dans l'ordre.
  // ⚠️ Le filtre `logo IS NOT NULL` de `getPartnersWithLogo()` est reproduit ici — c'est lui
  // qui décide de la présence dans le bandeau, et l'aperçu doit reproduire la MÊME règle,
  // sinon il montre un bandeau que personne ne verra jamais.
  const avecLogo = toutes
    .filter((p) => p.logo !== null)
    .map(({ id, name, logo }) => ({ id, name, logo }));

  // Ce que les MURS de /partenaires montreraient. Une catégorie sans entrée est ENTIÈREMENT
  // omise (AC4 de la 4.2) : pas de titre orphelin, pas de grille vide.
  const murs = PARTNER_CATEGORIES.map((category) => ({
    category,
    entries: toutes.filter((p) => p.category === category),
  })).filter((mur) => mur.entries.length > 0);

  const brouillons = toutes.filter((p) => !p.isPublished).length;
  const brouillonsAvecLogo = toutes.filter((p) => !p.isPublished && p.logo !== null).length;

  return (
    <>
      <h1 className={styles.titre}>Aperçu des murs de logos</h1>
      <p className={styles.chapo}>
        Voici les deux surfaces publiques telles qu&rsquo;elles apparaîtraient{" "}
        <strong>si tout ce qui suit était publié</strong> — le bandeau de l&rsquo;accueil, puis
        les murs de la page Partenaires.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/partenaires">
          Retour aux partenaires
        </Link>
        <Link className={styles.lien} href="/admin/partenaires/nouveau">
          Ajouter un partenaire
        </Link>
      </div>

      {/* 🔴 LA BORNE EST DITE, PAS TUE. L'aperçu inclut les brouillons pour qu'on voie le
          rendu final ; sur le site, seules les entrées PUBLIÉES apparaissent. Un écran muet
          là-dessus se ferait lire comme exhaustif — corollaire de `pieges/garde-nominale.md`
          appliqué à un écran plutôt qu'à une porte. */}
      <p className={styles.mention} role="note">
        {brouillons > 0 ? (
          <>
            Cet aperçu inclut{" "}
            <strong>
              {brouillons} brouillon{brouillons > 1 ? "s" : ""}
            </strong>
            {brouillonsAvecLogo > 0 ? (
              <>
                , dont {brouillonsAvecLogo} avec un logo — {brouillonsAvecLogo > 1 ? "ils" : "il"}{" "}
                {brouillonsAvecLogo > 1 ? "apparaissent" : "apparaît"} donc dans le bandeau
                ci-dessous alors qu&rsquo;{brouillonsAvecLogo > 1 ? "ils n'y sont" : "il n'y est"}{" "}
                pas encore sur le site
              </>
            ) : null}
            . Sur le site public, seules les entrées <strong>publiées</strong> apparaissent.
          </>
        ) : (
          <>
            Toutes les entrées ci-dessous sont publiées : c&rsquo;est exactement ce que voit un
            visiteur aujourd&rsquo;hui.
          </>
        )}
      </p>

      {/* ── ① Le bandeau de l'accueil ──────────────────────────────────────────────── */}
      <section className={styles.section} aria-labelledby="apercu-bandeau">
        <h2 className={styles.sectionTitre} id="apercu-bandeau">
          Sur l&rsquo;accueil
        </h2>

        {/* 🔴 LA CONSÉQUENCE QUE PERSONNE NE DEVINE : sans aucun logo, `ProofBand` se rend
            `null` — la bande entière disparaît, titre et chapô compris. L'aperçu doit le
            MONTRER, pas le laisser deviner par un blanc. */}
        {avecLogo.length > 0 ? (
          <div className={`${propre.plateau} ${propre.plateauHome}`}>
            <ProofBand partners={avecLogo} sourceAdmin />
          </div>
        ) : (
          <p className={styles.mention} role="note">
            ⚠️ <strong>Aucun partenaire n&rsquo;a de logo</strong>, donc la bande « Reconnus,
            soutenus, connectés » <strong>n&rsquo;apparaît pas du tout</strong> sur
            l&rsquo;accueil — ni son titre, ni son chapô, ni son lien « Devenir partenaire ».
            Ce n&rsquo;est pas un cadre vide : c&rsquo;est une section entière en moins.
          </p>
        )}
      </section>

      {/* ── ② Les murs de /partenaires ─────────────────────────────────────────────── */}
      <section className={styles.section} aria-labelledby="apercu-murs">
        <h2 className={styles.sectionTitre} id="apercu-murs">
          Sur la page Partenaires
        </h2>

        {murs.length > 0 ? (
          <div className={`${propre.plateau} ${propre.plateauMurs}`}>
            {murs.map(({ category, entries }) => (
              <PartnerWall
                key={category}
                label={LIBELLES[category]}
                titleId={`apercu-mur-${category}`}
                entries={entries}
                institutionnel={category === CATEGORIE_INSTITUTIONNELLE}
                sourceAdmin
              />
            ))}
          </div>
        ) : (
          /* ⚠️ CONTRAIREMENT AU BANDEAU, LA PAGE, ELLE, EXISTE TOUJOURS — son URL est dans le
             header. Elle rend alors une phrase à la place des quatre murs (AC4 de la 4.2). */
          <p className={styles.mention} role="note">
            Aucune entrée : la page Partenaires <strong>existe quand même</strong> (son adresse
            est dans le menu du site) et affiche une phrase à la place des murs — jamais quatre
            titres vides.
          </p>
        )}
      </section>
    </>
  );
}
