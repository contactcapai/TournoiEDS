/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * L'IDENTITÉ LÉGALE DE L'ASSOCIATION — SOURCE UNIQUE (Story 12.5)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CES VALEURS SONT LUES PAR DEUX PAGES (`/mentions-legales` et `/confidentialite`), ET
 * AUCUNE NE LES RECOPIE. Une adresse de siège écrite à deux endroits divergerait au premier
 * déménagement, et la page non corrigée resterait verte à toutes les portes — c'est la
 * famille `garde-sur-une-copie.md`, appliquée ici à de la donnée légale plutôt qu'à une
 * garde.
 *
 * 🔴 TOUT VIENT DU RÉCÉPISSÉ DE DÉCLARATION DE LA PRÉFECTURE DE LA MARNE, fourni par Brice
 * le 2026-09-01 (n° W513009855, délivré le 2022-11-02). Rien n'est
 * déduit, rien n'est supposé. ⚠️ NE PAS « corriger » ces valeurs de mémoire : si l'une
 * devient fausse, c'est que l'association a déclaré un changement en préfecture, et c'est
 * le nouveau récépissé qui fait foi.
 *
 * ⚠️ L'ASSOCIATION EST TENUE DE DÉCLARER TOUT CHANGEMENT DE SIÈGE OU DE DIRECTION DANS LES
 * TROIS MOIS (loi de 1901, art. 5) — le récépissé le rappelle lui-même. Un changement de
 * président se répercute donc ici, et pas seulement dans les statuts.
 */
export const ASSOCIATION = {
  /** Titre exact tel que déclaré. ⚠️ Pas « EDS », pas « Esport des Sacres asso ». */
  nom: "Esport des Sacres",

  /**
   * Numéro RNA (Répertoire National des Associations).
   *
   * ⚠️ C'est l'identifiant qui fait foi pour une association déclarée, et le récépissé
   * précise qu'il « est à rappeler dans toute correspondance ». Il remplace ici le SIRET,
   * que l'association ne s'est pas vu demander : le SIRET n'est requis dans des mentions
   * légales que pour un éditeur exerçant une activité économique déclarée.
   */
  rna: "W513009855",

  /** Date du récépissé de déclaration de création. */
  dateDeclaration: "2 novembre 2022",

  /**
   * Siège social déclaré.
   *
   * ⚠️ PUBLIER CETTE ADRESSE EST UNE OBLIGATION, PAS UN CHOIX (LCEN art. 6 III-1) : les
   * mentions légales d'un éditeur doivent porter le siège. Si l'association domiciliait un
   * jour son siège ailleurs (mairie, maison des associations), c'est la déclaration en
   * préfecture qu'il faudrait changer — pas cette page seule, qui doit rester le reflet du
   * récépissé.
   */
  adresse: "18 rue des Frères Glorieux",
  codePostal: "51430",
  ville: "Tinqueux",

  /**
   * Directeur de la publication.
   *
   * 🔴 C'EST LE PRÉSIDENT DE L'ASSOCIATION — Simon Menu (indication de Brice, 2026-09-01).
   *
   * ⚠️ LA LCEN DEMANDE UN NOM, PAS UNE FONCTION, et ce champ a d'abord porté « Le président
   * de l'association » faute de mieux : le récépissé fourni est anonymisé (« donne récépissé
   * à Monsieur »). Une mention légale sert précisément à savoir À QUI s'adresser — « le
   * président » identifie un rôle, pas une personne, et aurait laissé la page formellement
   * incomplète tout en ayant l'air remplie.
   * ⚠️ La QUALITÉ accompagne le nom : elle dit d'où vient la responsabilité, et elle est ce
   * qui change si l'association élit quelqu'un d'autre.
   */
  directeurPublication: "Simon Menu, président de l'association",

  /**
   * Adresse de contact.
   *
   * ⚠️ C'est celle qui envoie déjà les liens de connexion et reçoit les sollicitations
   * (`server/db/queries/settings.ts`) : une seconde adresse serait une promesse que
   * personne ne relève.
   */
  email: "esportdessacres@gmail.com",
} as const;

/**
 * L'hébergeur du site.
 *
 * 🔴 MESURÉ DANS LE DÉPÔT, PAS SUPPOSÉ : `README.md` du monorepo décrit un « VPS Hostinger »
 * et le DNS d'`esportdessacres.fr` y est géré. La LCEN (art. 6 III-1) impose de nommer
 * l'hébergeur avec sa dénomination et son adresse.
 *
 * ⚠️ RAISON SOCIALE ET ADRESSE À CONFIRMER SUR LES CGV DE HOSTINGER avant publication :
 * elles sont reprises de la documentation publique de l'hébergeur et n'ont pas été vérifiées
 * sur une source officielle depuis ce dépôt. Une mention légale qui se trompe d'adresse
 * d'hébergeur est fausse, même de bonne foi.
 */
export const HEBERGEUR = {
  nom: "Hostinger International Ltd",
  adresse: "61 Lordou Vironos Street, 6023 Larnaca, Chypre",
  site: "https://www.hostinger.fr",
  siteAffiche: "hostinger.fr",
} as const;
