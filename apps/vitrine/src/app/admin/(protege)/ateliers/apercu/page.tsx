import type { Metadata } from "next";
import Link from "next/link";

import { WorkshopCatalog } from "@/components/animations/WorkshopCatalog/WorkshopCatalog";
import { LIBELLES_FAMILLE } from "@/lib/familles-ateliers";
import { WORKSHOP_FAMILIES } from "@/lib/schemas/workshop";
import { exigerRolePage } from "@/server/auth/guard";
import { getWorkshopsForAdmin, type AdminWorkshop } from "@/server/db/queries/workshops";
import editorial from "@/styles/editorial.module.css";
import styles from "@/styles/admin-page.module.css";
import propre from "../ateliers.module.css";

// ══════════════════════════════════════════════════════════════════════════════════════
// PRÉVISUALISATION DU CATALOGUE (Story 6.9, FR25 — 4ᵉ consommateur du mécanisme)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 C'EST LE COMPOSANT PUBLIC RÉEL, PAS UNE MAQUETTE DE L'ÉCRAN. `WorkshopCatalog` est importé
// depuis `components/animations/`, le MÊME module que rend `/animations`, avec ses garde-fous :
// `cleanText` sur les champs facultatifs, `overflow-wrap: anywhere`, et retour `null` quand la
// famille est vide. Une reproduction « fidèle » écrite ici divergerait au premier changement du
// rendu public, et mentirait exactement au moment où on lui demande de dire la vérité.
// ⚠️ Cette phrase disait « `<strong>` plutôt qu'un `<h4>` » : PÉRIMÉ depuis le passage en cards
// (gate visuel du 2026-08-04), où le titre de carte est devenu un vrai `<h4>`. Un commentaire
// qui décrit un état révolu est le piège `avertissement-commentaire` — corrigé plutôt que laissé.
//
// 🔴 IL EST MONTÉ DANS SON VOCABULAIRE RÉEL : `editorial.module.css` (`.band`, `.prose`,
// `.subtitle`), c'est-à-dire sur `background: var(--navy)`. Le contraste d'un texte dépend de
// son fond EFFECTIF (leçon 4.2 — « un fond effectif n'est pas un token ») : prévisualiser le
// catalogue sur le fond sombre du back-office montrerait un rendu qui n'existe nulle part.
//
// 🔴 CETTE ROUTE REND DES ATELIERS NON PUBLIÉS — c'est une FUITE DE DONNÉES si elle est
// atteignable sans session. D'où la garde en PREMIÈRE INSTRUCTION (une garde de `layout`
// n'arrête pas le rendu de la page enfant : défaut mesuré en Story 6.1). `gate:ateliers` en
// fait sa garde n°1, et vérifie le HTML SERVI, pas le code de statut.
//
// ⚠️ CE QUE CET APERÇU MONTRE DE PLUS QUE LE SITE EST DIT À L'ÉCRAN, pas laissé à deviner :
// il inclut les brouillons. Sans cette mention, on croirait que tout est déjà en ligne.
// ⚠️ CE QU'IL NE MONTRE PAS EST DIT AUSSI : la prose des trois familles (Story 2.7) reste sur
// la page publique et n'est pas reproduite ici. Un aperçu qui ferait croire que le catalogue
// remplace cette prose induirait en erreur sur ce que voit réellement le visiteur.

export const metadata: Metadata = {
  title: "Aperçu du catalogue d'ateliers",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Même borne que l'écran de liste, et pour la même raison : jamais de lecture non bornée. */
const ATELIERS_MAX = 200;

export default async function ApercuAteliersPage() {
  await exigerRolePage("admin_site");

  const ateliers = await getWorkshopsForAdmin(ATELIERS_MAX);

  const groupes = WORKSHOP_FAMILIES.map((family) => ({
    family,
    entrees: ateliers.filter((a: AdminWorkshop) => a.family === family),
  }));

  const brouillons = ateliers.filter((a) => !a.isPublished).length;

  return (
    <>
      <h1 className={styles.titre}>Aperçu du catalogue</h1>
      <p className={styles.chapo}>
        Le rendu réel du catalogue tel qu&rsquo;il apparaît sur la page{" "}
        <strong>Animations</strong>, sur son fond réel.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/ateliers">
          Retour aux ateliers
        </Link>
      </div>

      {/* 🔴 CE QUE L'APERÇU MONTRE DE PLUS QUE LE PUBLIC, ÉCRIT EN TOUTES LETTRES. */}
      <p className={styles.mention} role="note">
        {brouillons > 0 ? (
          <>
            Cet aperçu inclut les <strong>brouillons</strong> ({brouillons} sur{" "}
            {ateliers.length}) : ce que vous voyez ici n&rsquo;est donc{" "}
            <strong>pas</strong> ce que voit le visiteur. Publiez un atelier depuis la liste
            pour qu&rsquo;il apparaisse réellement.
          </>
        ) : (
          <>
            Tous les ateliers sont publiés : cet aperçu montre donc exactement ce que voit le
            visiteur.
          </>
        )}
      </p>

      {/* ⚠️ LE TROU DE L'APERÇU, DÉCLARÉ. Il montre le catalogue, pas la page entière : la
          prose des trois familles, le chapô et la phrase de clôture vivent sur /animations et
          ne sont pas reproduits ici. Ne pas déclarer ce qu'une porte ou un aperçu NE couvre
          pas, c'est laisser croire qu'il couvre tout (doctrine des exemptions déclarées). */}
      <p className={styles.mention} role="note">
        Seul le <strong>catalogue</strong> est prévisualisé. Sur le site, chaque liste
        ci-dessous est précédée du texte de présentation de sa famille, qui reste affiché même
        lorsque la liste est vide.
      </p>

      {/* Le vocabulaire éditorial RÉEL, sur le fond RÉEL. `.band` porte `background: --navy`
          et le `padding-top` de la bande ; `.prose` porte la mesure de lecture et `--light`. */}
      <div className={`${editorial.band} ${propre.apercu}`}>
        <div className={editorial.prose}>
          {groupes.map(({ family, entrees }) => (
            <section key={family} aria-labelledby={`apercu-${family}`}>
              <h2 className={editorial.subtitle} id={`apercu-${family}`}>
                {LIBELLES_FAMILLE[family]}
              </h2>
              {entrees.length > 0 ? (
                <WorkshopCatalog ateliers={entrees} />
              ) : (
                /* ⚠️ Cette phrase n'existe QUE dans l'aperçu — sur le site, une famille sans
                   atelier ne rend rien du tout (le composant retourne `null`). La montrer ici
                   évite de croire à un bug d'affichage ; l'écrire dans le composant la ferait
                   apparaître sur la page publique. */
                <p className={propre.apercuVide}>
                  (Aucun atelier : sur le site, cette famille garde sa description et
                  n&rsquo;affiche aucune liste.)
                </p>
              )}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
