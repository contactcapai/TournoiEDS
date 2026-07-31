/**
 * Jeu de données initial : agenda (Story 3.1) et partenaires (Story 4.1).
 *
 *   pnpm --filter vitrine db:seed
 *
 * L'édition par l'équipe arrive en Epic 6 : d'ici là, ce script est la seule source de
 * données des surfaces agenda (3.2 hub home, 3.3 page Agenda) et preuve (4.1 bandeau,
 * 4.2 page Partenaires).
 *
 * ⚠️ DEUX NATURES DE DONNÉES COHABITENT ICI, et elles n'ont pas le même statut :
 *   - l'agenda est FICTIF mais plausible (bars et dates inventés) — d'où les gardes 2 et 3
 *     ci-dessous, qui existent pour qu'il ne soit jamais pris pour de vraies annonces ;
 *   - les partenaires sont RÉELS **par leur nom, leur catégorie et leur logo** : les
 *     11 entrées sont celles que les sources du projet attestent
 *     (`positionnement-refonte-site-v2.md` §5, maquette l.377-403).
 *     ⚠️ En revanche leurs `description` et `link` sont des **PLACEHOLDERS** depuis la
 *     Story 4.2 (arbitrage de Brice, 2026-07-31) : aucune source ne les porte, ils
 *     donnent à `/partenaires` sa forme réelle en attendant que l'équipe les saisisse
 *     au back-office (Story 6.5) — ce qui sera fait **avant toute mise en production
 *     officielle**. Détail et gardes dans l'encadré de `PARTNERS`, plus bas.
 * 🔴 La garde qui compte pour eux est INVERSE : n'insérer AUCUNE ambition. Le Département
 * de la Marne, la Région Grand Est, le Grand Reims et les villes avoisinantes sont des
 * cibles de démarchage (§6, FR33) — les semer ici les afficherait comme acquis sur la home.
 *
 * Trois propriétés voulues, et chacune est une garde :
 *
 * 1. 🔴 IDEMPOTENT — identifiants fixes et **upsert**. Deux exécutions donnent le même
 *    état, sans doublon. Un seed qui empile des doublons rendrait inexploitable toute
 *    mesure faite ensuite sur la base.
 * 2. 🔴 RELATIF À MAINTENANT, ET RAFRAÎCHISSANT — dates recalculées depuis `new Date()` à
 *    chaque exécution, puis **écrites** par `onConflictDoUpdate`.
 *    ⚠️ Un `onConflictDoNothing` aurait rendu ce script INERTE dès la seconde exécution :
 *    les dates seraient restées figées au premier seed, et « les 4 prochains jeudis »
 *    seraient tous passés au bout d'un mois — le hub se remettrait à afficher son état
 *    vide sur la base de développement dont on se sert tous les jours, en donnant à
 *    croire que le rendu est cassé. Défaut relevé DEUX FOIS en revue (Story 3.1) : être
 *    idempotent ne veut pas dire ne rien faire, mais converger vers le même état.
 * 3. 🔴 INOFFENSIF EN PRODUCTION — refus si `NODE_ENV === 'production'`. Ces bars et ces
 *    dates sont plausibles, donc dangereux : semés en production ils passeraient pour de
 *    vraies annonces.
 *
 * Les insertions passent par **Drizzle** et non par du SQL écrit à la main : le seed
 * éprouve ainsi le mapping runtime (`casing`, types, enum) et pas seulement le SQL de la
 * migration. Chaque enregistrement traverse le schéma **Zod** partagé avant insertion —
 * un garde-fou que personne n'appellerait avant l'Epic 6 serait décoratif.
 *
 * ⚠️ CE SCRIPT OUVRE SA PROPRE CONNEXION, et n'importe PAS `./client.ts` : celui-ci
 * commence par `import 'server-only'`, un module qui lève délibérément hors du bundler
 * Next (c'est tout son intérêt — Garde-fou n°1 de la Story 1.7). Un script CLI n'est pas
 * du code serveur Next. Le `casing: 'snake_case'` est donc à répéter ici, et il DOIT
 * rester identique à `client.ts` et `drizzle.config.ts`.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { gt, sql } from "drizzle-orm";
import postgres from "postgres";

import { PARIS_TZ, parisParts, parisWallClock, nextThursdays } from "../../lib/date-paris";
import { barInputSchema, eventInputSchema } from "../../lib/schemas/event";
import { partnerInputSchema } from "../../lib/schemas/partner";
import { photoInputSchema } from "../../lib/schemas/photo";
import * as schema from "./schema";
import {
  bar,
  event,
  partner,
  photo,
  type NewBar,
  type NewEvent,
  type NewPartner,
  type NewPhoto,
  type PartnerCategory,
} from "./schema";

// Comme `drizzle.config.ts` : un script hors Next ne charge pas `.env.local` tout seul.
config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(
    "DATABASE_URL manquante : renseigner apps/vitrine/.env.local (voir .env.example).\n" +
      "Postgres de dev : docker compose -f docker/docker-compose.dev.yml up -d",
  );
  process.exit(1);
}

/**
 * 🔴 LA GARDE PORTE SUR LA CIBLE, PAS SUR L'ENVIRONNEMENT DÉCLARÉ.
 *
 * Un `NODE_ENV === 'production'` seul serait un garde-fou en trompe-l'œil : `NODE_ENV`
 * n'est **pas** défini quand on lance un script pnpm à la main, y compris sur le VPS.
 * Quelqu'un qui débogue en production avec un `.env` pointant la vraie base publierait
 * six annonces fictives dans l'agenda réel sans jamais croiser l'avertissement.
 *
 * On vérifie donc un fait observable — **où** on est en train d'écrire — et on n'autorise
 * que les hôtes locaux. Refus par défaut : un hôte inconnu est traité comme distant.
 * Contournement possible et volontairement bruyant : `SEED_ALLOW_REMOTE=1`.
 *
 * Limite assumée : un tunnel SSH présente la production sur `localhost`. Cette garde
 * couvre le cas réaliste (chaîne de production, exécution sur le serveur), pas un
 * montage délibéré.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);
// ⚠️ On distingue « URL illisible » de « hôte vide mais URL parfaitement parsée » — les
// deux menaient au même message « hôte illisible », ce qui était TROMPEUR : une chaîne de
// connexion par socket Unix (`postgresql:///base?host=/var/run/postgresql`) se parse très
// bien et donne un `hostname` VIDE. Le refus reste le bon comportement (par défaut, un
// hôte non reconnu est traité comme distant), mais le diagnostic doit dire la vérité —
// sinon on cherche une faute de frappe dans une URL qui n'en a pas. Relevé à la revue.
const cible = (() => {
  try {
    return { hote: new URL(databaseUrl).hostname, lisible: true };
  } catch {
    return { hote: "", lisible: false };
  }
})();
const targetHost = cible.hote;
const descriptionCible = !cible.lisible
  ? "URL illisible"
  : targetHost === ""
    ? "hôte vide (socket Unix ?)"
    : targetHost;

if (!LOCAL_HOSTS.has(targetHost) && process.env.SEED_ALLOW_REMOTE !== "1") {
  console.error(
    `db:seed REFUSÉ : DATABASE_URL pointe vers « ${descriptionCible} », qui n'est pas local.\n` +
      "Ces données sont fictives mais plausibles — semées ailleurs qu'en développement, elles\n" +
      "passeraient pour de vraies annonces publiées.\n" +
      "Postgres de dev : docker compose -f docker/docker-compose.dev.yml up -d\n" +
      "Si c'est réellement voulu : SEED_ALLOW_REMOTE=1 pnpm --filter vitrine db:seed",
  );
  process.exit(1);
}

// Défense en profondeur : si l'environnement se déclare production, on s'arrête même sur
// un hôte local.
if (process.env.NODE_ENV === "production") {
  console.error("db:seed refuse de tourner avec NODE_ENV=production : ces données sont fictives.");
  process.exit(1);
}

/**
 * Identifiants FIXES — c'est ce qui rend le script idempotent. Ne pas les régénérer :
 * de nouveaux uuid feraient de la seconde exécution un doublon silencieux.
 */
