// 🔬 GARDE DE LA FRONTIÈRE DE SÉCURITÉ DU BACK-OFFICE (Story 6.1, FR27, FR28, AR-SEC2).
//
// Pourquoi un contrôle dédié — même motif que `gate:lightbox` / `gate:carousel` /
// `gate:marquee` / `gate:solicitation` / `gate:links` :
//
//   défaut possible                                              lint/build  Lighthouse  gate  œil
//   `/admin` accessible sans session                                 ❌          ❌       ❌   ⚠️
//   une sous-route d'admin non couverte par le matcher               ❌          ❌       ❌   ❌
//   la page est RENDUE puis redirigée (le HTML a fuité)              ❌          ❌       ❌   ❌
//   la garde teste la PRÉSENCE d'un cookie, pas sa VALIDITÉ          ❌          ❌       ❌   ❌
//   `/admin/login` devient inatteignable (boucle de redirection)     ❌          ❌       ❌   ⚠️
//   le matcher avale `/api/auth/*` → l'OAuth ne peut plus revenir    ❌          ❌       ❌   ⚠️
//   une page publique se met à exiger une session (régression FR28)  ❌          ❌       ❌   ⚠️
//
// 🔴 CE QUI DISTINGUE CETTE PORTE : elle interroge le serveur SANS AUCUN COOKIE, ce qui est
// très exactement la question posée. `gate` et `gate:links` pilotent un navigateur — donc
// un contexte qui pourrait porter une session et rendre la mesure fausse sans le dire. Ici
// on parle HTTP nu : pas de session possible, donc pas de faux vert possible.
//
// ⚠️ CE QU'ELLE NE COUVRE PAS, ET C'EST DÉCLARÉ EN SORTIE : le chemin AUTHENTIFIÉ. Il exige
// un vrai aller-retour Discord, avec un humain devant l'écran de consentement. C'est le
// verify d'entrée de l'AC3, il se fait à la main, et aucune porte ne le remplacera.
//
// Usage :  node tools/visual-gate/admin-check.mjs [baseUrl]
//          ADMIN_AUTOTEST=1 …  → auto-validation de l'instrument (voir plus bas)
import { PAGES, BASE as BASE_DEFAUT } from "./config.mjs";

const BASE = process.argv[2] ?? BASE_DEFAUT;
const AUTOTEST = process.env.ADMIN_AUTOTEST === "1";

// 🔴 ROUTES PROTÉGÉES ÉPROUVÉES. La seconde n'existe pas, et c'est le sujet : la garde doit
// couvrir le SOUS-ARBRE `/admin/*`, pas une liste de routes connues. Une garde écrite route
// par route laisserait passer chaque écran ajouté par les Stories 6.3 → 6.13.
const ROUTES_PROTEGEES = ["/admin", "/admin/segment-qui-nexiste-pas", "/admin/agenda"];

// En autotest, on présente à la porte une route qu'on SAIT ouverte (`/admin/login`) comme si
// elle devait être protégée. Si les gardes sont réelles, elles échouent. Si elles restent
// vertes, c'est qu'elles ne mesurent rien — et il ne faut pas se fier à leurs verdicts.
const ROUTES_EPROUVEES = AUTOTEST ? ["/admin/login"] : ROUTES_PROTEGEES;

// Marqueurs de CONTENU d'administration. Leur présence dans une réponse servie SANS session
// est une fuite, quel que soit le code de statut.
//
// 🔴 « Back-office » SEUL NE FIGURE PAS ICI, ET C'EST UNE CORRECTION D'INSTRUMENT, PAS UN
// ASSOUPLISSEMENT. Première version de cette porte : le marqueur était la chaîne
// « Back-office ». Mesuré le 2026-08-02, elle apparaît DEUX fois dans la réponse d'une
// redirection parfaitement propre — `<title>Back-office · Esport des Sacres</title>` et son
// double dans la charge de métadonnées RSC. Next évalue les `metadata` du segment même quand
// le rendu s'interrompt par un `redirect()`. Un titre ne révèle rien que l'URL `/admin` ne
// dise déjà : le retenir aurait fabriqué un échec permanent, c'est-à-dire une porte qu'on
// finit par débrancher.
//
// ⚠️ La contrepartie est vérifiée, pas supposée : avec la garde du proxy ET celle de la page
// débranchées, ces quatre marqueurs-ci voient bien la fuite réelle (le tableau de bord entier
// sérialisé dans la charge RSC). L'instrument a été rejoué rouge APRÈS ce resserrement.
const MARQUEURS_ADMIN = [
  "Se déconnecter", // chrome du shell (layout)
  "Sections du back-office", // libellé du <nav>
  "Les sections arrivent", // état vide du tableau de bord
  "page-module__", // classes CSS Modules des écrans d'administration
];

