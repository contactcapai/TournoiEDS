import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CadreOverlay } from "@/components/overlay/CadreOverlay/CadreOverlay";
import { TableauOverlay } from "@/components/overlay/TableauOverlay/TableauOverlay";
import styles from "@/components/overlay/CadreOverlay/overlay.module.css";
import { classementPubliable } from "@/lib/tournoi/classement";
import {
  RAFRAICHISSEMENT_SECONDES,
  estTransparent,
  heureDeFraicheur,
} from "@/lib/tournoi/overlay";
import { cleanText } from "@/lib/text";
import { getClassementPublic } from "@/server/db/queries/rencontres";
import { getTournamentBySlug } from "@/server/db/queries/tournaments";

// ══════════════════════════════════════════════════════════════════════════════════════
// OVERLAY OBS — LES QUALIFICATIONS (Story 10.6)
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

export default async function OverlayQualificationsPage({
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

  // 🔴 LA MÊME LECTURE ET LA MÊME RÈGLE DE NOMMAGE QUE LA FICHE PUBLIQUE (14.2) : la garde
  // `is_published` est DANS la requête, et `classementPubliable` retire les lignes qu'on n'a
  // pas le droit de nommer. Un overlay qui nommerait quelqu'un que le site tait le ferait
  // passer à l'antenne — l'écart serait public avant d'être vu.
  const classement = classementPubliable(await getClassementPublic(tournoi.id));

  // ⚠️ L'HORLOGE SE LIT ICI, UNE FOIS, ET JAMAIS DANS UN COMPOSANT (`react-hooks/purity`).
  const heure = heureDeFraicheur(new Date());

  return (
    <CadreOverlay
      transparent={estTransparent(parametres.transparent)}
      secondesDeRafraichissement={RAFRAICHISSEMENT_SECONDES}
      heureDuRendu={heure}
      titre={cleanText(tournoi.name) ?? "Tournoi"}
      sousTitre="Qualifications"
    >
      {classement.length === 0 ? (
        // ⚠️ LA PHRASE DIT L'ÉTAT, PAS UNE PANNE. L'ancien overlay écrivait « En attente des
        // résultats… », et c'est exactement juste : avant la première manche dépouillée, il
        // n'y a rien à classer — ce n'est pas un écran cassé.
        <p className={styles.attente}>En attente des résultats…</p>
      ) : (
        <TableauOverlay lignes={classement} />
      )}
    </CadreOverlay>
  );
}
