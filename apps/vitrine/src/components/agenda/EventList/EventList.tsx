import type { ReactNode } from "react";
import { Tag } from "@repo/ui";
import { formatRowDate, formatTime } from "@/lib/date-paris";
import { cleanText } from "@/lib/text";
import type { AgendaEvent } from "@/server/db/queries/events";
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
  event: AgendaEvent;
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

export function EventRow({ event, variant = "compact" }: EventRowProps) {
  // UNE SEULE DATE, jamais une plage : la maquette écrit « 21-22/11 » pour Game in
  // Reims, mais le modèle ne porte qu'un `starts_at`. Afficher une fin serait inventer
  // une donnée. Écart de transcription assumé, tracé dans `formatRowDate`.
  const place = event.bar
    ? event.bar.district
    : (cleanText(event.venueName) ?? cleanText(event.venueAddress));
  const isHighlight = event.type === "special";
  const detailed = variant === "detailed";

  // 🔴 L'ADRESSE POSTALE COMPLÈTE, et elle n'est affichée NULLE PART AILLEURS sur le
  // site (arbitrage de Brice, Story 3.3). Elle remplace le CTA « participer » que
  // `epics.md` demandait : sur la page agenda ce CTA n'avait aucune destination (pas
  // de billetterie en v1, et « J'y serai » renvoyait précisément vers cette page).
  // L'adresse, elle, répond à la seule question qui reste quand on a décidé d'y aller.
  // Pas de redondance avec le sous-titre : celui-ci porte le QUARTIER, pas la rue.
  const address = detailed
    ? event.bar
      ? [cleanText(event.bar.address), cleanText(event.bar.city)].filter(Boolean).join(", ")
      : cleanText(event.venueAddress)
    : null;
  const description = detailed ? cleanText(event.description) : null;

  return (
    <li className={styles.row}>
      <div className={styles.rowDate}>{formatRowDate(event.startsAt)}</div>
      <div className={styles.rowText}>
        <b>{event.title}</b>
        {/* Sous-titre OMIS quand rien ne le nourrit : date + titre + tag suffisent à
            la ligne. `description` n'est PAS un repli ici — elle a sa propre ligne
            en variante `detailed`, et la home ne l'affiche pas du tout. */}
        {place ? (
          <p>
            {place} — {formatTime(event.startsAt)}
          </p>
        ) : null}
        {/* Les deux lignes ci-dessous n'existent qu'en `detailed`, et chacune
            disparaît si sa donnée est absente ou blanche (NFR8) — jamais de
            paragraphe vide qui ouvrirait un blanc dans la liste. */}
        {address ? <p className={styles.rowAddress}>{address}</p> : null}
        {description ? <p className={styles.rowDescription}>{description}</p> : null}
      </div>
      {/* Libellés PUBLICS de l'enum : `schema.ts` dit explicitement qu'ils sont du
          RENDU et non de la donnée. */}
      <Tag variant={isHighlight ? "highlight" : "default"}>
        {isHighlight ? "Temps fort" : "Hebdo"}
      </Tag>
    </li>
  );
}