// Nom du cookie de session d'Auth.js v5. ⚠️ Le préfixe `__Secure-` est OBLIGATOIRE en HTTPS :
// codé en dur pour HTTP, la garde ④ passerait TRIVIALEMENT contre un déploiement en https —
// non pas parce que la session est refusée, mais parce qu'Auth.js ne reconnaîtrait même pas
// le nom du cookie envoyé. Un vert qui ne mesure rien est pire qu'un rouge. Trouvé en revue
// (Edge Case Hunter) ; le nom se DÉDUIT donc du schéma de l'URL visée.
const COOKIE_SESSION = BASE.startsWith("https:")
  ? "__Secure-authjs.session-token"
  : "authjs.session-token";

const echecs = [];
const succes = [];
const exemptions = new Set();
const ko = (garde, ou, quoi) => echecs.push(`${garde} ${ou} — ${quoi}`);
const ok = (garde, ou, quoi) => succes.push(`${garde} ${ou} — ${quoi}`);

/** Requête SANS suivi de redirection : on veut observer la redirection elle-même. */
async function demander(chemin, entetes = {}) {
  const reponse = await fetch(BASE + chemin, {
    redirect: "manual",
    headers: { ...entetes },
  });
  return {
    statut: reponse.status,
    emplacement: reponse.headers.get("location"),
    corps: await reponse.text(),
  };
}

const estRedirection = (statut) => statut >= 300 && statut < 400;
const versLogin = (emplacement) =>
  typeof emplacement === "string" && emplacement.includes("/admin/login");

console.log(`\n🔎 Frontière de sécurité du back-office — ${BASE}`);
if (AUTOTEST) {
  console.log("   ⚙️  MODE AUTO-VALIDATION : une route OUVERTE est présentée comme protégée.");
}
console.log();

// ── ① / ② / ③  Les routes protégées redirigent, et ne fuitent rien ──────────────────
for (const route of ROUTES_EPROUVEES) {
  const r = await demander(route);

  if (!estRedirection(r.statut)) {
    ko("① redirection", route, `statut ${r.statut} au lieu d'une redirection`);
  } else if (!versLogin(r.emplacement)) {
    ko("① redirection", route, `redirige vers « ${r.emplacement} » et non vers /admin/login`);
  } else {
    ok("① redirection", route, `${r.statut} → ${r.emplacement}`);
  }

  // ③ Une redirection qui a d'abord RENDU la page aurait laissé fuir son HTML.
  const fuite = MARQUEURS_ADMIN.filter((m) => r.corps.includes(m));
  if (fuite.length > 0) {
    ko("③ non-fuite", route, `le corps servi contient ${fuite.map((f) => `« ${f} »`).join(", ")}`);
  } else {
    ok("③ non-fuite", route, `aucun contenu d'administration dans le corps (${r.corps.length} o)`);
  }
}

// ── ④  La garde valide la SESSION, elle ne se contente pas d'un cookie présent ───────
{
  const r = await demander("/admin", {
    cookie: `${COOKIE_SESSION}=jeton-forge-qui-ne-correspond-a-rien`,
  });
  if (!estRedirection(r.statut) || !versLogin(r.emplacement)) {
    ko(
      "④ session validée",
      "/admin",
      `un cookie FORGÉ obtient ${r.statut} → ${r.emplacement} : la garde teste la présence du ` +
        "cookie et non sa validité",
    );
  } else {
    ok("④ session validée", "/admin", "un cookie forgé est refusé comme une absence de session");
  }
}

// ── ⑤  La page de connexion reste atteignable (sinon le back-office est murré) ───────
{
  const r = await demander("/admin/login");
  if (r.statut !== 200) {
    ko(
      "⑤ login ouvert",
      "/admin/login",
      `statut ${r.statut}${estRedirection(r.statut) ? " (boucle de redirection ?)" : ""}`,
    );
  } else {
    ok("⑤ login ouvert", "/admin/login", "200 sans session");
  }
}

