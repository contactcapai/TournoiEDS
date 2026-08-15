// 🗺️ LA CARTE DES PORTES — « je touche à ça, je passe quoi ? »
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 POURQUOI CE N'EST PAS UNE LISTE, ET POURQUOI ÇA COMPTE
// ══════════════════════════════════════════════════════════════════════════════════════
//
// Ce projet a déjà payé QUATRE fois le même défaut : une énumération alignée à la main se
// désaligne à l'ajout suivant, en silence (`_sections.ts`, `CHAMPS_URL`, la couverture
// d'autotest de `gate:reseaux`, et le tableau des portes du README — **deux fois**, le
// 2026-08-05 puis le 2026-08-14). Écrire une 5ᵉ liste à la main serait payer le garde-fou
// au lieu de corriger la source.
//
// D'où la règle de construction, et elle est le livrable autant que la sortie :
//
//   · ce qui peut se DÉRIVER se dérive          → la liste des portes vient de `package.json` ;
//                                                  l'accès base vient de la LECTURE du source ;
//   · ce qui ne peut pas se dériver se DÉCLARE  → la surface et l'effet, dans le fichier de la
//                                                  porte elle-même (ça vit et meurt avec elle) ;
//   · et la déclaration est CONTRE-VÉRIFIÉE     → une porte qui se déclare `lecture` alors que
//                                                  son source ouvre une connexion Postgres est
//                                                  un ROUGE. C'est la garde anti-dérive : la
//                                                  déclaration ne peut plus mentir en silence.
//
// ⚠️ CE FICHIER NE MESURE PAS LE PRODUIT — il mesure l'OUTILLAGE. Son rouge n'accuse jamais
// le site : il dit qu'une porte est mal déclarée, absente, ou privée d'environnement. C'est
// la leçon n°1 de la rétro Epic 6 (~17 instruments faux, TOUS accusant le produit) appliquée
// par construction : ici, l'instrument ne PEUT accuser que l'instrumentation.
//
// Usage :  pnpm --filter vitrine gate:list            → toutes les portes
//          pnpm --filter vitrine gate:list agenda     → filtre sur le nom ou la surface
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE_APP = join(ICI, "..", "..");

// Vocabulaire FERMÉ des effets. Un mot hors de cette table est un rouge : sans quoi la
// déclaration dériverait vers du texte libre, et on retomberait sur une liste à la main.
// ⚠️ UN SEUL AXE PAR CHAMP. `effet` dit ce que la porte ÉCRIT, `tiers` dit à quoi elle parle.
// Les mélanger (une valeur « bac-à-sable » dans `effet`) rendait `gate:reseaux` indéclarable :
// elle écrit en base ET fabrique son propre n8n — deux faits indépendants, deux champs.
const EFFETS = {
  lecture: { icone: "👁️ ", texte: "lit seulement (HTTP)", ecrit: false },
  base: { icone: "✍️ ", texte: "écrit en BASE", ecrit: true },
  "base+disque": { icone: "✍️💾", texte: "écrit en BASE et sur le DISQUE", ecrit: true },
  sortant: { icone: "📤", texte: "SORT du système (e-mail, tiers réel)", ecrit: true },
};

const TIERS = {
  aucun: "",
  faux: " · 📦 fabrique son propre tiers",
  reel: " · 🔴 parle à un tiers RÉEL",
};

const scripts = JSON.parse(readFileSync(join(RACINE_APP, "package.json"), "utf8")).scripts;
const filtre = process.argv[2]?.toLowerCase() ?? null;

const problemes = [];
const portes = [];

