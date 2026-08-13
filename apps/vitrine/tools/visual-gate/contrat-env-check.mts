/**
 * gate:contrat-env — LA PORTE QUI GARDE UNE ABSENCE (Story 7.4, AC3)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Elle vérifie qu'aucune variable d'environnement **lue par l'application** ne manque aux
 * DEUX contrats : `.env.example` (poste de dev) et `.env.prod.example` (le fichier que
 * l'exploitant recopie en `.env.prod` sur le VPS).
 *
 * 🔴 POURQUOI ELLE EXISTE — un défaut qui a traversé DEUX EPICS sans que rien ne le voie.
 * Au cadrage de la Story 7.4 (2026-08-08), `.env.prod.example` ne déclarait que cinq
 * variables. Il manquait `AUTH_SECRET`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`,
 * `AUTH_ADMIN_DISCORD_IDS` et `GMAIL_APP_PASSWORD`. Déployée telle quelle, la vitrine aurait
 * servi un site public parfaitement correct et un **back-office où personne ne peut entrer**
 * (allowlist vide = fail-closed, arbitrage n°2 de la 6.1) — sans un message qui pointe la
 * cause. Aucune porte, aucun lint, aucun typage ne pouvait le voir : il ne manque pas de
 * code, il manque une LIGNE DE DOCUMENTATION dont dépend un geste humain.
 *
 * ⇒ Une absence ne se relit pas, elle se garde. C'est la doctrine de `gate:ateliers`
 *   (« aucune colonne de tarif ») et de `gate:reglages` (« aucune colonne de texte libre »).
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QUI REND CETTE PORTE DIFFICILE, ET CE QUI A ÉTÉ MESURÉ AVANT DE L'ÉCRIRE
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * ① **DEUX FORMES D'ACCÈS, ET LA SECONDE EST INVISIBLE À UN GREP NAÏF.** Un balayage
 *    `process.env.NOM` ne voit PAS `src/server/integrations/n8n.ts`, qui lit
 *    `process.env[VARIABLE_URL]` où `VARIABLE_URL` est une constante du même fichier
 *    (`const VARIABLE_URL = "N8N_WEBHOOK_URL"`). Mesuré le 2026-08-08 : une première version
 *    de cette porte n'aurait couvert que **8 variables sur 10**, en restant VERTE.
 *    C'est le faux négatif du piège n°10 d'`instrument-non-valide.md` — le mode de
 *    défaillance silencieux, celui qui fait livrer. D'où la résolution des constantes.
 *
 * ② **TROIS VARIABLES NE SONT LUES NULLE PART DANS NOTRE CODE.** Auth.js lit `AUTH_SECRET`,
 *    `AUTH_<PROVIDER>_ID` et `AUTH_<PROVIDER>_SECRET` **lui-même**. C'est exactement ce qui
 *    les a rendues invisibles pendant deux epics. Elles sont donc **DÉRIVÉES** des `import …
 *    from "next-auth/providers/<nom>"` trouvés dans le source — et non énumérées à la main.
 *    🔴 La différence est capitale : une liste alignée à la main se désaligne à l'ajout
 *    suivant, et ce projet l'a payé SIX fois (`_sections.ts`, `CHAMPS_URL`, la liste de
 *    portes de `CLAUDE.md` §4 — fausse deux fois —, la couverture d'autotest de
 *    `gate:reseaux` — fausse deux fois en dix minutes, `backup-all.sh`). Ajouter un
 *    provider demain fera bouger cette porte toute seule.
 *
 * ③ **LE PÉRIMÈTRE EST DÉFINI PAR L'EMPLACEMENT, PAS PAR UNE LISTE DE NOMS.** Mesuré :
 *    les 22 variables d'outillage (`*_AUTOTEST`, `*_DEBRANCHER_*`, `GATE_*`, `CHROME_PATH`,
 *    `SNAPSHOT_LABEL`, `IMAGES_CASSER`) vivent **exclusivement** dans `tools/` — pas une
 *    seule dans `src/`. Balayer `src/` suffit donc, sans aucune liste d'exclusion à
 *    maintenir. Les scripts CLI (`tsx …`) déclarés dans `package.json` sont retirés du
 *    périmètre par DÉRIVATION, pour la même raison qu'au point ②.
 *
 * ════════════════════════════════════════════════════════════════════════════════
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴 ÉCART DE CONVENTION ASSUMÉ : L'AUTOTEST TOURNE À CHAQUE EXÉCUTION.
 * Les cinq portes précédentes (`ateliers`, `membres`, `sollicitations`, `reglages`,
 * `reseaux`) déclenchent leur auto-validation par une variable d'environnement, parce que
 * la leur doit **muter la base** ou **servir des pages** : la jouer systématiquement aurait
 * un coût et des effets de bord. Celle-ci ne lit que des fichiers — son autotest est
 * gratuit. Le faire tourner d'office supprime le seul mode de défaillance qui restait :
 * *« personne n'a lancé l'autotest »*. Une porte dont on ne sait pas si elle sait crier
 * n'est pas une porte.
 *
 * Usage :  pnpm --filter vitrine gate:contrat-env
 * Sortie : code 1 si une variable manque à l'un des deux contrats, ou si l'autotest tombe.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE_APP = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const DOSSIER_SOURCE = path.join(RACINE_APP, "src");
const CONTRATS = [
  { nom: ".env.example", chemin: path.join(RACINE_APP, ".env.example") },
  { nom: ".env.prod.example", chemin: path.join(RACINE_APP, ".env.prod.example") },
];
const PACKAGE_JSON = path.join(RACINE_APP, "package.json");

/**
 * Les SEULES variables exemptées, et chacune porte sa raison.
 *
 * ⚠️ Ce sont des variables posées par la PLATEFORME (Node, Next), jamais par un exploitant :
 * les déclarer dans un `.env.example` inviterait quelqu'un à les renseigner à la main, ce qui
 * est au mieux inutile et au pire nuisible (`NODE_ENV=production` sur un poste de dev).
 * Toute autre exemption doit être justifiée ici — et elle sera AFFICHÉE en sortie.
 */
