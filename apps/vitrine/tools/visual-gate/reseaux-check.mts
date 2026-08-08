// 🔬 SURFACE « PUBLICATION RÉSEAUX » — LA 19ᵉ PORTE (Story 6.7)
//
// Pourquoi une porte dédiée — ce que ni lint, ni typecheck, ni build, ni Lighthouse, ni les
// quatre contrôles de `gate`, ni les dix-huit autres portes ne peuvent voir :
//
//   défaut possible                                              lint/build  gate  gate:admin  œil
//   la valeur de N8N_WEBHOOK_TOKEN part dans le CORPS du POST         ❌       ❌       ❌      ❌
//   une donnée personnelle quitte le site vers un tiers               ❌       ❌       ❌      ❌
//   la date part en « Z » → n8n annonce une heure fausse de 2 h       ❌       ❌       ❌      ❌
//   un webhook muet fait attendre le bénévole jusqu'au délai de l'OS  ❌       ❌       ❌      ⚠️
//   le message d'échec expose un code HTTP ou une URL de webhook      ❌       ❌       ❌      ⚠️
//   l'URL du webhook repasse en `http://` public (jeton en clair)     ❌       ❌       ❌      ❌
//   un 2ᵉ fichier se met à appeler n8n (AR-API2 : un seul utilitaire) ❌       ❌       ❌      ❌
//   une colonne de « texte d'annonce » apparaît sur `event`           ❌       ❌       ❌      ❌
//   le workflow versionné gagne un nœud Instagram / X / Discord       ❌       ❌       ❌      ❌
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE QUE CETTE PORTE A DE PROPRE : ELLE **FABRIQUE SON n8n** ET ÉMET DE VRAIS `POST`
// ══════════════════════════════════════════════════════════════════════════════════════
//
// Elle démarre un serveur HTTP sur `127.0.0.1`, y pointe `N8N_WEBHOOK_URL`, appelle la
// **vraie** `publierEvenement()` et lit le **corps réellement reçu**. Ce n'est pas un détail
// de mise en œuvre : c'est ce qui la range du côté de `gate:links` (qui clique vraiment) et
// non du côté d'une relecture de source. Un instrument qui relirait `n8n.ts` pour vérifier que
// « le jeton est bien en en-tête » validerait sa propre lecture du code, pas l'octet émis.
//
// 🔴 ET C'EST CETTE PORTE QUI A DICTÉ UNE DÉCISION DU PRODUIT, PAS L'INVERSE. Une première
// version de `n8n.ts` refusait `http://` sans exception. Conséquence découverte ici : plus
// aucun POST réel n'était émettable sans fabriquer un certificat auto-signé et désarmer la
// vérification TLS du processus — c'est-à-dire remplacer une mesure d'effet par une lecture de
// source. C'est le mécanisme exact de la dette **R32** : une garde correcte sur le papier qui
// rend le maillon invérifiable, donc jamais vérifié. D'où l'exemption **de boucle locale
// uniquement**, dont la garde ⑥ éprouve les quatre bords (public refusé, loopback accepté,
// `https` accepté, suffixe `localhost.attaquant.fr` refusé).
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 DEUX GARDES LISENT LE **SOURCE**, ET C'EST DÉCLARÉ (⑨ et ⑩)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// L'effet d'une Server Action exige une SESSION, qu'aucune porte n'a — même limite que
// `gate:sollicitations` et `gate:membres`. Deux propriétés valent quand même d'être tenues :
// l'UNICITÉ de l'appel n8n (AR-API2) et la présence de `requireAdmin()` en tête de chaque
// export. Les lire est le seul témoin disponible ; la limite est dite en sortie.
//
// ⚠️ CETTE PORTE N'ÉCRIT NI EN BASE, NI SUR LE DISQUE, ET N'APPELLE JAMAIS LE VRAI n8n.
// Elle lit `event` en information_schema (garde ⑧) et c'est tout. Aucun ménage n'est donc dû —
// ce qui est en soi la garde : une porte qui publierait pour se tester enverrait de vraies
// annonces à chaque exécution.
//
// Usage :  pnpm --filter vitrine gate:reseaux
//          RESEAUX_AUTOTEST=1 …  → auto-validation de l'instrument
import { createServer, type IncomingMessage, type Server } from "node:http";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

import {
  publicationPayloadSchema,
  PAYLOAD_SOURCE,
  PAYLOAD_VERSION,
  type PublicationPayload,
} from "../../src/lib/schemas/publication";
import { toParisIso } from "../../src/lib/date-paris";
import {
  DELAI_PUBLICATION_MS,
  EN_TETE_JETON_N8N,
  publierEvenement,
  transportAcceptable,
  VARIABLES_N8N,
} from "../../src/server/integrations/n8n";

