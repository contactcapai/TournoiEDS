import type { ReactNode } from "react";
import { Tag } from "@repo/ui";
import { formatPlageHoraire, formatRowDate } from "@/lib/date-paris";
import { cleanText } from "@/lib/text";
import type { RendezVous } from "@/server/db/queries/rendez-vous";
import styles from "./EventList.module.css";

// Liste d'événements et sa ligne (`.rest` / `.rest .row` de la maquette) —
// Server Components purs.
//
// Écrites par la Story 3.2 dans `components/home/EventHub/`, EXTRAITES ICI par la 3.3
// à l'arrivée de leur deuxième consommateur réel (la page /agenda) — `EXPERIENCE.md`
// l.129 place le roulement sur « Hub, page Agenda ».
//
// 🔴 LES DEUX EXPORTS VIVENT DANS LE MÊME FICHIER, ET C'EST UNE GARDE.
// `<ul>`/`<li>` sont indissociables, et surtout `list-style: none` retire la
// sémantique de liste dans Safari/VoiceOver — c'est `role="list"` qui la restaure.
// Les séparer dans deux dossiers laisserait un appelant écrire son propre `<ul>` en
// oubliant le rôle, et l'annonce « liste de N éléments » disparaîtrait sans qu'aucune
// porte ne le voie. Ici, l'appelant ne peut pas se tromper : il n'écrit pas de `<ul>`.
//
// ⚠️ NOMMAGE : `architecture.md` l.500 annonçait `RotationList`. Le nom serait FAUX
// hors de la home — sur /agenda cette liste porte aussi les temps forts et les
// événements passés, qui ne sont pas un « roulement ». `architecture.md` est corrigé
// plutôt que le code nommé à contresens.

export function EventList({ children }: { children: ReactNode }) {
  return (
    <ul className={styles.list} role="list">
      {children}
    </ul>
  );
}

export interface EventRowProps {
  rendezVous: RendezVous;
  /**
   * `compact` (défaut) — le hub de la home : date, titre, quartier + heure, tag.
   * `detailed` — la page `/agenda` : ajoute **l'adresse postale complète** et la
   * **description**.
   *
   * Une variante plutôt que deux booléens (`showAddress`, `showDescription`) : les
   * deux ajouts vont toujours ensemble, et deux drapeaux indépendants ouvriraient
   * quatre combinaisons dont deux que personne ne veut. API minimale, patron de
   * `Tag` et `Button` (`variant`).
   */
  variant?: "compact" | "detailed";
}

