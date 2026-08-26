import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CadreOverlay } from "@/components/overlay/CadreOverlay/CadreOverlay";
import { TableauOverlay } from "@/components/overlay/TableauOverlay/TableauOverlay";
import styles from "@/components/overlay/CadreOverlay/overlay.module.css";
import { classementPubliable } from "@/lib/tournoi/classement";
import { finalePubliable } from "@/lib/tournoi/finale";
import {
  RAFRAICHISSEMENT_SECONDES,
  estTransparent,
  heureDeFraicheur,
} from "@/lib/tournoi/overlay";
import { cleanText } from "@/lib/text";
import { getClassementPublic, getFinale } from "@/server/db/queries/rencontres";
import { getTournamentBySlug } from "@/server/db/queries/tournaments";

// ══════════════════════════════════════════════════════════════════════════════════════
// OVERLAY OBS — LA FINALE (Story 10.6)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 IL REMPLACE `tournoi.esportdessacres.fr/overlay/finale`. Le caster bascule d'une URL à
// l'autre AU MOMENT QU'IL CHOISIT (arbitrage de Brice, 2026-08-26) : deux sources OBS, comme
// aujourd'hui. Une seule URL qui suivrait la phase ferait changer l'écran du stream au moment
// où un bénévole clique en back-office — le caster subirait la transition au lieu de la choisir.
//
// 🔴 LA RÈGLE DE VICTOIRE N'EST PAS RÉÉCRITE ICI, ELLE EST APPELÉE. `getFinale` + `finalePubliable`
// (10.14) rendent le classement de l'espace « finale », le vainqueur, ceux en position de gagner
// ET LE SEUIL. L'ancien overlay, lui, portait `20` EN DUR à trois endroits (`totalScore / 20`,
// `>= 20`, et la phrase) — or le seuil est RÉGLABLE depuis la 10.14 (`tournament_phase.settings`).
// Le porter tel quel aurait réintroduit un dur dans le seul écran qui l'affiche au public.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Overlay — finale",
};

