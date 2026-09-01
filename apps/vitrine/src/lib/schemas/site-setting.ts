/**
 * Schéma de validation partagé des réglages du site (FR38, AR-DB4 — Story 6.13).
 *
 * Vit sous `src/lib/` et non `src/server/` : il est importé par le formulaire CLIENT du
 * back-office autant que par la Server Action qui écrit en base. Un seul schéma des deux
 * côtés, sinon les deux règles divergent au premier changement. Patron posé par `event.ts`
 * (3.1), repayé par `partner.ts` (4.1), `solicitation.ts` (5.1), `workshop.ts` (6.9) et
 * `member.ts` (6.10).
 *
 * 🔴 CE FICHIER EST LA SOURCE DES BORNES : `server/db/schema.ts` les importe pour construire
 * ses `CHECK`. La base et Zod expriment **la même règle** en deux langages, jamais deux
 * littéraux recopiés qui divergeraient au premier ajustement. Le sens de la dépendance est
 * celui-là et **pas l'inverse** — importer `schema.ts` depuis un module que le client bundle
 * ferait entrer tout Drizzle dans le navigateur.
 */
import { z } from "zod";

import { texteNettoye, urlHttpOptionnelle, visiblementVide } from "./texte";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 SIX CHAMPS, ET PAS UN DE PLUS — L'ABSENCE EST LE GARDE-FOU
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * **Il n'y a ni titre de site, ni description, ni adresse postale, ni téléphone, ni horaires,
 * ni le moindre champ de texte libre — et c'est le livrable.**
 *
 *   · **Arbitrage de Brice du 2026-07-29** : *table à ligne unique et colonnes typées*, et non
 *     un magasin clé/valeur libre. Un magasin clé/valeur n'autorise **aucune validation par
 *     champ** — or c'est **toute** la valeur de cet écran (**NFR8**), sur des liens présents
 *     dans le chrome des **5 pages**.
 *   · **Q6, frontière assumée** : la **prose éditoriale reste en dur**. Un champ de texte libre
 *     ici serait la porte d'entrée du « on met le pied dedans » — et ce back-office est fait
 *     pour des bénévoles, pas pour un CMS.
 *   · **FR16** : aucun chiffre de communauté, nulle part sur ce site.
 *
 * ⚠️ **Contrepartie ASSUMÉE ET ÉCRITE** : ajouter un *nouveau* réglage restera **une
 * migration**, donc un dev. Ces valeurs changent tous les quelques années, pas toutes les
 * semaines — c'est précisément le raisonnement qui a fait préférer des colonnes typées.
 *
 * ⇒ **Ne pas « compléter » ce schéma par symétrie avec `partner` ou `member`.** L'absence est
 * intentionnelle, et la garde ⑧ de `gate:reglages` la tient.
 *
 * ⚠️ **`TOURNOI_URL` N'EST PAS ICI, ET CE N'EST PAS UN OUBLI.** Le motif de la Story 6.13 était
 * *« c'est un domaine réel et stable, jamais un placeholder »* — **il est mort avec la Story
 * 9.4** : ce n'est plus un domaine du tout, mais la **route interne `/tournois`**. Le motif
 * actuel est plus fort : c'est un fait du code, au même titre que `/agenda`. La rendre
 * saisissable offrirait à un bénévole un moyen de **casser la navigation du site** depuis un
 * formulaire. Elle reste une constante de `lib/links.ts`, et la garde ⑪ de `gate:reglages` ne
 * la surveille pas — elle vérifie que les **six destinations saisissables** ont quitté ce
 * fichier, et `TOURNOI_URL` n'en a jamais fait partie.
 */

/**
 * Longueur maximale d'une URL de réglage.
 *
 * ⚠️ **Alignée sur `LINK_MAX` de `partner.ts` (300)**, et c'est le meilleur argument
 * disponible : c'est le même objet éditorial — une adresse de site saisie à la main — et
 * s'aligner sur une borne déjà en place vaut mieux qu'en inventer une seconde. Une invitation
 * Discord fait ~35 caractères, une page HelloAsso ~80.
 */
export const URL_MAX = 300;

/**
 * Longueur maximale de l'e-mail de contact.
 *
 * **254 est la borne de la RFC 5321** pour un chemin d'adresse (`<local@domaine>` tient dans
 * 256 octets, crochets compris). Choisie et non mesurée : la table n'a qu'une ligne, et sa
 * valeur actuelle fait 24 caractères.
 */
