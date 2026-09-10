import { cleanText } from "./text";

/**
 * Comment se dit le lieu d'un bar du roulement quand le quartier ou la ville MANQUENT
 * (2026-09-10, demande de Brice : les deux sont devenus facultatifs).
 *
 * 🔴 CE MODULE EXISTE PARCE QUE L'ABSENCE S'ÉCRIVAIT. Six écrans composaient le lieu par
 * interpolation — `` `${nom} — ${district}, ${city}` `` — et cette forme rend « Le Bar — , »
 * dès qu'un morceau est `null` : une ponctuation qui annonce une information qui n'existe
 * pas. Aucune porte ne lit une phrase (PR #83, #88, #90, #100, #102, #109) ⇒ la règle sort
 * du JSX et se teste.
 *
 * ⚠️ CE N'EST PAS LE `lieuDe()` DE L'ÉCRAN D'AGENDA NI LE `lieuDuPayload()` DES RÉSEAUX, et
 * ceux-là ne fusionnent toujours pas (leur commentaire dit pourquoi : l'un compose une
 * chaîne de repérage, l'autre sépare nom et adresse). Ce qui est partagé ici est plus
 * petit : la **situation** — quartier, ville — et la façon de l'accrocher à une tête.
 */
export interface BarSituable {
  district: string | null;
  city: string | null;
}

/**
 * « Quartier, Ville », ou l'un des deux, ou `null` si le bar n'en porte aucun.
 *
 * ⚠️ `cleanText` et pas `!== null` : la base tolère `NULL` mais pas la chaîne blanche, et
 * une ligne écrite avant cette règle (ou par du SQL direct) peut porter un espace.
 */
export function situationDuBar(bar: BarSituable): string | null {
  const parties = [cleanText(bar.district), cleanText(bar.city)].filter(
    (partie): partie is string => partie !== null,
  );
  return parties.length > 0 ? parties.join(", ") : null;
}

/**
 * Le repère le plus court qui reste VRAI, pour la rangée compacte du hub : le quartier,
 * sinon la ville, sinon le nom du bar.
 *
 * ⚠️ La rangée compacte ne montre QUE cette ligne comme lieu — sans repli, un bar sans
 * quartier n'afficherait rien alors qu'on sait parfaitement où l'on va. On ne descend
 * jamais jusqu'à l'adresse : c'est le fait réservé à la variante `detailed` (3.3).
 */
export function repereCourtDuBar(bar: BarSituable & { name: string }): string | null {
  return cleanText(bar.district) ?? cleanText(bar.city) ?? cleanText(bar.name);
}

/**
 * Accroche une suite à une tête par un tiret cadratin — et **ne rend que la tête** quand la
 * suite est absente. C'est ici, et nulle part ailleurs, que vit le « — » du lieu d'un bar.
 */
export function joindreParTiret(tete: string, suite: string | null): string {
  return suite === null ? tete : `${tete} — ${suite}`;
}
