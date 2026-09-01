import Image from "next/image";
import { PhotoFrame, Tag } from "@repo/ui";

import carousel from "@/components/agenda/PastCarousel/PastCarousel.module.css";
import { formatLongDate, formatTime } from "@/lib/date-paris";
import { cleanText, truncate } from "@/lib/text";
import type { AgendaEvent } from "@/server/db/queries/events";
import type { GalleryPhoto } from "@/server/db/queries/photos";
import styles from "./PastEvent.module.css";

/**
 * Vignette d'un événement DÉJÀ PASSÉ (FR5) — le bloc du carrousel « Déjà passé ».
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 EXTRAIT PAR LA STORY 6.4 — DETTE **R34 SOLDÉE**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Ce bloc vivait dans `app/(public)/agenda/page.tsx` depuis la Story 3.3, à juste titre : un
 * seul consommateur, donc pas d'extraction. La Story 6.3 a voulu prévisualiser le rendu
 * « déjà passé » et s'est arrêtée là, au motif — écrit dans R34 et dans son écran d'aperçu —
 * que l'extraction toucherait `carousel.vignette`, *« une classe LUE par `gate:carousel` »*.
 *
 * 🔴 CE MOTIF A ÉTÉ RE-MESURÉ, ET IL ÉTAIT FRANCHISSABLE. `tools/visual-gate/carousel-check.mjs`
 * l.43 sélectionne `li[class*="__vignette"]` : un sélecteur d'ATTRIBUT PAR SOUS-CHAÎNE sur le
 * nom de classe **compilé**. Tant que le `<li>` continue de consommer `carousel.vignette`
 * (ce qu'il fait ci-dessous), la porte voit **exactement la même chose** — le fichier d'où
 * vient le `<li>` lui est indifférent. Ce que l'extraction déplace réellement, ce sont les
 * règles `.past*`, qu'AUCUNE porte ne lit par leur nom (la garde « classes fantômes » du
 * `gate` compare des ENSEMBLES de classes, pas des sélecteurs nommés — parade retenue en
 * 2.10 parce que Turbopack fusionne les sélecteurs à corps identique).
 * ⚠️ C'est un cas d'école de `pieges/sortie-agent-non-verifiee.md` appliqué à nous-mêmes :
 * un fait de contexte affirmé au passage (« cette classe est lue par la porte ») est une
 * hypothèse à re-mesurer, pas une borne.
 *
 * DEUX CONSOMMATEURS DÉSORMAIS : `/agenda` (public) et `/admin/agenda/[id]/apercu`
 * (prévisualisation). C'est ce 2ᵉ consommateur qui paie l'extraction — pas l'anticipation.
 *
 * ⚠️ AUCUN `prefixeMedia` ICI, CONTRAIREMENT À `Scrapbook`. La vignette montre la première
 * photo **PUBLIÉE** de l'événement (`getPhotosForEvents` filtre sur `is_published`), donc
 * toujours servable par la route publique. Lui ajouter une prop pour un cas qui ne se
 * produit pas serait exactement la 3ᵉ prop « au cas où » que `SectionHead` interdit
 * nommément. L'aperçu le DIT à l'écran : un brouillon n'apparaît pas dans cette vignette,
 * pas plus que sur le site.
 */

/**
 * 🔴 BORNES DE LONGUEUR — ELLES SERVENT LA HAUTEUR, PAS L'ESTHÉTIQUE.
 *
 * Les vignettes du carrousel s'étirent à la hauteur de la plus haute. Sans borne, **un
 * seul** compte-rendu bavard imposerait sa hauteur aux quatre et laisserait les trois autres
 * aux trois quarts vides — et le bloc changerait de taille à chaque défilement.
 *
 * 240 caractères ≈ 4 lignes à la largeur de lecture retenue (62ch). 80 pour le titre : deux
 * lignes au plus, il ne doit pas concurrencer le compte-rendu.
 * ⚠️ `PAST_TITLE_MAX` vaut la MÊME valeur que `TITRE_MAX` de la saisie (`lib/schemas/event.ts`,
 * aligné par la 6.3) : la troncature ne se déclenche donc plus sur une saisie du back-office,
 * seulement sur une ligne écrite avant la borne ou par du SQL direct.
 */
const RECAP_MAX = 240;
const PAST_TITLE_MAX = 80;

export interface PastEventProps {
  event: AgendaEvent;
  /** Première photo PUBLIÉE de l'événement. `undefined` ⇒ placeholder `PhotoFrame`. */
  photo?: GalleryPhoto;
}

