import { cleanText } from "./text";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LE PODIUM VISIBLE — **UNE SEULE DÉFINITION POUR LES DEUX SURFACES QUI LE RENDENT**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * La carte de `/tournois` (Story 9.2) et la fiche `/tournois/<slug>` (Story 9.3) rendent le
 * même podium. Elles en avaient **deux** copies, identiques au caractère près — et un podium
 * qui se lirait différemment d'une page à l'autre serait un défaut, pas une nuance.
 *
 * 🔴 **ET LA COPIE PARTAGÉE CORRIGE UN DÉFAUT QUE LES DEUX AVAIENT** (trouvé en revue de la
 * 9.3). Elles filtraient les trois rangs **indépendamment** après nettoyage :
 *
 *     [1ᵉʳ, 2ᵉ, 3ᵉ].filter((p) => p.nom !== null)
 *
 * Les `CHECK` `tournament_podium_sans_trou_*` interdisent bien les trous — mais **sur la
 * PRÉSENCE** (`is not null`), pas sur le contenu **visible**. Un `podium_first` fait uniquement
 * de caractères sans largeur (U+200B : `btrim` ne le retire pas, dette R41) passe donc la base,
 * puis `cleanText` le ramène à `null`… et le filtre indépendant laissait sortir un podium qui
 * **commence à la 2ᵉ place**. C'est très exactement le trou que les `CHECK` existent pour
 * interdire, refabriqué à l'affichage.
 * ⇒ On s'arrête au **premier rang manquant** : un podium se lit du haut, et « 2ᵉ » sans « 1ᵉʳ »
 * n'est pas une information partielle, c'est une information fausse.
 *
 * ⚠️ Le rang est écrit **en toutes lettres** et jamais laissé au marqueur natif d'une `<ol>` :
 * la liste peut légitimement ne compter qu'une ou deux places, et un « 1. » puis « 2. »
 * automatiques diraient la même chose sans la dire.
 */
export interface PlacePodium {
  rang: string;
  nom: string;
}

/** Les trois colonnes de rang, dans l'ordre du podium. */
interface SourcePodium {
  podiumFirst: string | null;
  podiumSecond: string | null;
  podiumThird: string | null;
}

export function podiumVisible(source: SourcePodium): PlacePodium[] {
  const rangs: [string, string | null][] = [
    ["1ᵉʳ", source.podiumFirst],
    ["2ᵉ", source.podiumSecond],
    ["3ᵉ", source.podiumThird],
  ];

  const places: PlacePodium[] = [];
  for (const [rang, brut] of rangs) {
    const nom = cleanText(brut);
    // 🔴 `break` et NON `continue` : c'est toute la différence entre « on saute une place » et
    // « on s'arrête au trou ». Un `continue` rendrait « 1ᵉʳ … 3ᵉ … » sans 2ᵉ, ce que les `CHECK`
    // interdisent déjà en base — la seule façon d'y arriver serait un nettoyage qui vide le
    // rang du milieu, et on ne veut pas la reproduire à l'écran.
    if (nom === null) break;
    places.push({ rang, nom });
  }
  return places;
}
