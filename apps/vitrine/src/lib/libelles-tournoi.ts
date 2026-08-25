import type { EntryState, MatchBracket } from "./tournoi/structure";
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

/**
 * Le pointage du jour J, dit au bénévole (Story 10.5).
 *
 * 🔴 « ABSENT » ET « DROP » PORTENT DES LIBELLÉS QUI NE SE RESSEMBLENT PAS, et c'est
 * l'AC 5. Deux libellés proches sur deux gestes que tout oppose est exactement ce qui fait
 * cliquer trop vite — leçon d'`AtelierActions` (6.9), où « retirer de l'offre » a dû s'éloigner
 * de « supprimer ». Ici l'enjeu est plus grand qu'une ligne perdue : confondre les deux
 * FAUSSERAIT LE CLASSEMENT (dette R60, `lib/tournoi/structure.ts`).
 */
export const LIBELLES_ETAT_ENGAGE: Record<EntryState, string> = {
  inscrit: "Inscrit",
  present: "Présent",
  absent: "Absent",
  // 🔴 « DROP », LE MOT DES JOUEURS (arbitrage de Brice, 2026-08-25). Il remplace
  // « A abandonné », qui était long, se confondait de loin avec « Absent » et ne se disait
  // pas ainsi autour d'une table de TFT. ⚠️ LA VALEUR EN BASE RESTE `abandonne` : c'est un
  // libellé qu'on change, pas un état — aucune migration, et le moteur ne bouge pas.
  // ⚠️ Le raccourcissement RENFORCE l'AC 5 ci-dessus au lieu de l'affaiblir : « Absent » et
  // « Drop » ne se ressemblent plus du tout, ni en longueur ni en sonorité.
  abandonne: "Drop",
};

/**
 * Ce que chaque état veut dire, dit **AU MOMENT DU POINTAGE**.
 *
 * ⚠️ La phrase d'`abandonne` nomme la conséquence sur le CLASSEMENT, parce que c'est la seule
 * différence qui coûte quelque chose : effacer les points d'un abandon réécrirait les parties
 * où ses adversaires l'ont battu.
 */
export const AIDES_ETAT_ENGAGE: Record<EntryState, string> = {
  inscrit: "Inscrit, pas encore pointé. C'est l'état de départ.",
  present: "Il est là. C'est lui qu'on comptera pour générer le tableau.",
  absent: "Ne s'est jamais présenté, n'a rien joué.",
  // ⚠️ CETTE PHRASE COMPTE PLUS DEPUIS QUE LE LIBELLÉ EST « DROP » : le mot est du jargon,
  // il ne se comprend pas tout seul par un bénévole qui découvre l'écran. Elle dit donc
  // d'ABORD ce qui s'est passé, ensuite la conséquence.
  abandonne:
    "Était là, a joué, puis a arrêté en cours de route. Ses points et ses manches RESTENT " +
    "au classement — les effacer réécrirait les parties où ses adversaires l'ont battu.",
};

/**
 * Le tableau d'où vient une rencontre (Story 14.3).
 *
 * 🔴 **REMONTÉ ICI DEPUIS `JourJ`, PARCE QU'IL A UN SECOND CONSOMMATEUR** : la fiche publique.
 * Deux copies diraient un jour deux choses du **même** objet, sur deux surfaces — et l'écart ne
 * se verrait que sur l'une des deux (leçon `estParTables`, 10.10).
 *
 * ⚠️ `principal` est **VIDE À DESSEIN** : une élimination simple n'a qu'un tableau, et le nommer
 * « Tableau principal » inventerait une distinction qui n'existe pas pour qui la regarde. Le
 * libellé se compose alors du seul « Tour N ».
 * ⚠️ `Record<MatchBracket, string>` **exhaustif** : ajouter une valeur à l'enum sans libellé
 * casse le typecheck, plutôt que de rendre une étiquette vide à l'écran.
 */
export const LIBELLE_TABLEAU: Record<MatchBracket, string> = {
  principal: "",
  vainqueurs: "Tableau des vainqueurs",
  perdants: "Tableau des perdants",
  grande_finale: "Grande finale",
};