const BAR_IDS = {
  tapCorner: "b0000000-0000-4000-8000-000000000001",
  partenaire2: "b0000000-0000-4000-8000-000000000002",
  cavesJaures: "b0000000-0000-4000-8000-000000000003",
  comptoirSacres: "b0000000-0000-4000-8000-000000000004",
} as const;

const EVENT_IDS = {
  thursday1: "e0000000-0000-4000-8000-000000000001",
  thursday2: "e0000000-0000-4000-8000-000000000002",
  thursday3: "e0000000-0000-4000-8000-000000000003",
  thursday4: "e0000000-0000-4000-8000-000000000004",
  special: "e0000000-0000-4000-8000-000000000005",
  past: "e0000000-0000-4000-8000-000000000006",
  past2: "e0000000-0000-4000-8000-000000000007",
  past3: "e0000000-0000-4000-8000-000000000008",
  past4: "e0000000-0000-4000-8000-000000000009",
} as const;

/**
 * Partenaires (Story 4.1). Identifiants fixes, même raison que ci-dessus.
 * Préfixe `p` pour rester lisible à côté des `b` (bars) et `e` (événements).
 */
const PARTNER_IDS = {
  shopForGeek: "a0000000-0000-4000-8000-000000000001",
  ldlc: "a0000000-0000-4000-8000-000000000002",
  forgeblast: "a0000000-0000-4000-8000-000000000003",
  antreDeReims: "a0000000-0000-4000-8000-000000000004",
  mately: "a0000000-0000-4000-8000-000000000005",
  mosellan: "a0000000-0000-4000-8000-000000000006",
  mulhouseGaming: "a0000000-0000-4000-8000-000000000007",
  reimsLegendR: "a0000000-0000-4000-8000-000000000008",
  villeDeReims: "a0000000-0000-4000-8000-000000000009",
  gameInReims: "a0000000-0000-4000-8000-00000000000a",
  franceEsport: "a0000000-0000-4000-8000-00000000000b",
} as const;

