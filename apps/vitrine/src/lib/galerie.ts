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
