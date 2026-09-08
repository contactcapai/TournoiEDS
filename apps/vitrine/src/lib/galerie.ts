/**
 * Bornes de la galerie « La vie de l'asso ».
 *
 * 🔴 EXTRAIT AU **3ᵉ** CONSOMMATEUR, ET LE COMPTE EST LA JUSTIFICATION (leçon R9 :
 * *toujours COMPTER*). La valeur est née dans `app/(public)/page.tsx` (Story 4.3), seule à en
 * avoir besoin. La Story 6.4 lui en donne deux autres, et ils ne sont pas décoratifs :
 *   ① `/admin/galerie` marque les photos qui entrent réellement dans les 8 de l'accueil ;
 *   ② `/admin/galerie/apercu` borne sa prévisualisation exactement comme la home.
 *
 * ⚠️ ET LA DIVERGENCE SERAIT SILENCIEUSE, ce qui achève la démonstration : si l'un des trois
 * bougeait seul, l'écran d'administration dirait « cette photo est sur l'accueil » à propos
 * d'une photo qui n'y serait pas. Aucune porte ne verrait la différence — ni lint, ni
 * typecheck, ni build, ni Lighthouse, ni l'œil. C'est la famille de
 * `pieges/dette-invisible.md`, celle qui justifie d'extraire une valeur et non seulement une
 * mise en page.
 *
 * ⚠️ Module `lib/` et non `server/` : il ne contient qu'un nombre, et il est lu par une page
 * publique comme par le back-office. Un `import "server-only"` ici n'aurait rien à protéger.
 */

/**
 * Nombre de photos publiées montrées sur l'accueil.
 *
 * La home donne un APERÇU, pas l'exhaustivité (`EXPERIENCE.md` l.119) — même règle que pour
 * l'agenda. UX-DR13 dit « 5 à 10 photos suffisent pour démarrer » : 8 est le milieu de cette
 * fourchette et tient sur deux rangées de quatre en desktop.
 *
 * 🔴 CETTE BORNE FAIT DE L'ORDRE UN **FILTRE**, PAS UN TRI DÉCORATIF. Au-delà de 8 photos
 * publiées, l'ordre saisi au back-office décide de ce qui apparaît sur la page la plus vue du
 * site. C'est ce que `/admin/galerie` doit dire à l'écran, sinon « organiser la galerie »
 * (FR21) se lit comme un rangement sans conséquence.
 */
export const HOME_PHOTO_COUNT = 8;

/**
 * Poids maximal accepté **côté client** pour une image de la médiathèque.
 *
 * 🔴 EXTRAIT AU 2ᵉ CONSOMMATEUR (Story 15.1) — `PhotoUploader` le portait seul, `ChoixImage`
 * le lit désormais aussi. Et la divergence serait du genre le plus désagréable : les deux
 * écrans créent des lignes dans **la même table**, par **la même action**. L'un annonçant
 * 10 Mo et l'autre 8 Mo, un même fichier serait accepté ici et refusé là, sans que rien ne
 * l'explique à qui l'importe.
 *
 * 🔴 10 Mo CÔTÉ CLIENT POUR 12 Mo CÔTÉ SERVEUR (`next.config.ts`), ET L'ÉCART EST LA GARDE.
 * La borne client est la seule qui produise un message UTILE — elle connaît la taille du
 * `File` sans rien transmettre, donc elle peut nommer le fichier ET la limite. La borne
 * serveur est le filet, et elle doit rester **strictement supérieure** : le multipart
 * transporte plus que l'octet du fichier (frontières, en-têtes, autres champs). Sans cette
 * marge, un fichier de 10,0 Mo accepté ici repartirait en `413` — un refus levé **avant** le
 * corps de l'action, donc muet, c'est-à-dire exactement le défaut qu'on évite.
 * ⚠️ Volontairement haute : la dette **R15** attend des originaux HAUTE DÉFINITION, et rien
 * ne redimensionne à l'écriture. La baisser rendrait R15 insoluble.
 * ⚠️ **Le logo d'un partenaire garde SA borne** (5 Mo, `LogoUploader`) : ce n'est pas la même
 * table, pas la même route, pas la même nature de fichier. L'unifier serait ranger deux
 * décisions différentes sous un même nom.
 */
export const IMAGE_TAILLE_MAX_OCTETS = 10 * 1024 * 1024;

/** « 4,2 Mo ». Virgule décimale : c'est un texte affiché à un francophone, pas une valeur. */
export function formaterTaille(octets: number): string {
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