const EXEMPTIONS_PLATEFORME = new Map([
  ["NODE_ENV", "posée par Node/Next selon le mode d'exécution"],
  ["NEXT_RUNTIME", "posée par Next pour distinguer les runtimes nodejs/edge"],
]);

type Constat = { variable: string; fichiers: string[]; origine: string };

function fichiersTypeScript(dossier: string): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const complet = path.join(dossier, entree);
    if (statSync(complet).isDirectory()) sortie.push(...fichiersTypeScript(complet));
    else if (/\.(ts|tsx|mts)$/.test(entree)) sortie.push(complet);
  }
  return sortie;
}

/**
 * Les points d'entrée CLI, DÉRIVÉS de `package.json` (`tsx <chemin>`).
 *
 * `db:seed` lit `SEED_ALLOW_REMOTE`, une trappe de secours de script, jamais une variable de
 * serveur. L'exclure par son NOM aurait été une liste à maintenir ; l'exclure par son
 * RÔLE (fichier lancé par un script `tsx`) se met à jour tout seul.
 */
function scriptsCli(): Set<string> {
  const scripts: Record<string, string> =
    JSON.parse(readFileSync(PACKAGE_JSON, "utf8")).scripts ?? {};
  const chemins = new Set<string>();
  for (const commande of Object.values(scripts)) {
    for (const m of commande.matchAll(/tsx(?:\s+--\S+)*\s+(\S+\.mts|\S+\.ts)/g)) {
      chemins.add(path.resolve(RACINE_APP, m[1]));
    }
  }
  return chemins;
}

/** Forme ① — `process.env.NOM`. */
function accesDirects(source: string): string[] {
  return [...source.matchAll(/process\.env\.([A-Z][A-Z_0-9]*)/g)].map((m) => m[1]);
}

/**
 * Forme ② — `process.env[CONSTANTE]`, la constante étant résolue dans le MÊME fichier.
 *
 * 🔴 C'est la forme qu'un balayage naïf rate, et c'est celle qu'utilise `n8n.ts`.
 * ⚠️ Une constante importée d'un autre module ou une clé calculée ne sont PAS résolues :
 * c'est déclaré en exemption en sortie plutôt que tu.
 */
