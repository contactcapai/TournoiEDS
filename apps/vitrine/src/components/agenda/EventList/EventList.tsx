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
}

export function EventRow({ event }: EventRowProps) {
  // UNE SEULE DATE, jamais une plage : la maquette écrit « 21-22/11 » pour Game in
  // Reims, mais le modèle ne porte qu'un `starts_at`. Afficher une fin serait inventer
  // une donnée. Écart de transcription assumé, tracé dans `formatRowDate`.
  const place = event.bar
    ? event.bar.district
    : (cleanText(event.venueName) ?? cleanText(event.venueAddress));
  const isHighlight = event.type === "special";

  return (
    <li className={styles.row}>
      <div className={styles.rowDate}>{formatRowDate(event.startsAt)}</div>
      <div className={styles.rowText}>
        <b>{event.title}</b>
        {/* Sous-titre OMIS quand rien ne le nourrit : date + titre + tag suffisent à
            la ligne. `description` n'est PAS un repli ici — la page /agenda l'affiche
            dans son propre bloc, la home ne l'affiche pas du tout. */}
        {place ? (
          <p>
            {place} — {formatTime(event.startsAt)}
          </p>
        ) : null}
      </div>
      {/* Libellés PUBLICS de l'enum : `schema.ts` dit explicitement qu'ils sont du
          RENDU et non de la donnée. */}
      <Tag variant={isHighlight ? "highlight" : "default"}>
        {isHighlight ? "Temps fort" : "Hebdo"}
      </Tag>
    </li>
  );
}