/**
 * Photos de la galerie (Story 4.3). Identifiants fixes, même raison que ci-dessus.
 *
 * ⚠️ Préfixe `c` comme « cliché » : `p` de photo n'est pas un chiffre hexadécimal, ce qui
 * est déjà la raison pour laquelle les partenaires portent `a` et non `p`.
 */
const PHOTO_IDS = {
  soireeBar: "c0000000-0000-4000-8000-000000000001",
  brouillon: "c0000000-0000-4000-8000-000000000002",
} as const;

/**
 * 🔴 UNE SEULE PHOTO RÉELLE, ET C'EST L'ÉTAT HONNÊTE DU PROJET.
 *
 * `soiree-bar-eds-01.avif` est le **seul** fichier fourni à ce jour (2026-07-28,
 * « c'est juste pour faire le smoke »). Les dettes R4 / R15 attendent toujours les
 * originaux haute définition.
 *
 * L'arbitrage de cadrage du 2026-07-31 (Brice) est de **scinder par résolution** : cette
 * photo est insuffisante pour le hero (~950px après recadrage) et hors de portée pour la
 * bande citation (~1920px), mais **suffisante pour une vignette de scrapbook**. Mesuré,
 * pas supposé : 922×480, recadré en 4/3 par le cadre ⇒ 640×480 utiles ; une vignette de
 * 276px CSS en 2× demande 552×414 utiles, soit une variante pleine largeur de **796px**
 * pour une source de 922. Ça passe, avec 126px de marge — et **pas en 3×**, où il en
 * faudrait 1194. Limite déclarée, pas tue.
 *
 * ⚠️ NE PAS SEMER LA MÊME IMAGE SOUS PLUSIEURS NOMS pour « remplir » la galerie. Une
 * grille de quatre fois la même photo ne dit rien de la vie de l'asso, et donnerait au
 * gate visuel un rendu que la production n'aura jamais. La galerie affiche ce qu'il y a.
 *
 * 🔴 LE FICHIER ET LA LIGNE SONT UN SEUL GESTE. Semer une ligne dont le fichier n'est pas
 * sur le volume produit une galerie de 404 — la base et le disque doivent être peuplés
 * ensemble. Procédure dans le README de la vitrine (§ Médias).
 */
const PHOTOS = [
  {
    id: PHOTO_IDS.soireeBar,
    filename: "soiree-bar-eds-01.avif",
    /**
     * ⚠️ DESCRIPTION, PAS LÉGENDE. Repris tel quel du câblage du hero (Story 2.1) :
     * c'est la même image, elle se décrit de la même façon. La légende ci-dessous, elle,
     * commente — les deux ne sont pas interchangeables (voir `lib/schemas/photo.ts`).
     */
    alt:
      "Une soirée Esport des Sacres dans un bar rémois : des joueurs attablés devant un " +
      "écran de jeu, sous le kakémono de l'association.",
    caption: "Entre deux games",
    /**
     * Rattachée au jeudi passé le plus récent ⇒ `/agenda` rend UNE vignette avec photo
     * réelle et TROIS avec le placeholder (dette R25). C'est délibéré : sans au moins un
     * passé sans photo, personne ne verrait jamais l'état de repli, qui est pourtant le
     * cas majoritaire. Même raisonnement que le passé sans compte-rendu semé en 3.3.
     */
    eventId: EVENT_IDS.past,
    sortOrder: 0,
    isPublished: true,
  },
  {
    id: PHOTO_IDS.brouillon,
    /**
     * 🔴 TÉMOIN PERMANENT DE LA GARDE D'ÉNUMÉRATION : une ligne NON PUBLIÉE. La route de
     * service doit lui répondre **404 et non 403** — un 403 confirmerait son existence et
     * ferait de `/medias/` un moyen d'énumérer les brouillons du back-office (6.4).
     *
     * ⚠️ Son fichier n'est PAS sur le volume, donc ce témoin exerce **deux** gardes à la
     * fois (non publiée ET absente) : à lui seul il ne prouve pas laquelle a répondu.
     * La preuve ISOLÉE se fait en basculant `is_published` sur la photo réelle — même
     * nom, même fichier, une seule variable qui change. Les deux se complètent : celui-ci
     * vit dans le seed en permanence, l'autre est une manipulation de mesure.
     */
    filename: "brouillon-non-publie.avif",
    alt: "Photo en préparation, jamais servie publiquement.",
    caption: null,
    eventId: null,
    sortOrder: 10,
    isPublished: false,
  },
] as const;

