import type { WorkshopFamily } from "./schemas/workshop";

/**
 * Libellés PUBLICS des trois familles d'intervention (Story 6.9).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 UN SEUL EXEMPLAIRE, ET IL EST CONSOMMÉ PAR LES **TROIS** SURFACES
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `/animations` (les `<h3>` du catalogue), l'écran `/admin/ateliers` (les titres de groupe) et
 * le formulaire (les options du `<select>`) affichent tous les trois ces mêmes chaînes.
 *
 * La 6.5 avait accepté **deux** copies pour les catégories de partenaires, en le documentant :
 * *« volontairement les mêmes que /partenaires — sinon "Nos participations" d'un côté et
 * "Participations" de l'autre feraient douter qu'il s'agisse du même mur »*. Le raisonnement
 * était juste, la garde ne l'était pas : deux copies alignées **à la main** se désalignent au
 * premier changement, et rien ne le verrait. Ici il n'y en a qu'une.
 *
 * 🔴 CE MODULE NE DOIT JAMAIS IMPORTER NI JSX, NI CSS, NI DRIZZLE — c'est ce qui le rend
 * consommable par `AtelierForm`, qui est un composant **client**. Le mettre dans le composant
 * de catalogue (qui importe un CSS Module) ferait entrer ce CSS dans le bundle du navigateur ;
 * le mettre dans `schemas/workshop.ts` mélangerait le RENDU et la VALIDATION, que tout le
 * projet sépare. Même emplacement et même motif que `lib/logos.ts` (6.5).
 *
 * 🔴 LES TROIS CHAÎNES SONT CELLES DE LA STORY 2.7, MOT POUR MOT, ET ELLES NE SE RETOUCHENT
 * PAS ICI. Elles étaient écrites en dur dans `animations/page.tsx`, sous l'instruction :
 * *« elles deviennent la TAXONOMIE DURABLE. Ne pas les renommer à la légère. »* Les déplacer
 * ici est un refactor à **rendu identique** — la page les consomme désormais au lieu de les
 * porter. Toute modification de libellé est une modification de la page publique.
 *
 * ⚠️ `Record<WorkshopFamily, string>` EXHAUSTIF : ajouter une valeur à l'enum sans lui donner
 * de libellé **casse le typecheck**. Un objet indexé librement rendrait un titre de groupe
 * anonyme, en silence.
 */
export const LIBELLES_FAMILLE: Record<WorkshopFamily, string> = {
  atelier: "Ateliers et tournois conviviaux",
  sensibilisation: "Sensibilisation aux écrans",
  evenement: "Animations sur vos événements",
};