export default async function OverlayFinalePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const parametres = await searchParams;

  const tournoi = await getTournamentBySlug(slug);
  if (!tournoi) notFound();

  // ⚠️ `exigerPublie` DES DEUX CÔTÉS : la garde vit dans la requête, jamais chez l'appelant.
  const finaleLue = await getFinale(tournoi.id, { exigerPublie: true });
  const finale = finaleLue ? finalePubliable(finaleLue) : null;

  const cadre = {
    transparent: estTransparent(parametres.transparent),
    secondesDeRafraichissement: RAFRAICHISSEMENT_SECONDES,
    heureDuRendu: heureDeFraicheur(new Date()),
    titre: cleanText(tournoi.name) ?? "Tournoi",
  };

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * ÉTAT ① — LE VAINQUEUR EST DÉSIGNÉ
   * ══════════════════════════════════════════════════════════════════════════════════════
   * ⚠️ C'est `issueDeLaFinale` qui l'a décidé, pas cet écran : le seuil doit avoir été franchi
   * dans une manche **antérieure** au top 1. Un overlay qui redériverait « premier du
   * classement » couronnerait quelqu'un pendant que la finale se joue encore — le défaut exact
   * que `prerremplirPodium` évite déjà côté back-office (10.14).
   */
  if (finale?.vainqueur) {
    return (
      <CadreOverlay {...cadre} sousTitre={null}>
        <section className={styles.sacre}>
          <p aria-hidden="true" className={styles.trophee}>
            🏆
          </p>
          <p className={styles.vainqueur}>{finale.vainqueur.nom}</p>
          <p className={styles.mention}>
            Vainqueur — {finale.vainqueur.total} points en finale
          </p>
        </section>
        <TableauOverlay
          colonneDeSeuil={finale.seuil}
          libelleMarque="vainqueur"
          lignes={finale.classement}
          marques={new Set(nomsVersIds(finale.classement, [finale.vainqueur.nom]))}
        />
      </CadreOverlay>
    );
  }

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * ÉTAT ② — LA FINALE SE JOUE
   * ══════════════════════════════════════════════════════════════════════════════════════
   * 🔴 **LA PHRASE A ÉTÉ CORRIGÉE, ET C'EST UN DÉFAUT PORTÉ PAR L'ANCIEN OVERLAY.** Il écrivait
   * « Top 1 + 20 pts cumules = victoire », ce qui se lit comme une **conjonction** : atteindre
   * 20 et faire top 1 dans la même manche. Or la règle validée le 2026-08-25 est « 20 points,
   * **PUIS** un top 1 » — franchir le seuil *pendant* la manche du top 1 **ne suffit pas**
   * (14 pts + top 1 → 22 pts → **pas** vainqueur). Le « puis » EST la règle, et une phrase qui
   * se lit fausse vaut une phrase fausse (PR #90).
   * ⚠️ Le seuil est **écrit depuis la donnée**, jamais en dur : une finale réglée à 25 points
   * afficherait sinon « 20 » à l'antenne pendant qu'on en joue une autre.
   */
  if (finale && finale.classement.length > 0) {
    return (
      <CadreOverlay
        {...cadre}
        sousTitre={`Finale — ${finale.seuil} points, puis un top 1`}
      >
        <TableauOverlay
          colonneDeSeuil={finale.seuil}
          libelleMarque="peut gagner"
          lignes={finale.classement}
          marques={
            new Set(
              nomsVersIds(
                finale.classement,
                finale.enPositionDeGagner.map((finaliste) => finaliste.nom),
              ),
            )
          }
        />
      </CadreOverlay>
    );
  }

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * ÉTAT ③ — LA FINALE N'A RIEN DE JOUÉ : ON MONTRE LES QUALIFICATIONS
   * ══════════════════════════════════════════════════════════════════════════════════════
   * 🔴 **ET ON NE FABRIQUE PAS DE « TOP 8 ».** L'ancien overlay en affichait un, avec le 8 EN
   * DUR (`rankings.slice(0, 8)`) : il décrivait le format d'un seul tournoi, celui de 2026. Le
   * moteur ne connaît aucun « nombre de qualifiés » — il n'existe nulle part en base — donc
   * l'écrire ici serait **inventer un fait**, et le premier tournoi à finale de six joueurs
   * l'aurait démenti à l'antenne.
   * ⇒ On montre le **classement des qualifications**, qui répond à la même question sans rien
   * supposer : c'est lui que le caster commente en attendant.
   */
  const qualifications = classementPubliable(await getClassementPublic(tournoi.id));

  return (
    <CadreOverlay
      {...cadre}
      sousTitre={
        finale === null
          ? "Qualifications"
          : "Qualifications — en attente du lancement de la finale"
      }
    >
      {qualifications.length === 0 ? (
        <p className={styles.attente}>En attente des résultats…</p>
      ) : (
        <TableauOverlay lignes={qualifications} />
      )}
    </CadreOverlay>
  );
}

/**
 * Retrouve les identifiants des lignes à mettre en avant, à partir de leurs noms.
 *
 * ⚠️ **`finalePubliable` NE REND QUE DES NOMS** pour le vainqueur et les prétendants (elle
 * réduit volontairement la surface publiée, 14.2), tandis que le tableau marque **par
 * identifiant** — sans quoi deux engagés homonymes se marqueraient l'un l'autre. Ce petit
 * raccord vit ici plutôt que d'élargir le type publié : la lib publie ce qu'on a le droit de
 * dire, l'écran se débrouille avec ce qu'il a déjà.
 */
function nomsVersIds(
  lignes: readonly { id: string; nom: string }[],
  noms: readonly string[],
): string[] {
  const cherches = new Set(noms);
  return lignes.filter((ligne) => cherches.has(ligne.nom)).map((ligne) => ligne.id);
}