/**
 * Les 11 partenaires RÉELS attestés par les sources du projet.
 *
 * 🔴 CE QUI N'EST PAS DANS CETTE LISTE EST AUSSI IMPORTANT QUE CE QUI Y EST.
 * `positionnement-refonte-site-v2.md` §6 distingue explicitement la preuve de l'ambition :
 * le Département de la Marne, la Région Grand Est, le Grand Reims et les villes
 * avoisinantes sont des cibles de démarchage, PAS des soutiens. Les ajouter ici les
 * afficherait comme acquis (FR33) — ne pas le faire, même « en attendant ».
 * ⚠️ Cette garde vit ici aujourd'hui parce que ce script est le seul point d'écriture.
 * Avec le back-office (Story 6.5) elle devra AUSSI être rappelée au point de SAISIE : un
 * commentaire dans un fichier que le bénévole ne lira jamais ne protège rien.
 *
 * `logo` : seuls les 4 SPONSORS en ont un — ce sont les 4 fichiers que porte déjà le
 * carrousel du tournoi, copiés (jamais déplacés) dans `public/partenaires/`.
 * ⚠️ L'ATTRIBUTION A ÉTÉ ÉTABLIE PAR L'IMAGE, PAS PAR LE NOM DE FICHIER : deux des
 * sources s'appellent `Fichier 3.webp` et `LOGO-V3-BLANC (1).webp`, et les deux logos
 * blancs sont invisibles sur fond clair — il a fallu les composer sur `--navy` pour les
 * identifier (refait et confirmé au dev). Ne jamais réattribuer d'après un nom de fichier.
 * Les 7 autres entrées ont `logo: null` : elles sont donc ABSENTES du bandeau de la home
 * (arbitrage Brice : mieux vaut un logo manquant qu'un placeholder) et seront documentées
 * sur `/partenaires` (Story 4.2).
 *
 * 🔴 `description` ET `link` SONT DES PLACEHOLDERS ASSUMÉS (arbitrage de Brice, 2026-07-31,
 * Story 4.2) — À REMPLACER PAR L'ÉQUIPE VIA LE BACK-OFFICE (Story 6.5).
 *
 * AUCUNE source du projet ne porte d'URL ni de descriptif de partenaire : ces valeurs ne
 * sont donc PAS des faits, elles servent à donner à la page `/partenaires` sa forme réelle
 * (grille, alignement, tuiles cliquables) au lieu d'un mur de noms nus. Motif donné par
 * Brice : « c'est juste pour voir ce que ça donne visuellement, je mettrai à jour via le
 * back-office ».
 *
 * ⚠️ DEUX GARDES QUI NE COÛTENT RIEN ET QU'IL NE FAUT PAS RETIRER :
 *   1. les URLs sont toutes en **`exemple-*.fr`**, un domaine qui ne résout pas. Un
 *      placeholder qui ressemble à une vraie URL finit par être pris pour une vraie — et
 *      un lien faux vers un VRAI site tiers serait pire encore ;
 *   2. les descriptifs restent **neutres et factuels** : aucun n'attribue à un tiers un
 *      engagement qu'il n'a pas pris, et aucun ne présente une ambition comme acquise
 *      (**FR33**). Ce sont des phrases de forme, pas des affirmations à défendre.
 * ⚠️ Les DEUX descriptions de `participation` (« Présents depuis 2023 », « Association
 * adhérente ») ne sont PAS des placeholders : elles sont verbatim de la maquette (l.379,
 * l.383) et disent la nature réelle du lien. Ne pas les réécrire.
 *
 * `sortOrder` : l'ordre de cette liste À L'INTÉRIEUR de chaque catégorie. La valeur est
 * écrite en clair plutôt que déduite de l'index du tableau — c'est une donnée que l'équipe
 * modifiera depuis le back-office (FR22), pas une position de code.
 */