export function PastEvent({ event, photo }: PastEventProps) {
  const recap = truncate(event.recap, RECAP_MAX);
  const titre = truncate(event.title, PAST_TITLE_MAX);
  const place = event.bar
    ? `${event.bar.name} — ${event.bar.district}, ${event.bar.city}`
    : (cleanText(event.venueName) ?? cleanText(event.venueAddress));
  const isHighlight = event.type === "special";

  return (
    // 🔴 `carousel.vignette` EST CONSERVÉ, ET C'EST CE QUI GARDE `gate:carousel` VALIDE.
    // Il porte la largeur fixe et l'accrochage (`scroll-snap-align`) : ce sont des
    // propriétés de la PISTE, pas du contenu. `styles.past` habille le bloc lui-même.
    // Deux fichiers, deux responsabilités — et aucune des deux classes ne redéclare ce que
    // l'autre pose.
    <li className={`${carousel.vignette} ${styles.past}`}>
      <div className={styles.pastBody}>
        <p className={styles.pastDate}>
          {formatLongDate(event.startsAt)} · {formatTime(event.startsAt)}
        </p>
        {/* <h3> : sous le <h2> de la section, lui-même sous le <h1> de la page. */}
        <h3 className={styles.pastTitle}>{titre}</h3>
        {place ? <p className={styles.pastPlace}>{place}</p> : null}
        {/* Un passé SANS compte-rendu reste affiché — il prouve l'activité — mais sans bloc
            vide (NFR8). C'est le cas de tous les événements tant que personne n'est venu
            écrire le compte-rendu dans le back-office. */}
        {recap ? <p className={styles.pastRecap}>{recap}</p> : null}
        <div className={styles.pastTag}>
          <Tag variant={isHighlight ? "highlight" : "default"}>
            {isHighlight ? "Temps fort" : "Hebdo"}
          </Tag>
        </div>
      </div>

      {/* `photo` vaut `undefined` quand l'événement n'a aucune photo publiée : on retombe
          alors sur le placeholder que `PhotoFrame` rend DÉJÀ sans enfant (cadre « tirage » +
          icône + « Photo à venir »).
          🔴 C'EST LE CAS MAJORITAIRE AUJOURD'HUI — une seule photo est en base. Ce n'est pas
          un état dégradé à corriger : c'est ce que le gate visuel doit voir.
          Le zéro CLS (NFR2) vient du même endroit dans les deux cas : l'`aspect-ratio: 4/3`
          du cadre réserve la place. */}
      <div className={styles.pastMedia}>
        {/* 🔴 LA LÉGENDE N'EST PAS LE TITRE DE L'ÉVÉNEMENT, et c'est un correctif mesuré : la
            porte outillée a fait déborder `/agenda` de 33px à 320px quand un titre long y a
            été injecté (le `figcaption` de PhotoFrame est rendu en Caveat et ne se coupe
            pas). Deux raisons de ne pas s'en tenir à un garde-fou CSS :
              - EXPERIENCE.md (É7) demande une « légende du CONTEXTE » — ses exemples sont
                « Game in Reims », « Soirée jeudi » —, pas le titre complet ;
              - une légende manuscrite longue est illisible par nature.
            Le libellé est donc BORNÉ PAR CONSTRUCTION : deux valeurs possibles, jamais de la
            donnée libre. */}
        <PhotoFrame rotation={-2} caption={isHighlight ? "Temps fort" : "Soirée jeudi"}>
          {photo ? (
            /* `sizes` tient compte du RECADRAGE `cover` du cadre, comme dans le scrapbook :
               la vignette du carrousel fait au plus 100 % de sa piste, et une source plus
               large que 4/3 doit fournir davantage de pixels que la largeur affichée. Le
               raisonnement complet est dans `Scrapbook.tsx`.
               ⚠️ `alt=""` : la légende du cadre et le titre de l'événement décrivent déjà le
               bloc, et l'image y est ILLUSTRATIVE. Un `alt` répétant le contexte ferait dire
               deux fois la même chose au lecteur d'écran. La description complète de la
               photo, elle, est portée par la galerie de la home, où l'image EST le contenu. */
            <Image
              src={`/medias/${photo.filename}`}
              alt=""
              fill
              sizes="398px"
              loading="lazy"
              // Le point focal, comme dans le scrapbook : ce cadre recadre en 4/3, donc il
              // coupe. Correctif du 2026-09-01.
              style={{ objectPosition: `${photo.focalX}% ${photo.focalY}%` }}
            />
          ) : null}
        </PhotoFrame>
      </div>
    </li>
  );
}