const AUTOTEST = process.env.RESEAUX_AUTOTEST === "1";

const echecs: string[] = [];
const succes: string[] = [];
const exemptions = new Set<string>();

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LA COUVERTURE DE L'AUTOTEST EST **CALCULÉE**, JAMAIS ÉNUMÉRÉE À LA MAIN
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `gate:ateliers` a établi la règle : *« un autotest muet sur sa propre couverture laisse
 * croire qu'il couvre tout »*. Sa parade était une liste écrite en dur des gardes non
 * éprouvées — et cette liste a été **fausse dès la première exécution ici** : elle annonçait
 * QUATRE gardes sans cas d'auto-validation, il y en avait **seize**.
 *
 * C'est le défaut de `app/admin/_sections.ts` et de la liste de portes de `CLAUDE.md` §4,
 * transposé à un instrument : *une énumération alignée à la main se désaligne à l'ajout
 * suivant*. On ne la réécrit donc pas — on la **dérive** : une garde qui, en autotest, n'a
 * produit qu'un `ok` est une garde à qui l'on n'a présenté aucun cas d'échec. Le compte
 * s'ajuste tout seul quand une garde s'ajoute.
 */
const vues = new Set<string>();
const vertes = new Set<string>();
const ko = (garde: string, quoi: string) => {
  vues.add(garde);
  echecs.push(`${garde} — ${quoi}`);
};
const ok = (garde: string, quoi: string) => {
  vertes.add(garde);
  succes.push(`${garde} — ${quoi}`);
};

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE_APP = join(ICI, "..", "..");
const lireSource = (chemin: string) => readFileSync(join(RACINE_APP, chemin), "utf8");

console.log("\n🔬 gate:reseaux — publication réseaux (Story 6.7)");
if (AUTOTEST) {
  console.log("   MODE AUTO-VALIDATION : on présente à chaque garde un cas qu'elle doit voir.");
}

/**
 * Le jeton utilisé pour la mesure. Il n'a **rien à voir** avec le vrai : la garde ② cherche
 * cette chaîne-ci dans le corps émis, donc elle doit être unique et reconnaissable. Utiliser
 * le vrai jeton ferait courir le risque de l'imprimer dans un rapport d'échec.
 */
const JETON_TEMOIN = "JETON-DE-MESURE-NE-DOIT-JAMAIS-PARAITRE-DANS-LE-CORPS";

/**
 * Un événement plausible, construit comme l'action le construit.
 *
 * ⚠️ Le type de retour est ANNOTÉ et non inféré : sans lui, le littéral d'objet élargit
 * `version: 1` en `version: number`, et la porte ne compilerait plus contre le contrat qu'elle
 * garde. C'est le schéma du produit qui décide de la forme, pas cet instrument.
 */
function payloadTemoin(): PublicationPayload {
  return {
    version: PAYLOAD_VERSION,
    source: PAYLOAD_SOURCE,
    evenement: {
      id: "00000000-0000-4000-8000-000000000000",
      titre: "Jeudi TFT au Bar témoin",
      type: "thursday" as const,
      debut: toParisIso(new Date("2026-08-13T17:00:00.000Z")),
      lieu: "Bar témoin",
      adresse: "1 rue de la Mesure, Centre, Reims",
      jeux: "TFT, Smash",
      description: "Une soirée de mesure.",
      lien: "https://esportdessacres.fr/agenda",
    },
  };
}

type Recu = { corps: string; entetes: IncomingMessage["headers"] };

/**
 * Démarre un faux n8n et rend l'URL à laquelle il répond.
 *
 * `comportement` décide de ce qu'il fait du POST : répondre 200, répondre 500, ou **ne jamais
 * répondre** (le cas qui éprouve le délai explicite).
 */
async function fauxN8n(
  comportement: "accepte" | "refuse" | "muet",
): Promise<{ url: string; recus: Recu[]; fermer: () => Promise<void>; serveur: Server }> {
  const recus: Recu[] = [];
  const serveur = createServer((req, res) => {
    let corps = "";
    req.on("data", (morceau) => (corps += morceau));
    req.on("end", () => {
      recus.push({ corps, entetes: req.headers });
      if (comportement === "muet") return; // volontairement aucune réponse
      res.writeHead(comportement === "accepte" ? 200 : 500, {
        "content-type": "application/json",
      });
      res.end(JSON.stringify({ ok: comportement === "accepte" }));
    });
  });

  await new Promise<void>((resoudre) => serveur.listen(0, "127.0.0.1", resoudre));
  const adresse = serveur.address();
  if (adresse === null || typeof adresse === "string") throw new Error("port introuvable");

  return {
    url: `http://127.0.0.1:${adresse.port}/webhook/mesure`,
    recus,
    serveur,
    fermer: () =>
      new Promise<void>((resoudre) => {
        serveur.closeAllConnections?.();
        serveur.close(() => resoudre());
      }),
  };
}