// ── ⑥  Le flux OAuth n'est pas avalé par le matcher ─────────────────────────────────
{
  const r = await demander("/api/auth/csrf");
  if (r.statut !== 200) {
    ko("⑥ flux OAuth", "/api/auth/csrf", `statut ${r.statut} — le callback ne pourrait pas revenir`);
  } else {
    ok("⑥ flux OAuth", "/api/auth/csrf", "200 — /api/auth/* hors du matcher");
  }

  // ⚠️ Second échantillon ajouté après revue (Edge Case Hunter) : `/api/auth/csrf` seul ne
  // prouvait rien sur LE chemin réellement critique. On n'attend pas 200 (sans `state` ni
  // `code`, Auth.js refuse légitimement) — on exige seulement qu'il ne soit pas DÉTOURNÉ
  // vers le login par le MATCHER.
  //
  // 🔴 INSTRUMENT FAUX À SA PREMIÈRE EXÉCUTION, ET IL ACCUSAIT LE PRODUIT — corrigé ici.
  // La première version concluait « capturé par le matcher » sur toute redirection vers
  // `/admin/login`. Or Auth.js redirige LUI-MÊME vers `/admin/login?error=Configuration`
  // (c'est notre `pages.error`) quand le callback est appelé sans `state` ni `code`, ce qui
  // est exactement le cas d'un appel à froid. Mesuré : `302 → http://…/admin/login?error=…`.
  // ⇒ Le discriminant n'est PAS la destination, c'est la SIGNATURE : seul `proxy.ts` ajoute
  // `?next=`. C'est la 8ᵉ fois qu'un instrument de ce dossier est faux avant de servir, et la
  // 3ᵉ fois qu'il accuse le produit (`pieges/instrument-non-valide.md`).
  const c = await demander("/api/auth/callback/discord");
  const captureParLeMatcher =
    estRedirection(c.statut) &&
    versLogin(c.emplacement) &&
    (c.emplacement ?? "").includes("next=");
  if (captureParLeMatcher) {
    ko(
      "⑥ flux OAuth",
      "/api/auth/callback/discord",
      "capturé par le matcher de /admin — le retour de Discord serait impossible",
    );
  } else {
    ok("⑥ flux OAuth", "/api/auth/callback/discord", `hors matcher (statut ${c.statut})`);
  }
}

// ── ⑦  FR28 : la vitrine publique reste sans login ──────────────────────────────────
for (const page of PAGES) {
  const r = await demander(page);
  if (r.statut !== 200) {
    ko("⑦ public sans login", page, `statut ${r.statut} sans cookie (régression FR28)`);
  } else {
    ok("⑦ public sans login", page, "200 sans aucun cookie");
  }
}

// La route de service des médias vit HORS du groupe (public) — comme `/admin`. Elle est donc
// le meilleur témoin qu'un matcher élargi capturerait par erreur. On n'exige pas un fichier
// précis (le seed varie) : on exige seulement qu'elle ne soit PAS renvoyée vers le login.
{
  const r = await demander("/medias/fichier-inexistant-pour-la-porte.jpg");
  if (estRedirection(r.statut) && versLogin(r.emplacement)) {
    ko("⑦ public sans login", "/medias/[filename]", "capturée par le matcher de /admin");
  } else {
    ok("⑦ public sans login", "/medias/[filename]", `hors matcher (statut ${r.statut})`);
  }
}

exemptions.add(
  "Le chemin AUTHENTIFIÉ (login réel, session établie, déconnexion) — il exige un aller-retour " +
    "Discord avec un humain devant l'écran de consentement.",
);
exemptions.add(
  "🔴 STORIES 6.3 → 6.13 : cette porte NE PEUT PAS dire si une nouvelle page d'administration " +
    "appelle bien sa PROPRE garde. La garde ③ interroge sans cookie, or le proxy redirige alors " +
    "AVANT que la page ne s'exécute — la fuite est donc structurellement inobservable ici. Le " +
    "défaut existe pourtant (mesuré le 2026-08-02 : un layout ne stoppe pas le rendu de sa page " +
    "enfant, et le corps du 307 portait tout le tableau de bord). Seule une session RÉELLE le " +
    "révélerait. ⇒ À chaque nouvelle page d'admin, relire qu'elle appelle la garde en 1ʳᵉ ligne.",
);
exemptions.add(
  "Le contenu et l'apparence du shell une fois connecté — c'est le gate visuel de Brice, " +
    "et la passe 1 ne s'outille pas (rétro Epic 5).",
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
console.log();

if (AUTOTEST) {
  if (echecs.length === 0) {
    console.log("🔴 AUTO-VALIDATION ÉCHOUÉE — une route OUVERTE a été présentée comme protégée");
    console.log("   et la porte reste verte. L'instrument ne mesure rien : ne pas s'y fier.");
    process.exit(1);
  }
  console.log(`✅ INSTRUMENT VALIDE — route ouverte présentée comme protégée, ${echecs.length} garde(s) l'ont vu.`);
  console.log("   Un « FRONTIÈRE TENUE » d'admin-check.mjs a donc du contenu.");
  process.exit(0);
}

if (echecs.length > 0) {
  console.log(`🔴 ${echecs.length} GARDE(S) EN ÉCHEC.`);
  process.exit(1);
}
console.log("✅ FRONTIÈRE TENUE — mesurée en HTTP nu, sans aucun cookie, donc sans faux vert possible.");
