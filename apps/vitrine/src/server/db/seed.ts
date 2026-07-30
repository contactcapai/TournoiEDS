/**
 * Jeu de données initial de l'agenda (Story 3.1).
 *
 *   pnpm --filter vitrine db:seed
 *
 * L'édition par l'équipe arrive en Epic 6 : d'ici là, ce script est la seule source de
 * données des surfaces agenda (3.2 hub home, 3.3 page Agenda).
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
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { gt, sql } from "drizzle-orm";
import postgres from "postgres";

import { PARIS_TZ, parisParts, parisWallClock, nextThursdays } from "../../lib/date-paris";
import { barInputSchema, eventInputSchema } from "../../lib/schemas/event";
import * as schema from "./schema";
import { bar, event, type NewBar, type NewEvent } from "./schema";

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
const targetHost = (() => {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return "";
  }
})();

if (!LOCAL_HOSTS.has(targetHost) && process.env.SEED_ALLOW_REMOTE !== "1") {
  console.error(
    `db:seed REFUSÉ : DATABASE_URL pointe vers « ${targetHost || "hôte illisible"} », qui n'est pas local.\n` +
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