const PARTNERS: ReadonlyArray<{
  id: string;
  name: string;
  category: PartnerCategory;
  logo: string | null;
  description: string | null;
  /** ⚠️ Placeholder `exemple-*.fr` — voir l'encadré ci-dessus. Jamais une vraie URL tierce. */
  link: string | null;
  sortOrder: number;
}> = [
  // ── Sponsors : les 4 qui ont un logo, donc les 4 seuls visibles sur la home ────
  {
    id: PARTNER_IDS.shopForGeek,
    name: "Shop for Geek Reims",
    category: "sponsor",
    logo: "/partenaires/shop-for-geek-reims.webp",
    description:
      "Boutique de jeux, figurines et cartes à collectionner, au cœur de Reims.",
    link: "https://exemple-shopforgeek.fr",
    sortOrder: 1,
  },
  {
    id: PARTNER_IDS.ldlc,
    name: "LDLC Cormontreuil",
    category: "sponsor",
    logo: "/partenaires/ldlc-cormontreuil.webp",
    description:
      "Matériel informatique et périphériques gaming.",
    link: "https://exemple-ldlc.fr",
    sortOrder: 2,
  },
  {
    id: PARTNER_IDS.forgeblast,
    name: "Forgeblast",
    category: "sponsor",
    logo: "/partenaires/forgeblast.webp",
    description:
      "Studio rémois de production et de création de contenu autour du jeu vidéo compétitif, présent sur nos temps forts depuis les premières éditions.",
    link: "https://exemple-forgeblast.fr",
    sortOrder: 3,
  },
  {
    id: PARTNER_IDS.antreDeReims,
    name: "L'Antre de Reims",
    category: "sponsor",
    logo: "/partenaires/l-antre-de-reims.webp",
    description:
      "Bar à jeux du centre-ville, l'une des étapes du roulement des jeudis.",
    link: "https://exemple-antre.fr",
    sortOrder: 4,
  },
  // ── Partenaires réseau : pas de logo fourni ⇒ absents du bandeau ───────────────
  {
    id: PARTNER_IDS.mately,
    name: "Mately",
    category: "partenaire",
    logo: null,
    description:
      "Association partenaire sur le réseau Grand Est.",
    link: "https://exemple-mately.fr",
    sortOrder: 1,
  },
  {
    id: PARTNER_IDS.mosellan,
    name: "Mosel'lan Project",
    category: "partenaire",
    logo: null,
    description:
      "Organisateur de LAN et de rencontres joueurs en Moselle.",
    link: "https://exemple-mosellan.fr",
    sortOrder: 2,
  },
  {
    id: PARTNER_IDS.mulhouseGaming,
    name: "Mulhouse Gaming",
    category: "partenaire",
    logo: null,
    description:
      "Association esport alsacienne, avec qui nous croisons régulièrement nos événements.",
    link: "https://exemple-mulhousegaming.fr",
    sortOrder: 3,
  },
  // ── Soutiens : appuis RÉELS et déjà acquis, jamais une collectivité démarchée ──
  {
    id: PARTNER_IDS.reimsLegendR,
    name: "Reims Legend'R",
    category: "soutien",
    logo: null,
    description:
      "Collectif rémois de passionnés.",
    link: "https://exemple-legendr.fr",
    sortOrder: 1,
  },
  {
    id: PARTNER_IDS.villeDeReims,
    name: "Ville de Reims",
    category: "soutien",
    logo: null,
    description:
      "Soutien de la collectivité aux initiatives associatives locales.",
    link: "https://exemple-reims.fr",
    sortOrder: 2,
  },
  // ── Participations : ni sponsors ni partenaires — la nuance est factuelle (FR33) ─
  // Ces deux `description` sont VERBATIM de la maquette (l.379, l.383) : elles disent
  // exactement la nature du lien, ce qui est tout l'objet de cette catégorie.
  {
    id: PARTNER_IDS.gameInReims,
    name: "Game in Reims",
    category: "participation",
    logo: null,
    description: "Présents depuis 2023",
    link: "https://exemple-gameinreims.fr",
    sortOrder: 1,
  },
  {
    id: PARTNER_IDS.franceEsport,
    name: "France Esport",
    category: "participation",
    logo: null,
    description: "Association adhérente",
    link: "https://exemple-franceesport.fr",
    sortOrder: 2,
  },
];

/**
 * Jeudis PASSÉS supplémentaires (Story 3.3).
 *
 * 🔴 QUATRE passés, et ce nombre n'est pas décoratif : la section « déjà passé » de
 * `/agenda` est un carrousel **borné à 4**. Avec un seul passé (état du seed jusqu'ici),
 * ni le gate visuel ni la porte outillée ne verraient jamais un carrousel se comporter
 * en carrousel — on livrerait un composant de défilement que personne n'a vu défiler.
 *
 * `past3` est délibérément **sans `recap`** : il éprouve la règle « un passé sans
 * compte-rendu reste affiché — il prouve l'activité — mais sans bloc vide ». C'est le
 * pendant, côté passés, de ce que `thursday2` fait pour `games`.
 */
const PAST_EXTRA = [
  {
    id: EVENT_IDS.past2,
    weeksAgo: 2,
    barId: BAR_IDS.cavesJaures,
    title: "Jeudi jeux — Les Caves Jaurès",
    games: "Rocket League, Smash Bros",
    description: "Soirée versus dans la salle du fond.",
    recap:
      "Deux heures de Rocket League à quatre, puis un Smash improvisé jusqu'à la fermeture. Le bar a sorti une seconde table quand on a manqué de place.",
  },
  {
    id: EVENT_IDS.past3,
    weeksAgo: 3,
    barId: BAR_IDS.comptoirSacres,
    title: "Jeudi jeux — Le Comptoir des Sacres",
    games: "TFT",
    description: "Format calme, plutôt discussion et découverte.",
    // `recap` ABSENT et c'est voulu — voir le commentaire ci-dessus.
    recap: null,
  },
  {
    id: EVENT_IDS.past4,
    weeksAgo: 4,
    barId: BAR_IDS.tapCorner,
    title: "Jeudi jeux — Le Tap Corner",
    games: "Mario Kart, Just Dance",
    description: "La soirée la plus familiale du mois.",
    recap:
      "Beaucoup de nouvelles têtes, dont deux qui n'avaient jamais touché une manette. On a fini sur un Just Dance à six.",
  },
] as const;