export const EMAIL_MAX = 254;

/**
 * Motif structurel de l'e-mail, **partagé avec le `CHECK` SQL**.
 *
 * 🔴 DÉLIBÉRÉMENT MINIMAL : « quelque chose, une arobase, quelque chose, un point, quelque
 * chose », sans espace. Valider une adresse e-mail « complètement » est un problème connu pour
 * n'avoir pas de bonne solution en expression régulière, et les motifs ambitieux **refusent des
 * adresses valides** — ce qui, sur le seul moyen de joindre l'association, coûte plus cher que
 * d'accepter une faute de frappe. La vraie validation d'une adresse est l'envoi d'un message.
 *
 * ⚠️ Il est **exporté** pour que la porte l'exerce LUI-MÊME plutôt qu'une copie de son contrat :
 * une porte qui réimplémente sa règle valide sa propre copie et reste verte le jour où le
 * produit diverge (`00 référence/pieges/garde-nominale.md`, doctrine `member.ts`).
 */
export const MOTIF_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Le **même** motif, écrit pour Postgres — consommé par le `CHECK`
 * `site_setting_contact_email_valide` (`server/db/schema.ts`).
 *
 * 🔴 IL VIT ICI, À CÔTÉ DE SON JUMEAU, ET C'EST LE POINT. Postgres n'a pas `\s` ; JS n'a pas
 * `[[:space:]]`. Ce ne sont donc pas deux copies d'un motif — ce sont **deux écritures de la
 * même règle**, et les mettre à un mètre l'une de l'autre est ce qui rend leur divergence
 * visible à la relecture. La garde ① de `gate:reglages` les confronte en plus **aux mêmes
 * valeurs**, pour que la parité soit *mesurée* et non affirmée.
 *
 * 🔴 `String.raw` EST OBLIGATOIRE. Dans un littéral ordinaire, `\.` est un échappement non
 * reconnu et s'évalue en `.` : Postgres recevrait un « n'importe quel caractère » et
 * `a@bXfr` passerait le `CHECK`. C'est le **piège du point**, mesuré en 6.5 puis en 6.10, et il
 * est **silencieux** — ni le lint, ni le typecheck, ni le build ne le voient.
 *
 * ⚠️ Les apostrophes font partie de la valeur : elle est insérée par `sql.raw()` dans le DDL.
 */
export const MOTIF_EMAIL_SQL = String.raw`'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'`;

/** Vrai si la valeur a la forme d'une adresse e-mail acceptée par ce site. */
export function estEmailValide(valeur: string): boolean {
  return MOTIF_EMAIL.test(valeur);
}

/**
 * Les réglages du site — **une seule ligne en base**, une colonne par réglage.
 *
 * 🔴 LES CINQ URL SONT FACULTATIVES ET LEUR ABSENCE EST LE CAS **NOMINAL** AU MERGE.
 * Les cinq destinations externes n'existent pas encore (dette **R29**, arbitrage de Brice du
 * 2026-07-31 : *« des placeholders que l'on renseignera à la toute fin du projet »*). Une
 * colonne vide n'est donc pas une dégradation : c'est l'état réel du projet, et le rendu doit
 * rester **honnête** — une destination absente ne rend **AUCUN lien** (ni `href`, ni focus, ni
 * annonce « nouvel onglet »), doctrine de la Story 5.5 qui a soldé la dette **R2**.
 *
 * 🔴 `contactEmail` EST LE SEUL CHAMP **OBLIGATOIRE**, et ce n'est pas une préférence de saisie :
 * un site qui n'offre **aucun** moyen d'être joint est pire qu'un site qui en offre un
 * imparfait. Le footer en fait son unique `mailto:`, et `SolicitationDialog` s'en sert de
 * **repli** quand le formulaire échoue (Story 5.1). Le vider casserait ce repli.
 *
 * ⚠️ **CE CHAMP N'EST PAS L'IDENTITÉ SMTP.** Le compte qui *envoie* les notifications est une
 * constante (`server/mail/client.ts`, `COMPTE_SMTP`) parce que le mot de passe d'application
 * Gmail y est lié : le rendre saisissable invaliderait l'authentification, et le découplage
 * envoi/persistance de la Story 5.1 rendrait la panne **totalement silencieuse**. Ce champ-ci
 * pilote l'adresse **publiée** et le **destinataire** des notifications, jamais l'expéditeur.
 */