export function EventRow({ rendezVous, variant = "compact" }: EventRowProps) {
  // UNE SEULE DATE DANS LA CASE DE GAUCHE, jamais une plage — et **le motif a changé le
  // 2026-08-14 (Story 9.6)**. Il disait : « le modèle ne porte qu'un `starts_at`, afficher une
  // fin serait inventer une donnée ». **Cette raison est morte** : `ends_at` existe. Le nouveau
  // motif est un arbitrage de rendu (A6) — la case de gauche est un repère de calendrier
  // compact, et la fin est dite **à sa place**, dans l'horaire, par `formatPlageHoraire`, qui
  // nomme le jour dès qu'il diffère. L'information n'est donc jamais perdue : elle est ailleurs,
  // et une seule fois. Raisonnement complet sur `formatRowDate`.
  //
  // 🔴 DEUX NATURES DEPUIS LA 9.5, ET AUCUNE N'EST FABRIQUÉE (A9) — voir `NextEventCard`.
  const evenement = rendezVous.nature === "evenement" ? rendezVous.evenement : null;
  const tournoi = rendezVous.nature === "tournoi" ? rendezVous.tournoi : null;
  const place = evenement?.bar
    ? evenement.bar.district
    : (cleanText(evenement?.venueName ?? tournoi?.venueName ?? null) ??
      cleanText(evenement?.venueAddress ?? null));
  const detailed = variant === "detailed";

  // 🔴 L'ADRESSE POSTALE COMPLÈTE, et elle n'est affichée NULLE PART AILLEURS sur le
  // site (arbitrage de Brice, Story 3.3). Elle remplace le CTA « participer » que
  // `epics.md` demandait : sur la page agenda ce CTA n'avait aucune destination (pas
  // de billetterie en v1, et « J'y serai » renvoyait précisément vers cette page).
  // L'adresse, elle, répond à la seule question qui reste quand on a décidé d'y aller.
  // Pas de redondance avec le sous-titre : celui-ci porte le QUARTIER, pas la rue.
  // ⚠️ Un tournoi n'a **ni adresse postale ni description** dans le modèle : les deux lignes
  // de la variante `detailed` restent donc vides pour lui, et disparaissent — c'est la règle
  // NFR8 déjà appliquée ci-dessous, pas un cas particulier. Ne PAS y substituer son `game` ou
  // son `formatText` : ce ne sont pas les mêmes faits.
  const address = detailed
    ? evenement?.bar
      ? [cleanText(evenement.bar.address), cleanText(evenement.bar.city)]
          .filter(Boolean)
          .join(", ")
      : cleanText(evenement?.venueAddress ?? null)
    : null;
  const description = detailed ? cleanText(evenement?.description ?? null) : null;

  // 🔴 Story 9.6 — la fin se rend sur les DEUX variantes (c'est un fait de l'horaire, et la
  // ligne compacte porte déjà l'heure), le TARIF seulement en `detailed` : sur la home, la
  // rangée n'a que trois informations et sa raison d'être est le RYTHME du roulement, pas le
  // détail d'un rendez-vous — c'est le même partage que l'adresse et la description.
  // ⚠️ `cleanText` sur le tarif, comme partout : `btrim` ne retire pas U+200B (dette R41), et un
  // tarif fait uniquement d'invisible doit compter comme ABSENT plutôt que rendre un `<p>` vide.
  const fin = evenement?.endsAt ?? tournoi?.endsAt ?? null;
  const tarif = detailed
    ? cleanText(evenement?.priceText ?? tournoi?.priceText ?? null)
    : null;

  return (
    <li className={styles.row}>
      <div className={styles.rowDate}>{formatRowDate(rendezVous.startsAt)}</div>
      <div className={styles.rowText}>
        <b>{rendezVous.libelle}</b>
        {/* Sous-titre OMIS quand rien ne le nourrit : date + titre + tag suffisent à
            la ligne. `description` n'est PAS un repli ici — elle a sa propre ligne
            en variante `detailed`, et la home ne l'affiche pas du tout. */}
        {place ? (
          <p>
            {place} — {formatPlageHoraire(rendezVous.startsAt, fin)}
          </p>
        ) : null}
        {/* Les trois lignes ci-dessous n'existent qu'en `detailed`, et chacune
            disparaît si sa donnée est absente ou blanche (NFR8) — jamais de
            paragraphe vide qui ouvrirait un blanc dans la liste. */}
        {address ? <p className={styles.rowAddress}>{address}</p> : null}
        {tarif ? <p className={styles.rowPrice}>{tarif}</p> : null}
        {description ? <p className={styles.rowDescription}>{description}</p> : null}
      </div>
      {/* Libellés PUBLICS de l'enum : `schema.ts` dit explicitement qu'ils sont du
          RENDU et non de la donnée.
          🔴 UN TROISIÈME LIBELLÉ DEPUIS LA 9.5, ET IL NE VIENT PAS D'UN ENUM. Un tournoi sans
          événement n'a **pas** de `type` : le rendre « Hebdo » serait faux, et le laisser sans
          étiquette ferait un trou dans la grille de la ligne. « Tournoi » se **dérive de la
          nature**, ce qui est exactement l'arbitrage A2 — aucune valeur ajoutée à `EVENT_TYPES`
          (qui alimente le contrat n8n) pour un fait que la relation dit déjà. */}
      <Tag variant={evenement?.type === "thursday" ? "default" : "highlight"}>
        {tournoi ? "Tournoi" : evenement?.type === "special" ? "Temps fort" : "Hebdo"}
      </Tag>
    </li>
  );
}