/**
 * Quatre bars rémois pour le roulement (FR2).
 * ⚠️ Noms et adresses PROVISOIRES : les accords ne sont pas figés. « Bar partenaire #2 »
 * est le libellé d'attente prévu par UX-DR11 — il doit rester lisible sans casser le
 * rendu, et cette entrée est là pour l'éprouver.
 */
const BARS: NewBar[] = [
  {
    id: BAR_IDS.tapCorner,
    name: "Le Tap Corner",
    address: "12 rue de Mars",
    district: "Boulingrin",
    city: "Reims",
  },
  {
    id: BAR_IDS.partenaire2,
    name: "Bar partenaire #2",
    address: "Adresse à confirmer",
    district: "Centre-ville",
    city: "Reims",
  },
  {
    id: BAR_IDS.cavesJaures,
    name: "Les Caves Jaurès",
    address: "48 avenue Jean Jaurès",
    district: "Jean Jaurès",
    city: "Reims",
  },
  {
    id: BAR_IDS.comptoirSacres,
    name: "Le Comptoir des Sacres",
    address: "3 place Drouet-d'Erlon",
    district: "Erlon",
    city: "Reims",
  },
];

const THURSDAY_ROTATION = [
  {
    id: EVENT_IDS.thursday1,
    barId: BAR_IDS.tapCorner,
    title: "Jeudi jeux — Le Tap Corner",
    games: "Smash Bros, TFT, Mario Kart",
    description:
      "On installe les écrans en fond de salle, on joue, on discute. Viens seul ou à plusieurs, avec ou sans manette.",
  },
  {
    id: EVENT_IDS.thursday2,
    barId: BAR_IDS.partenaire2,
    title: "Jeudi jeux — Bar partenaire #2",
    // `games` volontairement absent : éprouve la règle « ligne masquée plutôt que
    // placeholder vide » que la Story 3.2 devra tenir (UX-DR10).
    games: null,
    description:
      "Le lieu se confirme, la soirée est calée. On annonce le bar sur Discord dès que c'est signé.",
  },
  {
    id: EVENT_IDS.thursday3,
    barId: BAR_IDS.cavesJaures,
    title: "Jeudi jeux — Les Caves Jaurès",
    games: "Rocket League, Street Fighter 6",
    description:
      "Soirée versus : on monte deux postes en tournoi improvisé, sans classement ni pression.",
  },
  {
    id: EVENT_IDS.thursday4,
    barId: BAR_IDS.comptoirSacres,
    title: "Jeudi jeux — Le Comptoir des Sacres",
    games: "TFT, Just Dance",
    description: "Grande salle, grand écran. Le format le plus familial du roulement.",
  },
] as const;

/** Valide via le schéma partagé, puis renvoie la ligne prête à insérer. */
function validatedEvent({ id, ...input }: Omit<NewEvent, "id"> & { id: string }): NewEvent {
  return { id, ...eventInputSchema.parse(input) };
}

/**
 * Idem pour un partenaire. 🔴 LE SEED EST LE SEUL CONSOMMATEUR DE `partnerInputSchema`
 * jusqu'à la Story 6.5 : sans cet appel, le schéma serait un commentaire — un garde-fou
 * que personne n'exécute ne garde rien (leçon relevée en Story 3.1).
 */
function validatedPartner({ id, ...input }: Omit<NewPartner, "id"> & { id: string }): NewPartner {
  return { id, ...partnerInputSchema.parse(input) };
}

/**
 * Idem pour une photo. Le seed est le seul consommateur de `photoInputSchema` jusqu'à la
 * Story 6.4 — et c'est ce qui empêche le schéma d'être un commentaire.
 * ⚠️ Il éprouve donc aussi le `CHECK photo_filename_safe` : un nom de fichier que Zod
 * accepterait mais que la base refuse ferait échouer le seed, ce qui est exactement le
 * signal voulu si les deux règles venaient à diverger.
 */
function validatedPhoto({ id, ...input }: Omit<NewPhoto, "id"> & { id: string }): NewPhoto {
  return { id, ...photoInputSchema.parse(input) };
}