function accesParConstante(source: string): { trouves: string[]; nonResolus: string[] } {
  const constantes = new Map<string, string>();
  for (const m of source.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*["'`]([A-Z][A-Z_0-9]*)["'`]/g)) {
    constantes.set(m[1], m[2]);
  }
  const trouves: string[] = [];
  const nonResolus: string[] = [];
  for (const m of source.matchAll(/process\.env\[\s*([^\]]+?)\s*\]/g)) {
    const cle = m[1].trim();
    const litteral = cle.match(/^["'`]([A-Z][A-Z_0-9]*)["'`]$/);
    if (litteral) trouves.push(litteral[1]);
    else if (constantes.has(cle)) trouves.push(constantes.get(cle)!);
    else nonResolus.push(cle);
  }
  return { trouves, nonResolus };
}

/**
 * Forme ③ — les variables qu'Auth.js lit LUI-MÊME, dérivées des providers déclarés.
 * Convention Auth.js v5 : `AUTH_SECRET`, puis `AUTH_<PROVIDER>_ID` / `_SECRET`.
 */
function variablesImplicitesAuth(fichiers: { chemin: string; source: string }[]): Constat[] {
  const constats: Constat[] = [];
  const porteurs = fichiers.filter((f) => /from\s+["']next-auth["']/.test(f.source));
  if (porteurs.length === 0) return constats;

  constats.push({
    variable: "AUTH_SECRET",
    fichiers: porteurs.map((f) => path.relative(RACINE_APP, f.chemin)),
    origine: "implicite Auth.js (signature des sessions)",
  });

  // 🔴 AJOUTÉE LE 2026-08-08 SUR UN DÉFAUT MESURÉ EN STAGING (Story 7.4, AC5).
  // Sans `AUTH_URL`, Auth.js derrière un reverse proxy construit son `redirect_uri` avec
  // l'adresse d'ÉCOUTE du conteneur (`https://0.0.0.0:3000`) : Discord répond
  // `invalid_redirect_uri` et **personne ne peut se connecter au back-office**.
  // ⚠️ `trustHost: true` ne couvre PAS ce cas : il autorise l'inférence, il ne la rend pas
  // juste. Le défaut est donc invisible en local (où l'inférence tombe juste) et n'apparaît
  // qu'en déploiement — exactement la famille de R32, et exactement ce qu'une porte doit
  // empêcher de revenir.
  constats.push({
    variable: "AUTH_URL",
    fichiers: porteurs.map((f) => path.relative(RACINE_APP, f.chemin)),
    origine: "implicite Auth.js (origine publique derrière proxy)",
  });

  for (const f of fichiers) {
    for (const m of f.source.matchAll(/from\s+["']next-auth\/providers\/([a-z0-9-]+)["']/g)) {
      const provider = m[1].toUpperCase().replace(/-/g, "_");
      const relatif = path.relative(RACINE_APP, f.chemin);
      constats.push(
        { variable: `AUTH_${provider}_ID`, fichiers: [relatif], origine: `implicite Auth.js (provider ${m[1]})` },
        { variable: `AUTH_${provider}_SECRET`, fichiers: [relatif], origine: `implicite Auth.js (provider ${m[1]})` },
      );
    }
  }
  return constats;
}

/** Une variable est « déclarée » si le contrat porte une ligne `NOM=` (commentée ou non). */
function variablesDeclarees(contenu: string): Set<string> {
  return new Set(
    [...contenu.matchAll(/^\s*#?\s*([A-Z][A-Z_0-9]*)\s*=/gm)].map((m) => m[1]),
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SONDE D'ENTRÉE (action A6 de la rétro Epic 6)
// ══════════════════════════════════════════════════════════════════════════════
// 🔴 Sans elle, un chemin faux ferait rendre « 0 variable manquante » sur un fichier
// ABSENT — un vert qui ne mesure rien. C'est la leçon du 2026-08-08, où une porte sans
// sonde a transformé un serveur lancé sur le mauvais port en 35 gardes en échec.
function sondeEntree(): void {
  const manquants: string[] = [];
  if (!existsSync(DOSSIER_SOURCE)) manquants.push(DOSSIER_SOURCE);
  for (const c of CONTRATS) if (!existsSync(c.chemin)) manquants.push(c.chemin);
  if (!existsSync(PACKAGE_JSON)) manquants.push(PACKAGE_JSON);
  if (manquants.length > 0) {
    console.error("🔌 SONDE D'ENTRÉE EN ÉCHEC — c'est l'ENVIRONNEMENT, pas le produit :");
    for (const m of manquants) console.error(`   introuvable : ${m}`);
    process.exit(1);
  }
}

function releverVariablesLues(): { constats: Constat[]; nonResolus: string[]; nbFichiers: number } {
  const cli = scriptsCli();
  const fichiers = fichiersTypeScript(DOSSIER_SOURCE)
    .filter((f) => !cli.has(f))
    .map((chemin) => ({ chemin, source: readFileSync(chemin, "utf8") }));

  const parVariable = new Map<string, Constat>();
  const nonResolus: string[] = [];

  const ajouter = (variable: string, fichier: string, origine: string) => {
    const existant = parVariable.get(variable);
    if (existant) {
      if (!existant.fichiers.includes(fichier)) existant.fichiers.push(fichier);
    } else parVariable.set(variable, { variable, fichiers: [fichier], origine });
  };

  for (const f of fichiers) {
    const relatif = path.relative(RACINE_APP, f.chemin);
    for (const v of accesDirects(f.source)) ajouter(v, relatif, "process.env.NOM");
    const { trouves, nonResolus: nr } = accesParConstante(f.source);
    for (const v of trouves) ajouter(v, relatif, "process.env[CONSTANTE]");
    for (const cle of nr) nonResolus.push(`${relatif} → process.env[${cle}]`);
  }
  for (const c of variablesImplicitesAuth(fichiers)) ajouter(c.variable, c.fichiers[0], c.origine);

  return { constats: [...parVariable.values()], nonResolus, nbFichiers: fichiers.length };
}

function executer(): number {
  sondeEntree();
  const { constats, nonResolus, nbFichiers } = releverVariablesLues();

  const requises = constats
    .filter((c) => !EXEMPTIONS_PLATEFORME.has(c.variable))
    .sort((a, b) => a.variable.localeCompare(b.variable));

  console.log(
    `🔎 Contrat des variables d'environnement — ${nbFichiers} fichiers de src/ balayés, ` +
      `${requises.length} variables requises, ${CONTRATS.length} contrats.\n`,
  );

  let echecs = 0;
  for (const contrat of CONTRATS) {
    const declarees = variablesDeclarees(readFileSync(contrat.chemin, "utf8"));
    const absentes = requises.filter((c) => !declarees.has(c.variable));
    if (absentes.length === 0) {
      console.log(`  ✅ ${contrat.nom} — les ${requises.length} variables sont déclarées`);
    } else {
      echecs += absentes.length;
      console.log(`  ❌ ${contrat.nom} — ${absentes.length} variable(s) NON DÉCLARÉE(S) :`);
      for (const a of absentes) {
        console.log(`       ${a.variable}  (${a.origine} — ${a.fichiers.join(", ")})`);
      }
    }
  }

  // ⚠️ Une porte verte ne dit pas « tout est couvert » : elle doit dire ce qu'elle NE couvre
  // PAS (règle ② du piège n°10 d'instrument-non-valide.md).
  console.log("\n  ⚠️ Exemptions et angles morts DÉCLARÉS :");
  for (const [nom, raison] of EXEMPTIONS_PLATEFORME) console.log(`     · ${nom} — ${raison}`);
  console.log("     · tools/** — outillage de portes, jamais déployé (22 variables au relevé)");
  console.log("     · les points d'entrée `tsx` de package.json — scripts CLI, pas le serveur");
  if (nonResolus.length === 0) {
    console.log("     · process.env[clé calculée] — aucune occurrence dans src/ à ce jour");
  } else {
    console.log(`     · ${nonResolus.length} accès dynamique(s) NON RÉSOLU(S), donc non couverts :`);
    for (const n of nonResolus) console.log(`         ${n}`);
  }
  console.log("     · cette porte vérifie qu'une variable est DÉCLARÉE, jamais qu'elle a une");
  console.log("       valeur juste sur le VPS — seul un appel réel le prouve (7.4 AC5).");

  if (echecs > 0) {
    console.log(`\n❌ PORTE ROUGE — ${echecs} manque(s) au contrat.`);
    return 1;
  }
  console.log(`\n✅ PORTE VERTE — ${requises.length} variables, ${CONTRATS.length} contrats, 0 manque.`);
  return 0;
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTOTEST — la porte doit savoir CRIER et savoir SE TAIRE (parade n°7)
// ══════════════════════════════════════════════════════════════════════════════
function autotest(): number {
  console.log("🧪 Autotest de gate:contrat-env\n");
  sondeEntree();
  const { constats, nonResolus } = releverVariablesLues();
  const noms = new Set(constats.map((c) => c.variable));
  let echecs = 0;
  const verifier = (intitule: string, condition: boolean) => {
    console.log(`  ${condition ? "✅" : "❌"} ${intitule}`);
    if (!condition) echecs++;
  };

  // ① Le cas de vérité connue (parade n°8) : un attendu NON NUL, lu en premier.
  verifier("① la forme directe est vue — DATABASE_URL relevée", noms.has("DATABASE_URL"));

  // ② 🔴 Le cas qui prouve que la porte n'est pas le grep naïf qu'elle remplace.
  verifier(
    "② la forme par CONSTANTE est vue — N8N_WEBHOOK_URL (process.env[VARIABLE_URL])",
    noms.has("N8N_WEBHOOK_URL") && noms.has("N8N_WEBHOOK_TOKEN"),
  );

  // ③ Les implicites d'Auth.js, DÉRIVÉES et non énumérées.
  verifier(
    "③ les implicites Auth.js sont dérivées — AUTH_SECRET + AUTH_URL + AUTH_DISCORD_ID/_SECRET",
    noms.has("AUTH_SECRET") &&
      noms.has("AUTH_URL") &&
      noms.has("AUTH_DISCORD_ID") &&
      noms.has("AUTH_DISCORD_SECRET"),
  );

  // ④ Le périmètre ne déborde pas sur l'outillage (cardinal du prédicat, parade n°3).
  verifier(
    "④ aucune variable d'outillage n'entre dans le périmètre (GATE_*, *_AUTOTEST)",
    ![...noms].some((n) => /^GATE_|_AUTOTEST$|_DEBRANCHER_|^CHROME_PATH$|^SNAPSHOT_LABEL$/.test(n)),
  );

  // ⑤ Le script CLI est écarté par dérivation, pas par son nom.
  verifier("⑤ SEED_ALLOW_REMOTE écartée (point d'entrée `tsx` de package.json)", !noms.has("SEED_ALLOW_REMOTE"));

  // ⑥ 🔴 LA PORTE SAIT CRIER : on retire une variable d'un contrat en mémoire.
  const contratAmpute = readFileSync(CONTRATS[1].chemin, "utf8").replace(
    /^AUTH_ADMIN_DISCORD_IDS=.*$/m,
    "# (ligne retirée par l'autotest)",
  );
  const declareesAmputees = variablesDeclarees(contratAmpute);
  verifier(
    "⑥ ROUGE sur contrat amputé — AUTH_ADMIN_DISCORD_IDS détectée manquante",
    !declareesAmputees.has("AUTH_ADMIN_DISCORD_IDS"),
  );

  // ⑦ 🔴 ET ELLE SAIT SE TAIRE : le contrat intact ne produit aucun manque.
  const declareesIntactes = variablesDeclarees(readFileSync(CONTRATS[1].chemin, "utf8"));
  const manques = constats
    .filter((c) => !EXEMPTIONS_PLATEFORME.has(c.variable))
    .filter((c) => !declareesIntactes.has(c.variable));
  verifier(`⑦ VERTE sur contrat intact — 0 manque (relevé : ${manques.length})`, manques.length === 0);

  // ⑧ Un accès dynamique non résolu ne doit jamais être avalé en silence.
  verifier(
    `⑧ les accès non résolus sont comptés et déclarés (${nonResolus.length} au relevé)`,
    Array.isArray(nonResolus),
  );

  console.log(
    `\n  ⚠️ Ce que l'autotest NE prouve PAS : que les contrats donnent les BONNES valeurs, ` +
      `\n     ni qu'Auth.js n'ajoutera pas demain une variable implicite d'une autre forme.`,
  );
  console.log(echecs === 0 ? "\n✅ AUTOTEST VERT — 8 contrôles." : `\n❌ AUTOTEST ROUGE — ${echecs} échec(s).`);
  return echecs === 0 ? 0 : 1;
}

// 🔴 L'AUTOTEST D'ABORD. Un verdict de porte ne vaut que si l'instrument a d'abord prouvé
// qu'il sait crier ET se taire — devant un rouge, la probabilité que l'instrument soit en
// cause est du même ordre que celle du produit (leçon n°1 de la rétro Epic 6, ~17 instruments
// faux en un epic). Lire le verdict AVANT sa validation, c'est l'ordre qui a coûté ces heures.
const codeAutotest = autotest();
console.log("\n" + "─".repeat(78) + "\n");
const codeContrat = executer();
process.exit(codeAutotest !== 0 ? codeAutotest : codeContrat);
