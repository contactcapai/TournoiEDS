// @repo/ui/tokens — miroir TYPÉ (optionnel) des tokens de la charte EDS.
//
// ⚠️ La SOURCE DE VÉRITÉ RUNTIME est `src/styles/tokens.css` (variables :root).
// Cet objet n'est qu'un confort de typage pour le code TS (ex. primitives 1.3
// qui veulent une valeur en dur dans un calcul JS). Garder les valeurs alignées
// sur tokens.css. Ne PAS y mettre la logique de chargement des polices.

export const colors = {
  navy: "#29265b",
  navyDeep: "#1b1940",
  ink: "#141230",
  surface: "#322e6e",
  gold: "#dab265",
  goldSoft: "#e7c98a",
  grey: "#9293ad",
  light: "#edeffd",
  cream: "#f3efe3",
} as const;

export const rounded = {
  button: "4px",
  card: "8px",
  cardLg: "14px",
  tile: "10px",
  imgInner: "2px",
  frame: "3px",
  sticker: "50%",
  tag: "999px",
} as const;

export const spacing = {
  wrapMax: "1160px",
  wrapPad: "26px",
  sectionY: "90px",
  headHeight: "78px",
  sectionGap: "48px",
  blockGap: "30px",
  breakpointMobile: "880px",
} as const;

export type ColorToken = keyof typeof colors;
export type RoundedToken = keyof typeof rounded;
export type SpacingToken = keyof typeof spacing;