export const siteSettingInputSchema = z.object({
  /** Invitation Discord de la communauté (PAS la porte des dates, FR19). */
  discordUrl: urlHttpOptionnelle(URL_MAX, "L'adresse du Discord"),
  /** Compte Instagram. */
  instagramUrl: urlHttpOptionnelle(URL_MAX, "L'adresse d'Instagram"),
  /** Compte X (ex-Twitter). */
  xUrl: urlHttpOptionnelle(URL_MAX, "L'adresse de X"),
  /** Page LinkedIn. */
  linkedinUrl: urlHttpOptionnelle(URL_MAX, "L'adresse de LinkedIn"),
  /**
   * Page d'adhésion HelloAsso.
   *
   * 🔴 Elle a valu `https://www.helloasso.com/` — la page d'accueil GÉNÉRIQUE — jusqu'à la
   * Story 5.5, et c'était le plus grave des cinq placeholders : une vraie URL `https`, donc
   * classée **sortante**, donc le CTA « Nous rejoindre » — celui du header à l'époque, retiré
   * par la 12.4 — ouvrait un nouvel onglet et
   * l'annonçait au lecteur d'écran, pour emmener le visiteur sur un site tiers **sans rapport
   * avec l'association**. Un placeholder est inerte ; cela était **actif et faux**. Ne jamais
   * re-semer une valeur « générique mais valide » dans cette colonne.
   */
  helloassoUrl: urlHttpOptionnelle(URL_MAX, "L'adresse HelloAsso"),
  /**
   * ⚠️ `.min(...)` COMPTERAIT DES UNITÉS DE CODE, PAS DES CARACTÈRES VISIBLES — leçon payée sur
   * `partner.name` puis `member.firstName`. Le `refine` sur `visiblementVide` rétablit le sens
   * de la règle, et il n'est pas redondant avec la base : `btrim` côté Postgres **ne retire pas**
   * les caractères de largeur nulle (leçon 6.3), donc Zod est **le seul** des deux à pouvoir
   * fermer ce cas.
   */
  // 🔴 `texteNettoye` et non `z.string().trim()` : c'est LE champ où un invisible collé fait
  // le plus de dégâts — cette valeur devient le `to:` d'une notification SMTP, et l'envoi
  // étant découplé de la persistance (Story 5.1), l'échec serait parfaitement silencieux.
  contactEmail: texteNettoye
    .max(EMAIL_MAX, `L'adresse e-mail ne peut pas dépasser ${EMAIL_MAX} caractères.`)
    .refine((value) => !visiblementVide(value), {
      message:
        "L'adresse e-mail de contact est obligatoire : c'est le seul moyen de joindre " +
        "l'association affiché sur le site.",
    })
    .refine((value) => estEmailValide(value), {
      message:
        "Cette adresse e-mail n'a pas une forme valide — il faut un nom, une arobase, " +
        "puis un domaine, par exemple contact@exemple.fr.",
    }),
});

export type SiteSettingInput = z.infer<typeof siteSettingInputSchema>;

/**
 * Les cinq clés d'URL, **dans l'ordre du formulaire**, avec leur libellé lisible.
 *
 * ⚠️ **DÉCLARÉE EN DONNÉES, ET C'EST VOLONTAIRE** : le formulaire, la Server Action et la porte
 * itèrent tous dessus. Une énumération recopiée à la main se désaligne au premier ajout — c'est
 * le défaut qu'`app/admin/_sections.ts` existe pour empêcher, et celui que la liste de portes de
 * `CLAUDE.md` §4 a déjà payé une fois.
 */
export const CHAMPS_URL = [
  { cle: "discordUrl", libelle: "Discord", aide: "L'invitation de la communauté." },
  { cle: "instagramUrl", libelle: "Instagram", aide: "L'adresse du compte." },
  { cle: "xUrl", libelle: "X", aide: "L'adresse du compte (ex-Twitter)." },
  { cle: "linkedinUrl", libelle: "LinkedIn", aide: "L'adresse de la page." },
  { cle: "helloassoUrl", libelle: "HelloAsso", aide: "La page d'adhésion de l'association." },
] as const satisfies readonly {
  cle: keyof Omit<SiteSettingInput, "contactEmail">;
  libelle: string;
  aide: string;
}[];
