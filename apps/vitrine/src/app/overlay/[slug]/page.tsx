import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CadreOverlay } from "@/components/overlay/CadreOverlay/CadreOverlay";
import {
  PoulesOverlay,
  TableauOverlayDeTours,
} from "@/components/overlay/FormatsOverlay/FormatsOverlay";
import { TableauOverlay } from "@/components/overlay/TableauOverlay/TableauOverlay";
import styles from "@/components/overlay/CadreOverlay/overlay.module.css";
import { classementPubliable } from "@/lib/tournoi/classement";
import {
  RAFRAICHISSEMENT_SECONDES,
  estTransparent,
  heureDeFraicheur,
  tourCourant,
  vueDeLOverlay,
} from "@/lib/tournoi/overlay";
import { cleanText } from "@/lib/text";
import { getDeroulePublic } from "@/server/db/queries/phases";
import { getPoulesPubliques } from "@/server/db/queries/poules";
import { getClassementPublic, getRencontresPubliques } from "@/server/db/queries/rencontres";
import { getTournamentBySlug } from "@/server/db/queries/tournaments";

// ══════════════════════════════════════════════════════════════════════════════════════
// OVERLAY OBS — UNE ADRESSE PAR TOURNOI, QUI SUIT LE FORMAT DE LA PHASE EN COURS
// (Story 10.6 ; poules et tableau ajoutés pour la Game'in Reims, `vueDeLOverlay`)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 IL REMPLACE `tournoi.esportdessacres.fr/overlay`, SERVI PAR L'ANCIENNE APP. Cette
// URL-là est EXEMPTÉE de la redirection de la 9.4, et le README nomme la fin de cette
// exemption : « la Story 10.6, qui réécrit les overlays dans le site ». C'est donc aussi un
// PRÉREQUIS de la 10.7 — retirer l'ancienne app sans ces deux pages couperait le stream.
//
// 🔴 L'ADRESSE CHANGE, ET ELLE NE POUVAIT PAS NE PAS CHANGER : l'ancienne app gère UN tournoi
// implicite (aucune table `Tournament`, mesuré en 9.1), le moteur en gère plusieurs. Le slug
// est donc dans le chemin. ⚠️ Le caster DOIT reconfigurer ses sources OBS — c'est le seul
// geste manuel de cette story, et il est écrit dans le README.
//
// 🔴 LE TOURNOI DOIT ÊTRE PUBLIÉ. `getTournamentBySlug` filtre `is_published`, et on ne
// relâche pas ce filtre pour un overlay : ce qui passe à l'antenne est plus public que le
// site. Un brouillon rend donc 404, comme partout ailleurs (jamais 403 — patron 6.4).

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // ⚠️ `noindex` : c'est une incrustation, pas une page. Même valeur que les aperçus d'admin.
  robots: { index: false, follow: false },
  title: "Overlay",
};

export default async function OverlayPage({
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

  const cadre = {
    transparent: estTransparent(parametres.transparent),
    secondesDeRafraichissement: RAFRAICHISSEMENT_SECONDES,
    heureDuRendu: heureDeFraicheur(new Date()),
    titre: cleanText(tournoi.name) ?? "Tournoi",
  };

  // Mêmes lectures (garde `is_published` comprise) et mêmes règles de nommage que la fiche.
  const { vue, phase } = vueDeLOverlay(await getDeroulePublic(tournoi.id));

  if (vue === "poules" && phase) {
    const poules = (await getPoulesPubliques(tournoi.id)).find((p) => p.id === phase.id);
    return (
      <CadreOverlay {...cadre} sousTitre={phase.name}>
        {poules && poules.poules.length > 0 ? (
          <PoulesOverlay poules={poules.poules} enEquipe={tournoi.teamSize > 1} />
        ) : (
          <p className={styles.attente}>En attente des résultats…</p>
        )}
      </CadreOverlay>
    );
  }

  if (vue === "tableau" && phase) {
    const rencontres = (await getRencontresPubliques(tournoi.id)).find((p) => p.id === phase.id);
    const { courant, suivant, termine } = tourCourant(rencontres?.groupes ?? []);
    return (
      <CadreOverlay {...cadre} sousTitre={phase.name}>
        {courant ? (
          <TableauOverlayDeTours courant={courant} suivant={suivant} termine={termine} />
        ) : (
          <p className={styles.attente}>En attente des rencontres…</p>
        )}
      </CadreOverlay>
    );
  }

  // Tables (TFT) et tout le reste : le classement aux points, inchangé depuis la 10.6 — même
  // lecture et même règle de nommage (`classementPubliable`) que la fiche publique.
  const classement = classementPubliable(await getClassementPublic(tournoi.id));

  return (
    <CadreOverlay {...cadre} sousTitre="Qualifications">
      {classement.length === 0 ? (
        // La phrase dit l'état, pas une panne : avant la première manche dépouillée, rien à classer.
        <p className={styles.attente}>En attente des résultats…</p>
      ) : (
        <TableauOverlay lignes={classement} />
      )}
    </CadreOverlay>
  );
}