/** Exécute un appel avec un environnement donné, puis restaure l'environnement. */
async function appelerAvec(
  env: { url?: string; jeton?: string },
  payload = payloadTemoin(),
) {
  const avantUrl = process.env[VARIABLES_N8N.url];
  const avantJeton = process.env[VARIABLES_N8N.jeton];
  if (env.url === undefined) delete process.env[VARIABLES_N8N.url];
  else process.env[VARIABLES_N8N.url] = env.url;
  if (env.jeton === undefined) delete process.env[VARIABLES_N8N.jeton];
  else process.env[VARIABLES_N8N.jeton] = env.jeton;
  try {
    return await publierEvenement(payload);
  } finally {
    if (avantUrl === undefined) delete process.env[VARIABLES_N8N.url];
    else process.env[VARIABLES_N8N.url] = avantUrl;
    if (avantJeton === undefined) delete process.env[VARIABLES_N8N.jeton];
    else process.env[VARIABLES_N8N.jeton] = avantJeton;
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ① LE POST PART VRAIMENT, ET IL PORTE LE CONTRAT
// ══════════════════════════════════════════════════════════════════════════════════════
{
  const faux = await fauxN8n("accepte");
  const resultat = await appelerAvec({ url: faux.url, jeton: JETON_TEMOIN });
  await faux.fermer();

  if (!resultat.ok) {
    ko("①", `l'appel a échoué alors que le webhook répondait 200 (cause: ${resultat.cause})`);
  } else if (faux.recus.length !== 1) {
    ko("①", `${faux.recus.length} requête(s) reçue(s) au lieu d'une seule`);
  } else {
    const corps: unknown = JSON.parse(faux.recus[0].corps);
    // ⚠️ On repasse le corps REÇU dans le schéma exporté par le produit — pas dans une copie
    // de son contrat réécrite ici (`pieges/garde-nominale.md`).
    const analyse = publicationPayloadSchema.safeParse(corps);
    if (!analyse.success) {
      ko("①", `le corps reçu ne respecte pas publicationPayloadSchema : ${analyse.error.issues[0]?.message}`);
    } else {
      ok("①", "un POST réel part, et le corps reçu satisfait le schéma exporté par le produit");
    }
    // 🔴 AUCUNE REPRISE AUTOMATIQUE : une requête, pas deux. Un `POST` rejoué publierait deux
    // fois, et ce back-office ne sait pas dépublier.
    ok("①b", "exactement 1 requête émise (aucune reprise automatique)");
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ② LE JETON EST EN EN-TÊTE, ET SA VALEUR N'EST **JAMAIS** DANS LE CORPS
// ══════════════════════════════════════════════════════════════════════════════════════
{
  const faux = await fauxN8n("accepte");
  await appelerAvec({ url: faux.url, jeton: JETON_TEMOIN });
  await faux.fermer();

  const recu = faux.recus[0];
  if (!recu) {
    ko("②", "aucune requête reçue : la garde n'a rien à mesurer");
  } else {
    // En autotest, on cherche la valeur là où elle N'EST PAS censée être en la comparant à
    // une chaîne qui, elle, est bel et bien dans le corps : la garde doit alors tomber.
    const aiguille = AUTOTEST ? "Jeudi TFT au Bar témoin" : JETON_TEMOIN;
    if (recu.corps.includes(aiguille)) {
      ko("②", "🔴 la valeur du jeton se retrouve dans le CORPS du POST (elle partirait dans les données d'exécution n8n)");
    } else {
      ok("②", "la valeur du jeton n'apparaît pas dans le corps");
    }
    if (recu.entetes[EN_TETE_JETON_N8N] !== JETON_TEMOIN) {
      ko("②b", `le jeton n'est pas dans l'en-tête ${EN_TETE_JETON_N8N}`);
    } else {
      ok("②b", `le jeton part dans l'en-tête ${EN_TETE_JETON_N8N}`);
    }
    if (recu.corps.includes(faux.url) || JSON.stringify(recu.entetes).includes(JETON_TEMOIN + "?")) {
      ko("②c", "le jeton ou l'URL fuit ailleurs que dans l'en-tête prévu");
    } else {
      ok("②c", "le jeton ne transite ni par l'URL ni par le corps");
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ③ AUCUNE DONNÉE PERSONNELLE NE QUITTE LE SITE
// ══════════════════════════════════════════════════════════════════════════════════════
{
  const faux = await fauxN8n("accepte");
  await appelerAvec({ url: faux.url, jeton: JETON_TEMOIN });
  await faux.fermer();

  const corps = faux.recus[0]?.corps ?? "";
  // Le schéma est la source : si un champ y était ajouté, la clé apparaîtrait ici.
  const clefsAutorisees = new Set([
    "version", "source", "evenement",
    "id", "titre", "type", "debut", "lieu", "adresse", "jeux", "description", "lien",
  ]);
  const clefs = new Set<string>();
  JSON.parse(corps, function (clef: string) {
    if (clef !== "") clefs.add(clef);
    // eslint-disable-next-line prefer-rest-params
    return arguments[1] as unknown;
  });
  // En autotest, on retire une clé légitime de la liste : la garde doit alors tomber.
  if (AUTOTEST) clefsAutorisees.delete("titre");

  const intruses = [...clefs].filter((c) => !clefsAutorisees.has(c) && !/^\d+$/.test(c));
  if (intruses.length > 0) {
    ko("③", `clé(s) non prévue(s) dans le corps émis : ${intruses.join(", ")} — toute donnée personnelle quitterait le périmètre RGPD du site`);
  } else {
    ok("③", `le corps ne porte que les ${clefsAutorisees.size} clés du contrat (aucun e-mail, aucun nom de bénévole)`);
  }
  // Contre-épreuve littérale : pas d'arobase, jamais.
  if (/@/.test(corps)) {
    ko("③b", "le corps émis contient une arobase — une adresse e-mail a fuité");
  } else {
    ok("③b", "aucune arobase dans le corps émis");
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ④ UN REFUS DU WEBHOOK NE FAIT JAMAIS REMONTER DE TEXTE TECHNIQUE À L'ÉCRAN
// ══════════════════════════════════════════════════════════════════════════════════════
{
  const faux = await fauxN8n("refuse");
  const resultat = await appelerAvec({ url: faux.url, jeton: JETON_TEMOIN });
  await faux.fermer();

  if (resultat.ok) {
    ko("④", "un webhook répondant 500 a produit un succès");
  } else {
    // 🔴 ON MESURE LA CHAÎNE RENDUE, pas le code qui la produit. L'AC parle du message VU.
    const interdits = ["500", "fetch", "http://", "https://", "127.0.0.1", "TypeError", "undefined"];
    const fautifs = interdits.filter((i) => resultat.error.includes(i));
    if (fautifs.length > 0) {
      ko("④", `le message affiché contient du texte technique : ${fautifs.join(", ")}`);
    } else {
      ok("④", "le refus rend une phrase sans code HTTP, sans URL et sans nom de fonction");
    }
    if (resultat.cause !== "refus") {
      ko("④b", `cause attendue « refus », obtenue « ${resultat.cause} »`);
    } else {
      ok("④b", "la cause technique « refus » reste côté serveur, pour le journal");
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ⑤ UN WEBHOOK MUET REND LA MAIN — LE DÉLAI EST EXPLICITE
// ══════════════════════════════════════════════════════════════════════════════════════
{
  const faux = await fauxN8n("muet");
  const depart = Date.now();
  const resultat = await appelerAvec({ url: faux.url, jeton: JETON_TEMOIN });
  const ecoule = Date.now() - depart;
  await faux.fermer();

  // Marge de 3 s : on éprouve qu'un délai EXISTE et qu'il est celui déclaré par le produit,
  // pas la milliseconde près. Sans lui, l'attente serait celle du système (~2 min).
  const plafond = DELAI_PUBLICATION_MS + 3_000;
  if (resultat.ok) {
    ko("⑤", "un webhook qui ne répond jamais a produit un succès");
  } else if (ecoule > plafond) {
    ko("⑤", `la main a été rendue après ${ecoule} ms, au-delà du délai déclaré (${DELAI_PUBLICATION_MS} ms)`);
  } else if (resultat.cause !== "delai") {
    ko("⑤", `cause attendue « delai », obtenue « ${resultat.cause} » après ${ecoule} ms`);
  } else {
    ok("⑤", `webhook muet : main rendue en ${ecoule} ms (délai déclaré ${DELAI_PUBLICATION_MS} ms)`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ⑥ LE TRANSPORT : `https` OU BOUCLE LOCALE, ET RIEN D'AUTRE
// ══════════════════════════════════════════════════════════════════════════════════════
{
  const cas: [string, boolean, string][] = [
    ["https://n8n.exemple.fr/webhook/x", true, "https public"],
    ["http://127.0.0.1:5678/webhook/x", true, "boucle locale par IP"],
    ["http://localhost:5678/webhook/x", true, "boucle locale par nom"],
    ["http://n8n.exemple.fr/webhook/x", false, "http public — le jeton serait en clair"],
    ["HTTPS://n8n.exemple.fr/webhook/x", false, "casse : la garde est sensible à la casse, comme links.ts"],
    ["https:/n8n.exemple.fr", false, "un seul slash"],
    ["http://localhost.attaquant.fr/webhook/x", false, "🔴 SUFFIXE : hôte PUBLIC dont le nom commence par « localhost »"],
    ["http://127.0.0.1.attaquant.fr/x", false, "🔴 SUFFIXE sur l'IP de boucle locale"],
  ];
  let tousBons = true;
  for (const [url, attendu, pourquoi] of cas) {
    // En autotest on inverse l'attendu : la garde doit alors tomber sur chaque cas.
    const cible = AUTOTEST ? !attendu : attendu;
    if (transportAcceptable(url) !== cible) {
      tousBons = false;
      ko("⑥", `« ${url} » devrait être ${cible ? "accepté" : "refusé"} (${pourquoi})`);
    }
  }
  if (tousBons) ok("⑥", `les ${cas.length} bords du transport sont tenus (dont les 2 pièges de SUFFIXE)`);

  // Et la garde produit bien un REFUS à l'usage, pas seulement un booléen.
  const resultat = await appelerAvec({ url: "http://n8n.exemple.fr/webhook/x", jeton: JETON_TEMOIN });
  if (resultat.ok || resultat.cause !== "configuration") {
    ko("⑥b", "une URL http publique n'a pas été refusée à l'appel");
  } else {
    ok("⑥b", "une URL http publique est refusée AVANT toute émission réseau");
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ⑦ VARIABLE ABSENTE : MESSAGE UTILISABLE, ET LE MODULE S'IMPORTE QUAND MÊME
// ══════════════════════════════════════════════════════════════════════════════════════
{
  // Que ce fichier ait pu `import` `publierEvenement` sans que `N8N_WEBHOOK_URL` existe est
  // déjà la moitié de la garde : une lecture au niveau module aurait fait échouer l'import,
  // donc `next build`, donc la CI (garde-fou 1.7).
  const resultat = await appelerAvec({ url: undefined, jeton: undefined });
  if (resultat.ok) {
    ko("⑦", "l'appel a « réussi » sans URL de webhook configurée");
  } else if (resultat.cause !== "configuration") {
    ko("⑦", `cause attendue « configuration », obtenue « ${resultat.cause} »`);
  } else if (!resultat.error.includes(VARIABLES_N8N.url)) {
    ko("⑦", "le message ne nomme pas la variable manquante : il n'est pas actionnable");
  } else {
    ok("⑦", `variable absente : message actionnable nommant ${VARIABLES_N8N.url}, et module importable`);
  }
  // Vide ≠ absente, et les deux doivent se comporter pareil.
  const vide = await appelerAvec({ url: "   ", jeton: JETON_TEMOIN });
  if (vide.ok || vide.cause !== "configuration") {
    ko("⑦b", "une variable VIDE n'est pas traitée comme absente");
  } else {
    ok("⑦b", "une variable vide se comporte comme une variable absente");
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ⑧ LA DATE PORTE L'OFFSET DE PARIS, ET UN « Z » EST REFUSÉ
// ══════════════════════════════════════════════════════════════════════════════════════
{
  const instant = new Date("2026-08-13T17:00:00.000Z");
  const avecOffset = toParisIso(instant);
  if (!/\+02:00$/.test(avecOffset)) {
    ko("⑧", `toParisIso rend « ${avecOffset} » — l'offset d'été de Paris (+02:00) est attendu`);
  } else if (!avecOffset.startsWith("2026-08-13T19:00:00")) {
    ko("⑧", `toParisIso rend « ${avecOffset} » — 17:00 UTC est 19:00 à Paris en août`);
  } else {
    ok("⑧", `toParisIso rend l'heure MURALE avec son offset réel (${avecOffset})`);
  }

  // Le schéma du produit doit REFUSER la forme que produit `toISOString()`.
  const enZ = { ...payloadTemoin() };
  enZ.evenement = { ...enZ.evenement, debut: instant.toISOString() };
  const analyse = publicationPayloadSchema.safeParse(AUTOTEST ? payloadTemoin() : enZ);
  if (analyse.success) {
    ko("⑧b", "🔴 le schéma ACCEPTE une date en « Z » : n8n composerait une annonce fausse de deux heures");
  } else {
    ok("⑧b", "le schéma refuse une date en « Z » (le geste réflexe toISOString())");
  }

  // Et le refus doit se produire AVANT le réseau : rien ne part.
  const faux = await fauxN8n("accepte");
  const resultat = await appelerAvec({ url: faux.url, jeton: JETON_TEMOIN }, enZ);
  await faux.fermer();
  if (resultat.ok || resultat.cause !== "payload") {
    ko("⑧c", "un payload invalide n'a pas été arrêté avant le réseau");
  } else if (faux.recus.length !== 0) {
    ko("⑧c", "un payload invalide a quand même été émis sur le réseau");
  } else {
    ok("⑧c", "un payload invalide est arrêté AVANT le réseau (0 octet émis)");
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ⑨ UNICITÉ DE L'APPEL n8n (AR-API2) — ⚠️ LECTURE DE SOURCE, DÉCLARÉE
// ══════════════════════════════════════════════════════════════════════════════════════
{
  const fichiers: string[] = [];
  const parcourir = (rel: string) => {
    for (const entree of readdirSync(join(RACINE_APP, rel))) {
      const chemin = `${rel}/${entree}`;
      if (statSync(join(RACINE_APP, chemin)).isDirectory()) parcourir(chemin);
      else if (/\.(ts|tsx)$/.test(entree)) fichiers.push(chemin);
    }
  };
  parcourir("src");

  const lecteurs = fichiers.filter((f) => lireSource(f).includes(VARIABLES_N8N.url));
  // En autotest, on cherche une chaîne présente dans BEAUCOUP de fichiers : la garde doit tomber.
  const attendus = AUTOTEST
    ? fichiers.filter((f) => lireSource(f).includes("import"))
    : lecteurs;

  if (attendus.length !== 1 || (!AUTOTEST && attendus[0] !== "src/server/integrations/n8n.ts")) {
    ko("⑨", `${attendus.length} fichier(s) de src/ lisent ${VARIABLES_N8N.url} — AR-API2 en exige UN SEUL : ${attendus.slice(0, 5).join(", ")}`);
  } else {
    ok("⑨", `un seul fichier de src/ (${lecteurs[0]}) connaît ${VARIABLES_N8N.url} — AR-API2 tenu sur ${fichiers.length} fichiers`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ⑩ `requireAdmin()` EN TÊTE DE CHAQUE EXPORT — ⚠️ LECTURE DE SOURCE, DÉCLARÉE
// ══════════════════════════════════════════════════════════════════════════════════════
{
  // En autotest, on éprouve un fichier PUBLIC, qui n'a délibérément aucune garde de session :
  // la garde doit alors tomber.
  const cible = AUTOTEST ? "src/server/actions/solicitation.ts" : "src/server/actions/reseaux.ts";
  const source = lireSource(cible);
  const lignes = source.split("\n");
  const exports = lignes
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => /^export async function /.test(l));

  if (exports.length === 0) {
    ko("⑩", `aucun export asynchrone trouvé dans ${cible} : la garde ne mesure rien`);
  } else {
    const sansGarde = exports.filter(
      ({ i }) => !lignes.slice(i, i + 12).some((l) => /await requireAdmin\(\)/.test(l)),
    );
    if (sansGarde.length > 0) {
      ko("⑩", `${sansGarde.length}/${exports.length} export(s) de ${cible} sans requireAdmin() en tête : ${sansGarde.map((e) => e.l.trim()).join(" | ")}`);
    } else {
      ok(
        "⑩",
        `${exports.length} export${exports.length > 1 ? "s" : ""} de ${cible} ` +
          `${exports.length > 1 ? "ouvrent" : "ouvre"} par await requireAdmin()`,
      );
    }
  }

  // Et le refus d'un événement non publié doit être écrit, pas seulement affiché par l'écran.
  if (!/isPublished/.test(source)) {
    ko("⑩b", "l'action ne consulte pas isPublished : elle annoncerait un événement hors ligne");
  } else {
    ok("⑩b", "l'action refuse elle-même un événement non publié (l'écran n'est pas la garde)");
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ⑪ ABSENCE : AUCUNE COLONNE DE « TEXTE D'ANNONCE » SUR `event`
// ══════════════════════════════════════════════════════════════════════════════════════
{
  const url = (() => {
    const brut = readFileSync(join(RACINE_APP, ".env.local"), "utf8");
    return /^DATABASE_URL=(.*)$/m.exec(brut)?.[1]?.trim() ?? null;
  })();

  if (!url) {
    ko("⑪", "DATABASE_URL introuvable dans .env.local : la garde d'ABSENCE ne peut pas être exercée");
  } else {
    const sql = postgres(url, { max: 1, onnotice: () => {} });
    try {
      const colonnes = (
        await sql<{ column_name: string }[]>`
          select column_name from information_schema.columns
          where table_name = 'event' and table_schema = 'public'
        `
      ).map((c) => c.column_name);

      if (!colonnes.includes("social_posted_at")) {
        ko("⑪", "la colonne social_posted_at est absente : la trace de la story n'existe pas");
      } else {
        ok("⑪", "event.social_posted_at existe (la trace, seul filet d'un effet hors du site)");
      }

      // 🔴 L'ABSENCE EST LE LIVRABLE : la composition du message vit dans n8n, pas en base.
      // En autotest, on interdit une colonne qui EXISTE : la garde doit alors tomber.
      const interdits = AUTOTEST
        ? [/^title$/]
        : [/post_text/, /annonce/, /caption/, /social_message/, /social_status/, /^brouillon/];
      const fautives = colonnes.filter((c) => interdits.some((r) => r.test(c)));
      if (fautives.length > 0) {
        ko("⑪b", `colonne(s) de texte d'annonce sur event : ${fautives.join(", ")} — la composition doit rester dans n8n`);
      } else {
        ok("⑪b", `aucune colonne de texte d'annonce sur event (${colonnes.length} colonnes vérifiées)`);
      }
    } finally {
      await sql.end({ timeout: 5 });
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// ⑫ LE WORKFLOW VERSIONNÉ : AUCUN NŒUD SOCIAL, AUCUN SECRET
// ══════════════════════════════════════════════════════════════════════════════════════
{
  const brut = lireSource("n8n/publication-reseaux.json");
  const wf = JSON.parse(brut) as {
    nodes: { type: string; disabled?: boolean; parameters?: Record<string, unknown> }[];
  };

  // 🔴 ON LIT LES **TYPES DE NŒUDS**, PAS LE TEXTE DU FICHIER. Une recherche de la chaîne
  // « discord » tomberait sur le COMMENTAIRE qui déclare leur absence — c'est exactement le
  // défaut d'instrument payé en 6.11 puis en 6.13 (« la porte accuse le texte qui porte la
  // règle qu'elle garde »). Mesuré ici aussi, avant d'écrire cette garde.
  const sociaux = wf.nodes.filter((n) =>
    /instagram|twitter|discord|facebook|linkedin|mastodon|telegram/i.test(n.type),
  );
  // En autotest, on interdit le type qui EST là : la garde doit alors tomber.
  const fautifs = AUTOTEST ? wf.nodes.filter((n) => /webhook/i.test(n.type)) : sociaux;
  if (fautifs.length > 0) {
    ko("⑫", `${fautifs.length} nœud(s) de publication dans le workflow versionné : ${fautifs.map((n) => n.type).join(", ")} — le périmètre A1 dit qu'ils sont ABSENTS`);
  } else {
    ok("⑫", `aucun nœud de publication sociale dans le workflow versionné (${wf.nodes.length} nœuds)`);
  }

  // ⚠️ Un nœud DÉSACTIVÉ ressemble à une livraison — c'est la forme que prend R32.
  const desactives = wf.nodes.filter((n) => n.disabled === true);
  if (desactives.length > 0) {
    ko("⑫b", `${desactives.length} nœud(s) désactivé(s) : un nœud désactivé RESSEMBLE à une livraison (R32)`);
  } else {
    ok("⑫b", "aucun nœud désactivé : ce qui n'est pas livré est absent, pas éteint");
  }

  // Le fichier est commité : il ne doit porter aucune valeur de secret.
  const jetonReel = process.env[VARIABLES_N8N.jeton];
  if (jetonReel && jetonReel.length > 8 && brut.includes(jetonReel)) {
    ko("⑫c", "🔴 la valeur de N8N_WEBHOOK_TOKEN est présente dans le workflow VERSIONNÉ");
  } else {
    ok("⑫c", "le workflow versionné ne porte qu'une référence de credential, jamais sa valeur");
  }

  // Et la réponse doit venir d'un nœud « Respond to Webhook », jamais « immediately ».
  const webhook = wf.nodes.find((n) => /nodes-base\.webhook$/.test(n.type));
  if (webhook?.parameters?.responseMode !== "responseNode") {
    ko("⑫d", "le webhook ne répond pas via « Respond to Webhook » : un 200 rendu avant validation serait un FAUX SUCCÈS");
  } else {
    ok("⑫d", "le webhook répond APRÈS validation (responseNode) — le 200 veut donc dire quelque chose");
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════
// RAPPORT
// ══════════════════════════════════════════════════════════════════════════════════════
exemptions.add(
  "Le RENDU du bouton et de la trace : place dans la ligne, ton de la confirmation, ce qui " +
    "MANQUE. C'est la passe 1 du gate visuel, et elle ne s'outille pas (rétro Epic 5).",
);
exemptions.add(
  "🔴 LE MAILLON AVAL — ce que n8n fait du message. Cette porte s'arrête à l'octet émis. " +
    "Qu'une annonce PARAISSE sur un réseau social n'est ni mesuré ni livré (dette R42, et " +
    "c'est le périmètre A1 arbitré par Brice).",
);
exemptions.add(
  "Que `requireAdmin()` soit réellement ATTEINT : la garde ⑩ lit le source, elle ne peut pas " +
    "ouvrir de session. Un appel sans cookie est arrêté par le proxy AVANT l'action — " +
    "exemption héritée de `gate:admin`, `gate:membres` et `gate:sollicitations`.",
);
exemptions.add(
  "Le VRAI webhook n8n : cette porte ne l'appelle JAMAIS (elle fabrique le sien). Une porte " +
    "qui publierait pour se tester émettrait de vraies annonces à chaque exécution. Le vrai " +
    "appel est le VERIFY D'ENTRÉE, fait à la main une fois, et consigné dans la story.",
);
exemptions.add(
  "La règle de date écrite DANS le workflow n8n (JavaScript côté n8n) : aucune porte de ce " +
    "dépôt ne peut la lire. Elle se relit à la main — `apps/vitrine/n8n/README.md` le dit.",
);

console.log();
for (const s of succes) console.log("  ✅ " + s);
if (exemptions.size > 0) {
  console.log();
  console.log(`  ⚠️  ${exemptions.size} EXEMPTION(S) DÉCLARÉE(S) — cette porte NE les couvre PAS :`);
  for (const e of [...exemptions].sort()) console.log("     · " + e);
  console.log("     Une porte verte ne veut donc PAS dire « tout est couvert ».");
}
if (echecs.length > 0) {
  console.log();
  for (const e of echecs) console.log("  ❌ " + e);
}

/** Gardes qui n'ont produit QU'un `ok` en autotest : aucun cas d'échec ne leur a été présenté. */
const nonEprouvees = [...vertes].filter((g) => !vues.has(g)).sort();

if (AUTOTEST) {
  if (echecs.length === 0) {
    console.log("\n🔴 AUTO-VALIDATION ÉCHOUÉE — chaque garde a reçu un cas qu'elle devait voir,");
    console.log("   et la porte reste verte. L'instrument ne mesure rien : ne pas s'y fier.");
    process.exit(1);
  }
  console.log(
    `\n✅ INSTRUMENT VALIDE — ${vues.size} garde(s) sur ${vues.size + nonEprouvees.length} ont vu le cas qu'on leur présentait.`,
  );
  // 🔴 CE QUE L'AUTOTEST NE PROUVE PAS EST DIT ICI (doctrine `gate:ateliers`), et le compte
  // est DÉRIVÉ, pas recopié — voir l'en-tête de `vues`/`vertes`.
  if (nonEprouvees.length > 0) {
    console.log(
      `\n   ⚠️  ${nonEprouvees.length} GARDE(S) N'ONT AUCUN CAS D'AUTO-VALIDATION : ${nonEprouvees.join(", ")}`,
    );
    console.log("      Leur verdict vert repose sur la mesure d'un cas NOMINAL, pas d'un échec.");
    // 🔴 AUCUN IDENTIFIANT DE GARDE N'EST RECOPIÉ CI-DESSOUS, ET C'EST DÉLIBÉRÉ. Une première
    // version listait les trois familles garde par garde : elle était **déjà fausse d'une
    // garde** (⑥b) à sa première exécution. Deux énumérations de la même chose divergent
    // toujours — la liste ci-dessus est DÉRIVÉE, celle-ci ne décrit que des RAISONS.
    console.log("      Trois familles, et pourquoi c'est assumé :");
    console.log("      · celles dont le cas d'échec EST déjà un échec fabriqué (webhook en 500,");
    console.log("        webhook muet, variable absente) : l'inverser reviendrait à ré-exécuter le");
    console.log("        cas nominal, ou à casser le faux n8n — donc à valider le banc de mesure");
    console.log("        au lieu du produit ;");
    console.log("      · celles qui constatent une PRÉSENCE (jeton dans le bon en-tête, offset");
    console.log("        réel, colonne de trace) : leur inverse est le cas nominal d'une autre");
    console.log("        garde du même bloc, déjà éprouvée ;");
    console.log("      · celles qui lisent le workflow VERSIONNÉ : leur présenter un faux cas");
    console.log("        demanderait un second fichier de test que personne n'importe");
    console.log("        (`00 référence/pieges/garde-nominale.md`).");
  }
  process.exit(0);
}

if (echecs.length > 0) {
  console.log(`\n🔴 ${echecs.length} GARDE(S) EN ÉCHEC.`);
  process.exit(1);
}
console.log(`\n✅ ${succes.length} GARDE(S) VERTE(S).`);
process.exit(0);