for (const [nom, commande] of Object.entries(scripts)) {
  if (!/^gate/.test(nom) || nom === "gate:list") continue;

  // Le chemin se dérive de la COMMANDE, pas d'une table parallèle : un script renommé suit.
  const chemin = commande.match(/[\w/.-]+\.m[jt]s/)?.[0];
  if (!chemin) {
    problemes.push(`${nom} — commande illisible : aucun fichier .mjs/.mts dedans (« ${commande} »)`);
    continue;
  }
  const absolu = join(RACINE_APP, chemin);
  if (!existsSync(absolu)) {
    problemes.push(`${nom} — le fichier déclaré dans package.json n'existe pas : ${chemin}`);
    continue;
  }

  const source = readFileSync(absolu, "utf8");

  // ── DÉCLARÉ : ce qu'aucune lecture de source ne peut deviner ────────────────────────
  const declaration = source.match(/^\/\/ @porte\s+(.+)$/m)?.[1];
  if (!declaration) {
    problemes.push(
      `${nom} — AUCUNE déclaration \`// @porte surface=… effet=…\` dans ${chemin}.\n` +
        `      ⇒ la carte serait incomplète EN SILENCE, ce qu'elle existe pour empêcher.`,
    );
    continue;
  }
  const champs = Object.fromEntries(
    declaration.split(/\s+/).map((p) => {
      const [cle, ...reste] = p.split("=");
      return [cle, reste.join("=").replace(/_/g, " ")];
    }),
  );
  if (!champs.surface || !champs.effet) {
    problemes.push(`${nom} — déclaration incomplète : « ${declaration} » (surface= et effet= requis)`);
    continue;
  }
  if (!EFFETS[champs.effet]) {
    problemes.push(
      `${nom} — effet inconnu « ${champs.effet} ». Vocabulaire fermé : ${Object.keys(EFFETS).join(", ")}`,
    );
    continue;
  }
  const tiers = champs.tiers ?? "aucun";
  if (!(tiers in TIERS)) {
    problemes.push(`${nom} — tiers inconnu « ${tiers} ». Vocabulaire fermé : ${Object.keys(TIERS).join(", ")}`);
    continue;
  }

  // ── DÉRIVÉ : lu dans le source ──────────────────────────────────────────────────────
  //
  // 🔴 CE TÉMOIN A ÉTÉ FAUX LE JOUR DE SA LIVRAISON, ET IL ACCUSAIT LE PRODUIT.
  // Il ne cherchait que le littéral `process.env.DATABASE_URL`. Or **cinq** portes lisent
  // l'environnement en **indexation dynamique**, dans leur `lireVariable` :
  //
  //     if (process.env[nom]) return process.env[nom]!;      // galerie, partenaires,
  //                                                          // membres, sollicitations, reglages
  //
  // Elles étaient donc **pilotables depuis toujours**, et cette porte les a déclarées
  // « ⛔ SANS ENVIRONNEMENT ». Sur sept portes accusées, **cinq étaient innocentes** — et
  // le chiffre a été repris tel quel dans une dette et dans une story avant d'être mesuré.
  // C'est la leçon n°1 de la rétro Epic 6 (~17 instruments faux, TOUS accusant le produit),
  // refaite par l'instrument même qui prétendait la prévenir. Mesuré le 2026-08-14 en
  // lisant les sept sources ; seules `ateliers` et `reseaux` lisent le FICHIER seulement.
  //
  // ⚠️ ET LA LEÇON N'EST PAS « J'AI OUBLIÉ UNE FORME » : c'est qu'une reconnaissance de
  // motif dans du texte ne mesure pas un COMPORTEMENT. Elle reste une heuristique — d'où
  // la déclaration explicite en sortie (`⚠️ dérivation heuristique`), qui interdit de lire
  // ce tableau comme une mesure. La vraie parade est structurelle et elle est routée :
  // **unifier `lireVariable`** en UN helper partagé (il est aujourd'hui DUPLIQUÉ dans
  // 7 fichiers, avec DEUX sémantiques différentes sous le MÊME nom — famille de la dette
  // R37). Story **7.11**.
  // 🔴 ET LE PREMIER CORRECTIF A ÉTÉ FAUX AUSSI, DANS L'AUTRE SENS. Élargir le motif à
  // `process.env[` a rendu `gate:reseaux` « pilotable » — alors qu'elle n'indexe
  // `process.env` que pour les VARIABLES N8N (l. 194-198), très loin de sa lecture de
  // `DATABASE_URL` (l. 527), qui ne regarde que le fichier. Un faux NÉGATIF est **pire**
  // qu'un faux positif : il rend une porte bloquée invisible, en silence.
  // ⇒ On ne teste plus le fichier entier mais une FENÊTRE autour de la lecture de
  // `.env.local` — c'est là, et nulle part ailleurs, que se décide la priorité.
  // ⚠️ ET LE BALAYAGE PORTE SUR **TOUTES** LES OCCURRENCES, pas la première : `.env.local`
  // apparaît d'abord dans les commentaires d'en-tête de plusieurs portes, très loin du code
  // qui résout l'URL. Un `indexOf` simple a donc déclaré `gate:partenaires` bloquée alors
  // que son `lireVariable` consulte bien `process.env[nom]` — 3ᵉ version de ce témoin, et
  // 3ᵉ fois qu'il se trompe. C'est la démonstration, à l'usage, que cette question ne se
  // décide pas en lisant du texte : la parade est **structurelle** (Story 7.11).
  // ✅ STORY 7.11 — CE TÉMOIN N'EST PLUS UNE HEURISTIQUE, IL EST BINAIRE.
  // Les trois versions ci-dessus tentaient de deviner, dans du TEXTE, si une porte
  // consultait `process.env` avant `.env.local`. Elles se sont trompées trois fois, dans les
  // deux sens. La question a disparu avec sa cause : la résolution vit maintenant dans **un
  // seul** module (`./env.mjs`, sémantique « environnement d'abord »), et une porte
  // l'**importe** ou ne l'importe pas. On ne reconnaît plus un motif, on lit un fait.
  //
  // ⚠️ Ce qui reste dérivé du texte, et qui l'assume : `postgres(`/`drizzle(` pour savoir si
  // la porte touche une base. C'est un appel de fonction, pas une intention — et si un jour
  // il devenait ambigu, la parade serait la même : rendre le fait explicite, pas affiner la
  // regex.
  const ouvrePostgres = /\bpostgres\(/.test(source) || /drizzle\(/.test(source);
  const litProcessEnv = /from "\.\/env\.mjs"/.test(source);

  // 🔴 LA GARDE ANTI-DÉRIVE : le code contredit-il la déclaration ?
  if (ouvrePostgres && !EFFETS[champs.effet].ecrit) {
    problemes.push(
      `${nom} — CONTRADICTION : se déclare « ${champs.effet} » mais son source ouvre une\n` +
        `      connexion Postgres. Corriger la déclaration, ou la porte.`,
    );
    continue;
  }

  portes.push({
    nom,
    chemin,
    surface: champs.surface,
    effet: champs.effet,
    tiers,
    story: champs.story ?? null,
    // Une porte qui résout son URL SANS jamais consulter `process.env` ne connaît que
    // `.env.local`, donc `localhost:5434` — le Postgres supprimé le 2026-08-13 (dette R47).
    orpheline: ouvrePostgres && !litProcessEnv,

  });
}

// ══════════════════════════════════════════════════════════════════════════════════════
// SORTIE
// ══════════════════════════════════════════════════════════════════════════════════════
const retenues = filtre
  ? portes.filter((p) => p.nom.toLowerCase().includes(filtre) || p.surface.toLowerCase().includes(filtre))
  : portes;

console.log(`\n  ── ${retenues.length} porte(s)${filtre ? ` pour « ${filtre} »` : ""} ──\n`);

const parSurface = new Map();
for (const p of retenues) {
  if (!parSurface.has(p.surface)) parSurface.set(p.surface, []);
  parSurface.get(p.surface).push(p);
}

for (const [surface, liste] of [...parSurface].sort()) {
  console.log(`  ${surface}`);
  for (const p of liste) {
    const e = EFFETS[p.effet];
    const orphelin = p.orpheline ? "  ⛔ SANS ENVIRONNEMENT (R47)" : "";
    console.log(`    ${e.icone} ${p.nom.padEnd(21)} ${e.texte}${TIERS[p.tiers]}${orphelin}`);
  }
  console.log("");
}

if (!filtre) {
  const ecrivantes = portes.filter((p) => EFFETS[p.effet].ecrit);
  const orphelines = portes.filter((p) => p.orpheline);
  const sortantes = portes.filter((p) => p.effet === "sortant");
  console.log(`  ${portes.length} portes · ${ecrivantes.length} écrivent · ${sortantes.length} sortante(s)`);
  if (orphelines.length > 0) {
    console.log(
      `\n  ⛔ ${orphelines.length} porte(s) SANS ENVIRONNEMENT — elles ne lisent que \`.env.local\`,`,
    );
    console.log("     donc le Postgres local supprimé le 2026-08-13. Elles ne s'exécutent PLUS,");
    console.log("     et seul leur échec de connexion le dit. Dette R47 → Story 7.11 :");
    console.log(`     ${orphelines.map((p) => p.nom).join(", ")}`);
  }
  // ⚠️ CE BLOC DÉCLARAIT « dérivation HEURISTIQUE … parade routée → Story 7.11 ». La 7.11 est
  // FAITE : la question ne se devine plus, elle se lit. On corrige donc la déclaration au lieu
  // de la laisser annoncer un chantier clos — un document qui décrit un état dépassé fait
  // chercher la panne au mauvais endroit (`pieges/cadrage-perime.md`).
  console.log("\n  ⓘ Pilotabilité : dérivée de l'IMPORT de `./env.mjs` — un fait binaire.");
  console.log("     (Elle s'inférait de motifs dans le texte jusqu'au 2026-08-14, et s'est");
  console.log("      trompée TROIS fois en un jour, dont une sur 5 portes à la fois.)");
  console.log("     ⚠️ Reste dérivé du texte, et l'assume : `postgres(`/`drizzle(` pour l'accès base.");
  console.log("");
}

if (problemes.length > 0) {
  console.error("\n❌ CARTE DES PORTES INCOHÉRENTE :\n");
  for (const p of problemes) console.error("   " + p);
  console.error(
    "\n   ⚠️ Ce rouge n'accuse PAS le site : il dit qu'une porte est mal déclarée, absente,\n" +
      "      ou renommée sans que sa déclaration suive.\n",
  );
  process.exit(1);
}

console.log("  ✅ Chaque porte de `package.json` est déclarée, et sa déclaration ne contredit pas son code.\n");
