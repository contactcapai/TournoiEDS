import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FicheTournoi } from "@/components/tournois/FicheTournoi/FicheTournoi";
import { formatLongDate, formatTime } from "@/lib/date-paris";
import { cleanText } from "@/lib/text";
import { jourParis } from "@/lib/date-paris";
import { classementPubliable } from "@/lib/tournoi/classement";
import { etatDuJour } from "@/lib/tournoi/en-cours";
import { getDeroulePublic } from "@/server/db/queries/phases";
import { getClassementPublic } from "@/server/db/queries/rencontres";
import { getTournamentBySlug } from "@/server/db/queries/tournaments";

// ══════════════════════════════════════════════════════════════════════════════════════
// LA FICHE D'UN TOURNOI (Story 9.3 — A20, A23) — SEPTIÈME page publique du site
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 PREMIÈRE ROUTE DYNAMIQUE **PUBLIQUE** DU DÉPÔT (mesuré le 2026-08-14 : les six autres
// pages publiques sont des routes statiques ; tous les `[param]` vivaient sous `/admin/`).
// Trois conséquences, toutes traitées ici et aucune évidente :
//   ① le `<title>` et les `og:*` dépendent de la DONNÉE ⇒ `generateMetadata`, le premier du
//      dépôt (les six autres pages exportent un objet `metadata` littéral) ;
//   ② un slug inconnu doit rendre **404**, et cette page est le premier `notFound()`
//      PUBLIC du dépôt — d'où le `(public)/not-found.tsx` qui l'accompagne, né d'une mesure
//      et pas d'un principe (la 404 par défaut sort SANS le chrome du groupe) ;
//   ③ `GATE_PAGES` attend des **URL concrètes** : la couverture de cette page se DÉRIVE de
//      la donnée servie (`tools/visual-gate/config.mjs`), elle n'est jamais écrite en dur.
//
// 🔴 LA PAGE NE REND RIEN ELLE-MÊME — `FicheTournoi` porte le rendu, parce qu'il a DEUX
// consommateurs : cette page et l'aperçu du bénévole (`/admin/tournois/[id]/apercu`). La page
// garde ce qui lui est propre et qui ne se partage pas : la lecture FILTRÉE, le `notFound()`,
// les métadonnées et le mode de rendu.

/**
 * 🔴 DYNAMIQUE ET SANS CACHE — MÊME RAISONNEMENT QUE LES SIX AUTRES PAGES.
 *
 * Ce que la fiche affiche dépend de `starts_at ≷ now()` (le podium n'apparaît que sur un
 * tournoi passé, l'état des inscriptions que sur un tournoi à venir) : le rendu change avec
 * le **temps seul**, sans qu'aucune mutation ne survienne. Un cache invalidé par tag
 * afficherait « Inscriptions : ouvertes » sur un tournoi déjà joué — une régression de
 * CORRECTION, pas de fraîcheur.
 *
 * ⚠️ Il satisfait aussi « build sûr sans `DATABASE_URL` » (garde-fou 1.7) : la CI n'a aucun
 * secret, et le seul `○` du build reste `/_not-found`.
 * ⚠️ **Aucun `generateStaticParams`**, et c'est délibéré : il pré-rendrait la liste des
 * tournois **au build**, donc un tournoi publié après le déploiement serait absent jusqu'au
 * suivant. Le back-office publie sans redéployer — c'est son livrable depuis l'Epic 6.
 */
export const dynamic = "force-dynamic";

/**
 * 🔴 PREMIER `generateMetadata` DU DÉPÔT — ET LES DEUX PIÈGES D'`openGraph` SONT LES MÊMES
 * QU'EN PAGE STATIQUE, tous deux mesurés sur le HTML rendu en Story 2.6 :
 *   ① `openGraph` NE DÉRIVE PAS du `title` de la page quand le parent en déclare un ;
 *   ② Next **REMPLACE** l'objet `openGraph` du parent, il ne le fusionne PAS champ par
 *      champ ⇒ sans les trois premières lignes, cette page perdrait `og:type`, `og:locale`
 *      et `og:site_name`, donc son nom de site dans une carte de partage.
 *
 * ⚠️ **AUCUN `og:image`, ET C'EST UN ARBITRAGE, PAS UN OUBLI.** Le volet `og:image`
 * appartient à la dette **R22**, routée vers la **Story 7.3** (photos HD, après la bascule
 * de production). En poser un ici le ferait exister à deux endroits, et les deux
 * divergeraient au premier ajustement. Le dire évite les deux erreurs symétriques :
 * l'ajouter en douce, ou croire qu'on l'a oublié.
 *
 * ⚠️ Un slug inconnu ne lève PAS ici : `generateMetadata` rend un titre neutre et c'est la
 * page qui appelle `notFound()`. Lever des deux côtés donnerait la même 404 au prix d'une
 * lecture de plus.
 * ⚠️ **Et le `<title>` d'une 404 n'est donc pas celui de la 404** : Next rend bien la page
 * `not-found`, mais avec les métadonnées calculées ici. « Tournoi introuvable » est écrit
 * pour ce cas précis — pas un repli générique.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tournoi = await getTournamentBySlug(slug);
  if (!tournoi) return { title: "Tournoi introuvable" };

  const salle = cleanText(tournoi.venueName);
  // Le root layout pose `title.template: "%s · Esport des Sacres"` → le <title> rendu est
  // « <nom> · Esport des Sacres ». `openGraph.title` doit, lui, être écrit EN ENTIER : il ne
  // traverse pas le template (piège mesuré en 2.6).
  const description = `${tournoi.game} — ${formatLongDate(tournoi.startsAt)} à ${formatTime(
    tournoi.startsAt,
  )}${salle ? `, ${salle}` : ""}.`;

  return {
    title: tournoi.name,
    description,
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: "Esport des Sacres",
      title: `${tournoi.name} · Esport des Sacres`,
      description,
    },
  };
}

export default async function FicheTournoiPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // 🔴 LA LECTURE FILTRE SUR `is_published` (voir `getTournamentBySlug`) : un brouillon rend
  // donc **404**, exactement comme un slug inexistant — et **jamais 403**. Patron
  // `/medias/[filename]` (Story 6.4) : un 403 CONFIRME l'existence de ce qu'il refuse, donc
  // il annonce au curieux qu'un tournoi se prépare sous ce nom.
  // ⚠️ Aucune validation de forme du slug avant la base, contrairement aux écrans d'admin qui
  // valident un `uuid` : un `text` malformé est une comparaison parfaitement légale pour
  // Postgres, il ne rend simplement aucune ligne. Y ajouter un `safeParse` serait une garde
  // contre un danger qui n'existe pas ici.
  const tournoi = await getTournamentBySlug(slug);
  if (!tournoi) notFound();

  // 🔴 SECONDE LECTURE, ET ELLE POSE SA PROPRE GARDE. `getDeroulePublic` refiltre
  // `is_published` sur une jointure plutôt que de faire confiance à l'identifiant qu'on lui
  // passe : une lecture publique qui délègue sa garde à son appelant finit par être appelée
  // d'ailleurs. Voir le bloc de tête de `queries/phases.ts`.
  const phases = await getDeroulePublic(tournoi.id);

  // 🔴 TROISIÈME LECTURE, MÊME GARDE (Story 14.2) : `getClassementPublic` refiltre lui aussi
  // `is_published` sur une jointure. ⚠️ Et le filtre de PUBLICATION est un second geste,
  // distinct de la garde : `classementPubliable` retire les lignes qu'on n'a pas le droit de
  // nommer. Il vit dans la lib parce que l'aperçu du bénévole, qui lit un BROUILLON, pose
  // exactement la même question sans pouvoir passer par cette requête-ci.
  const classement = classementPubliable(await getClassementPublic(tournoi.id));

  // 🔴 L'HORLOGE SE LIT ICI, UNE FOIS, ET JAMAIS DANS LE COMPOSANT. Lire l'heure pendant un
  // rendu est une impureté que `react-hooks/purity` refuse, et deux rendus du même arbre
  // pourraient répondre différemment. `FicheTournoi` reçoit un état déjà calculé.
  const aujourdHui = jourParis(new Date());

  return (
    <FicheTournoi
      tournoi={tournoi}
      suivi={{
        etat: etatDuJour(phases, jourParis(tournoi.startsAt), aujourdHui),
        phases,
        classement,
      }}
    />
  );
}
