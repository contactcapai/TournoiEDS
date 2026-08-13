import type {
  TournamentRegistrationMode,
  TournamentRegistrationState,
} from "./schemas/tournament";

/**
 * Libellés lisibles des enums de `tournament` (Story 9.1).
 *
 * Patron de `lib/familles-ateliers.ts` : **un seul exemplaire** pour le back-office et, demain,
 * pour la liste (9.2) et la fiche (9.3). Deux copies divergeraient au premier ajustement de
 * vocabulaire, et l'écart ne se verrait que sur l'une des deux surfaces.
 *
 * 🔴 CE FICHIER N'IMPORTE **QUE DES TYPES**, ET C'EST CE QUI LE REND CONSOMMABLE PAR UN
 * COMPOSANT CLIENT. `import type` disparaît à la compilation : rien de `schemas/tournament.ts`
 * — donc rien de zod — n'entre dans le bundle du navigateur par ce chemin.
 *
 * ⚠️ `Record<…, string>` **EXHAUSTIF** : ajouter une valeur à l'un des deux enums sans lui
 * donner de libellé **CASSE LE TYPECHECK**. C'est la garde qui empêche qu'une valeur ajoutée
 * en base se rende à l'écran sous la forme d'un libellé vide (défaut que la garde ④ de
 * `gate:ateliers` a dû aller mesurer côté base, faute de pouvoir compter sur le typage seul).
 */

/** Comment on s'inscrit, dit au bénévole. */
export const LIBELLES_MODE_INSCRIPTION: Record<TournamentRegistrationMode, string> = {
  interne: "Sur notre site",
  mately: "Par MATELY",
};

/**
 * Ce que chaque mode implique, dit **AU MOMENT DU CHOIX** et non dans une documentation.
 *
 * 🔴 LE MODE `interne` N'A ENCORE AUCUN FORMULAIRE, ET L'ÉCRAN DOIT LE DIRE. C'est le
 * périmètre A5 : cette story livre la racine, pas les inscriptions. Un bénévole qui choisirait
 * « Sur notre site » en croyant ouvrir un formulaire annoncerait des inscriptions que personne
 * ne pourrait remplir — c'est-à-dire exactement le mode de défaillance que la règle ① de
 * `pieges/integration-tierce.md` demande d'ÉCRIRE tant qu'un maillon n'est pas exercé.
 */
export const AIDES_MODE_INSCRIPTION: Record<TournamentRegistrationMode, string> = {
  interne:
    "Les inscriptions se prendront sur notre site. ⚠️ Le formulaire d'inscription n'existe " +
    "pas encore : d'ici là, la page du tournoi affichera l'état des inscriptions mais aucun " +
    "bouton. Choisissez ce mode seulement si vous recueillez les inscriptions autrement " +
    "(sur place, par Discord).",
  mately:
    "Les inscriptions passent par l'application de MATELY, et l'adresse ci-dessous devient " +
    "le bouton « S'inscrire » de la page du tournoi. C'est le seul mode qui permet " +
    "réellement de s'inscrire aujourd'hui.",
};

/** L'état des inscriptions, dit au bénévole. */
export const LIBELLES_ETAT_INSCRIPTION: Record<TournamentRegistrationState, string> = {
  ouvertes: "Ouvertes",
  completes: "Complètes",
  fermees: "Fermées",
};

/**
 * ⚠️ CET ÉTAT NE DIT **PAS** SI LE TOURNOI EST PASSÉ — piège désamorcé d'emblée par la note
 * d'architecture (§6 ①). « À venir » et « passé » se **dérivent de la date** ; l'état des
 * inscriptions est un fait distinct, et les deux se combinent librement : un tournoi à venir
 * dont les inscriptions sont déjà closes est parfaitement normal.
 */
export const AIDES_ETAT_INSCRIPTION: Record<TournamentRegistrationState, string> = {
  ouvertes: "On peut s'inscrire maintenant.",
  completes: "Toutes les places annoncées sont prises.",
  fermees:
    "On ne peut pas s'inscrire — soit les inscriptions ne sont pas encore ouvertes, soit " +
    "elles sont closes. C'est la valeur de départ : rien ne s'ouvre par accident.",
};