async function main() {
  const client = postgres(databaseUrl!, { prepare: false, max: 1 });
  // MÊME `casing` que `client.ts` et `drizzle.config.ts`, sinon ce script écrirait dans
  // des colonnes qui n'existent pas. `schema` est passé pour que `db.query.*` — utilisé
  // plus bas pour relire ce qui a réellement été écrit — soit disponible.
  const db = drizzle(client, { schema, casing: "snake_case" });

  try {
    const now = new Date();
    const thursdays = nextThursdays(THURSDAY_ROTATION.length, { from: now, hour: 19 });
    const today = parisParts(now);
    // Le temps fort : le samedi qui suit le dernier jeudi du roulement (jeudi + 9 jours).
    const lastThursday = parisParts(thursdays[thursdays.length - 1]!);

    const barRows = BARS.map(({ id, ...rest }) => ({ id, ...barInputSchema.parse(rest) }));

    const partnerRows: NewPartner[] = PARTNERS.map((p) =>
      validatedPartner({ ...p, isPublished: true }),
    );

    // ⚠️ Contrairement aux partenaires, `isPublished` n'est PAS force ici : la liste porte
    // deliberement une entree non publiee (temoin de la garde d'enumeration de la route
    // de service). L'ecraser viderait ce temoin de son sens.
    const photoRows: NewPhoto[] = PHOTOS.map((p) => validatedPhoto({ ...p }));

    const eventRows: NewEvent[] = [
      ...THURSDAY_ROTATION.map((thursday, index) =>
        validatedEvent({
          id: thursday.id,
          type: "thursday",
          title: thursday.title,
          barId: thursday.barId,
          startsAt: thursdays[index]!,
          games: thursday.games,
          description: thursday.description,
          isPublished: true,
        }),
      ),
      // Temps fort SANS bar : éprouve la FK nullable et la branche « lieu libre » du CHECK.
      validatedEvent({
        id: EVENT_IDS.special,
        type: "special",
        title: "Game in Reims — stand Esport des Sacres",
        barId: null,
        venueName: "Parc des expositions de Reims",
        venueAddress: "Route de Cernay, Reims",
        startsAt: parisWallClock(lastThursday.year, lastThursday.month, lastThursday.day + 9, 10),
        games: "Initiation tous publics",
        description:
          "Deux jours de salon, un stand tenu par les bénévoles : initiation, démonstrations, et de quoi discuter avec l'asso.",
        isPublished: true,
      }),
      // Jeudis PASSÉS supplémentaires (Story 3.3) — dates RELATIVES à aujourd'hui,
      // comme tout le reste du seed : elles restent donc dans le passé à chaque
      // exécution, sans jamais dériver vers le futur.
      ...PAST_EXTRA.map((p) =>
        validatedEvent({
          id: p.id,
          type: "thursday",
          title: p.title,
          barId: p.barId,
          startsAt: parisWallClock(today.year, today.month, today.day - 7 * p.weeksAgo, 19),
          games: p.games,
          description: p.description,
          recap: p.recap,
          isPublished: true,
        }),
      ),
      // Jeudi PASSÉ avec compte-rendu : matière de la section « passés » de la 3.3 (FR5).
      validatedEvent({
        id: EVENT_IDS.past,
        type: "thursday",
        title: "Jeudi jeux — Le Tap Corner",
        barId: BAR_IDS.tapCorner,
        startsAt: parisWallClock(today.year, today.month, today.day - 7, 19),
        games: "Smash Bros, TFT",
        description: "Première soirée du roulement de la saison.",
        recap:
          "Salle pleine à partir de 20h, deux écrans qui ne se sont pas arrêtés, et trois nouvelles têtes qui sont restées jusqu'à la fermeture. On rempile au même endroit le mois prochain.",
        isPublished: true,
      }),
    ];

    // Upsert : sur conflit d'identifiant, on RÉÉCRIT les champs que ce script possède.
    // `created_at` est délibérément absent des colonnes mises à jour (il date la première
    // insertion) ; `updated_at` est repositionné pour que la trace reflète la réécriture.
    await db
      .insert(bar)
      .values(barRows)
      .onConflictDoUpdate({
        target: bar.id,
        set: {
          name: sql`excluded.name`,
          address: sql`excluded.address`,
          district: sql`excluded.district`,
          city: sql`excluded.city`,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(partner)
      .values(partnerRows)
      .onConflictDoUpdate({
        target: partner.id,
        set: {
          name: sql`excluded.name`,
          logo: sql`excluded.logo`,
          description: sql`excluded.description`,
          link: sql`excluded.link`,
          category: sql`excluded.category`,
          sortOrder: sql`excluded.sort_order`,
          isPublished: sql`excluded.is_published`,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(event)
      .values(eventRows)
      .onConflictDoUpdate({
        target: event.id,
        set: {
          type: sql`excluded.type`,
          title: sql`excluded.title`,
          barId: sql`excluded.bar_id`,
          venueName: sql`excluded.venue_name`,
          venueAddress: sql`excluded.venue_address`,
          startsAt: sql`excluded.starts_at`,
          games: sql`excluded.games`,
          description: sql`excluded.description`,
          recap: sql`excluded.recap`,
          isPublished: sql`excluded.is_published`,
          updatedAt: new Date(),
        },
      });

    // 🔴 APRES `event` ET JAMAIS AVANT : `photo.event_id` porte une cle etrangere vers
    // `event`. Semer les photos en premier violerait la contrainte des la premiere
    // execution sur une base vierge — l'ordre des trois `insert` ci-dessus est donc une
    // dependance, pas une preference de lecture.
    await db
      .insert(photo)
      .values(photoRows)
      .onConflictDoUpdate({
        target: photo.id,
        set: {
          filename: sql`excluded.filename`,
          alt: sql`excluded.alt`,
          caption: sql`excluded.caption`,
          eventId: sql`excluded.event_id`,
          sortOrder: sql`excluded.sort_order`,
          isPublished: sql`excluded.is_published`,
          updatedAt: new Date(),
        },
      });

    // 🔴 ON RELIT LA BASE POUR RENDRE COMPTE, on n'affiche pas ce qu'on croit avoir écrit.
    // Réafficher `eventRows` (les valeurs en mémoire) donnerait à voir des dates fraîches
    // même si rien n'avait été persisté — un faux témoin, exactement le motif de
    // `00 référence/pieges/faux-succes.md`.
    const stored = await db.query.event.findMany({
      with: { bar: true },
      orderBy: (table, { asc }) => asc(table.startsAt),
    });

    const counts = {
      bars: await db.$count(bar),
      events: await db.$count(event),
      upcoming: await db.$count(event, gt(event.startsAt, now)),
    };

    console.log("Seed agenda terminé (idempotent, dates rafraîchies) :", counts);
    for (const row of stored) {
      const when = row.startsAt.toLocaleString("fr-FR", {
        timeZone: PARIS_TZ,
        dateStyle: "full",
        timeStyle: "short",
      });
      const where = row.bar?.name ?? row.venueName ?? "?";
      console.log(`  ${when}  ${row.title}  [${where}]`);
    }

    // 🔴 MÊME PRINCIPE POUR LES PARTENAIRES : on relit, on ne réaffiche pas `partnerRows`.
    // Le décompte « avec logo » est la PREUVE d'AC6 — c'est lui qui dit combien de tuiles
    // le bandeau de la home peut rendre. Un décompte calculé sur les valeurs en mémoire
    // serait vrai même si rien n'avait été persisté (`pieges/faux-succes.md`).
    const storedPartners = await db.query.partner.findMany({
      orderBy: (table, { asc }) => [asc(table.category), asc(table.sortOrder), asc(table.name)],
    });
    const withLogo = storedPartners.filter((p) => p.logo !== null);
    const byCategory = storedPartners.reduce<Record<string, number>>((acc, p) => {
      acc[p.category] = (acc[p.category] ?? 0) + 1;
      return acc;
    }, {});

    console.log(
      `\nSeed partenaires terminé : ${storedPartners.length} entrées, ` +
        `dont ${withLogo.length} AVEC LOGO (= le nombre de tuiles du bandeau de la home).`,
    );
    console.log("  par catégorie :", byCategory);
    for (const p of storedPartners) {
      const publie = p.isPublished ? "publié" : "NON PUBLIÉ";
      console.log(
        `  [${p.category}] ${p.name} — ${p.logo ?? "pas de logo (absent du bandeau)"} (${publie})`,
      );
    }

    // 🔴 MÊME PRINCIPE POUR LES PHOTOS : on relit, et on rend compte de DEUX faits que
    // personne d'autre ne dira — combien de vignettes la galerie peut rendre, et si le
    // FICHIER est réellement sur le volume. Une ligne sans fichier produit un 404 à
    // l'affichage : c'est le seul défaut de cette table qu'aucune contrainte ne peut
    // attraper, puisqu'il vit hors de la base (`pieges/faux-succes.md`).
    const storedPhotos = await db.query.photo.findMany({
      orderBy: (table, { asc }) => [asc(table.sortOrder), asc(table.id)],
    });
    const racineMedias = process.env.MEDIA_DIR;
    console.log(
      `
Seed photos terminé : ${storedPhotos.length} entrées, ` +
        `dont ${storedPhotos.filter((p) => p.isPublished).length} PUBLIÉE(S) ` +
        `(= le nombre de vignettes de la galerie).`,
    );
    for (const p of storedPhotos) {
      const publie = p.isPublished ? "publiée" : "NON PUBLIÉE";
      let fichier = "MEDIA_DIR non renseignée — impossible de vérifier";
      if (racineMedias) {
        const chemin = path.resolve(racineMedias, p.filename);
        fichier = existsSync(chemin) ? "fichier présent" : "🔴 FICHIER ABSENT DU VOLUME";
      }
      const rattachement = p.eventId ? "rattachée à un événement" : "sans événement";
      console.log(`  ${p.filename} — ${publie}, ${rattachement}, ${fichier}`);
    }
    if (racineMedias) {
      const manquantes = storedPhotos.filter(
        (p) => p.isPublished && !existsSync(path.resolve(racineMedias, p.filename)),
      );
      if (manquantes.length > 0) {
        console.log(
          `
⚠️ ${manquantes.length} photo(s) PUBLIÉE(S) sans fichier sur le volume : la ` +
            `galerie rendra autant de 404.
   Copier les fichiers dans ${racineMedias} ` +
            `(voir README de la vitrine, § Médias).`,
        );
      }
    }
  } finally {
    await client.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Seed agenda ÉCHOUÉ :", error);
    process.exit(1);
  });
