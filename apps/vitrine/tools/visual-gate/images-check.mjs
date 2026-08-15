// @porte surface=medias effet=lecture story=4.3
// 🔬 GARDE DES IMAGES SERVIES (Story 4.3).
//
// ══════════════════════════════════════════════════════════════════════════════════
// CETTE PORTE EXISTE PARCE QU'UNE IMAGE A DISPARU DU SITE SANS QUE RIEN NE LE DISE.
// ══════════════════════════════════════════════════════════════════════════════════
//
// Le 2026-07-31, la Story 4.3 a ajouté `images.localPatterns` dans `next.config.ts`
// pour restreindre l'optimiseur. La liste ne couvrait que `/medias/**`, sur la foi d'un
// grep de `unoptimized` — et le logo EDS ne passe pas `unoptimized`.
// Résultat : `/_next/image?url=/logo-eds-blanc.png` répondait **400**, et
// **LE LOGO AVAIT DISPARU DU HEADER ET DU FOOTER, SUR LES CINQ PAGES**.
//
//   porte                  a-t-elle vu ?   pourquoi
//   lint / typecheck            ❌          l'URL est valide, le composant compile
//   build                       ❌          l'optimiseur ne tourne qu'à l'exécution
//   gate (débordement)          ❌          une image absente ne déborde pas
//   gate:lightbox               ❌          elle mesure le focus, pas les octets
//   Lighthouse a11y + SEO       ❌          l'`alt` est présent ; le 400 n'est pas audité
//   l'œil                       ✅          Brice, en 30 secondes
//
// C'est exactement la configuration de la dette **R19** (header non sticky pendant
// 9 stories, CI verte, Lighthouse 100/100) : un livrable annulé, aucune porte pour le
// voir. D'où celle-ci.
//
// CE QU'ELLE VÉRIFIE — le HTML SERVI, pas le code source :
//   ① toute URL d'image référencée par une page répond **200** ;
//   ② elle rend bien un `Content-Type: image/*` — un 200 qui renvoie du HTML (page
//      d'erreur, redirection avalée) serait un faux vert ;
//   ③ elle rend au moins un octet.
//
// 🔴 ELLE LIT LE `srcset` AUTANT QUE LE `src`. Une variante d'optimiseur peut échouer
// alors que la source directe répond : c'est précisément ce qui s'est produit ici, où
// `/logo-eds-blanc.png` répondait 200 en direct et 400 à travers `/_next/image`.
//
// Usage :  node tools/visual-gate/images-check.mjs [baseUrl]
//          IMAGES_CASSER=1 …  → auto-validation de l'instrument
import { PAGES, BASE as BASE_DEFAUT, resoudreFicheTournoi } from "./config.mjs";

const BASE = process.argv[2] ?? BASE_DEFAUT;

/**
 * 🔬 AUTO-VALIDATION (`pieges/instrument-non-valide.md`). Avec `IMAGES_CASSER=1`, on
 * injecte une URL d'image délibérément inexistante dans la liste relevée : la porte DOIT
 * échouer. Une porte dont on n'a jamais vu l'échec ne prouve pas qu'elle mesure quelque
 * chose — et sur ce projet l'instrument a été faux six fois.
 */
const CASSER = process.env.IMAGES_CASSER === "1";

/** Extrait toutes les URL d'images d'un document : `src`, `srcset`/`srcSet`, `content`. */
function urlsImages(html) {
  const trouvees = new Set();

  // `src="..."` sur les <img> uniquement — on ne veut ni les <script> ni les <link>.
  for (const balise of html.match(/<img[^>]*>/g) ?? []) {
    const src = balise.match(/\ssrc="([^"]+)"/);
    if (src) trouvees.add(src[1]);
    // `srcset` porte « url largeur, url largeur, … » — chaque candidat est une URL
    // distincte, et c'est là que vivent les variantes de l'optimiseur.
    const set = balise.match(/\ssrc[sS]et="([^"]+)"/);
    if (set) {
      for (const candidat of set[1].split(",")) {
        const url = candidat.trim().split(/\s+/)[0];
        if (url) trouvees.add(url);
      }
    }
  }

  return [...trouvees]
    // Les entités HTML du markup rendu (`&amp;` dans les URL de l'optimiseur) doivent
    // être défaites avant la requête, sinon on interroge une URL qui n'existe pas et la
    // porte échoue sur son propre décodage — un faux positif.
    .map((u) => u.replaceAll("&amp;", "&"))
    // `data:` est inline, il n'y a rien à aller chercher.
    .filter((u) => !u.startsWith("data:"))
    // Externe : hors périmètre (le site n'en a pas aujourd'hui, mais la porte ne doit
    // pas se mettre à dépendre d'un tiers le jour où il y en aura une).
    .filter((u) => !/^https?:\/\//.test(u));
}

const echecs = [];
let controles = 0;

console.log(`\n  Base : ${BASE}\n`);

// 🔴 [AJOUTÉ le 2026-08-14, Story 9.3.] LA 7ᵉ PAGE EST DYNAMIQUE, ET SON URL SE DÉRIVE.
// `/tournois/<slug>` est résolue depuis le site lui-même (premier lien de fiche rendu par
// `/tournois`), jamais écrite en dur — un slug figé ferait rougir cette porte sur un produit
// sain le jour d'une dépublication (dette R46). Aucun tournoi publié est un état LÉGITIME.
// ⚠️ Elle compte ici : la fiche rend le VISUEL du tournoi en grand, et c'est la seule porte qui
// exige 200 + octets d'image sur toute URL référencée par une page.
const fiche = await resoudreFicheTournoi(BASE);
if (fiche.url) console.log(`   ✅ Fiche de tournoi couverte : ${fiche.url}.`);
else console.log(`   ⚠️ Fiche de tournoi NON couverte — ${fiche.raison}. Ce n'est pas un succès.`);
const pagesBalayees = fiche.url ? [...PAGES, fiche.url] : PAGES;

for (const page of pagesBalayees) {
  const reponse = await fetch(BASE + page).catch(() => null);
  if (!reponse?.ok) {
    console.error(`\n❌ ${page} ne répond pas correctement (${reponse?.status ?? "aucune réponse"}).`);
    console.error("   Lancer : pnpm --filter vitrine build && pnpm --filter vitrine start");
    console.error("   ⚠️ `/`, `/agenda` et `/partenaires` LISENT LA BASE : le Postgres de dev");
    console.error("      doit tourner, sinon la porte ne mesure RIEN.\n");
    process.exit(2);
  }
  const html = await reponse.text();
  const urls = urlsImages(html);
  if (CASSER) urls.push("/_next/image?url=%2Fabsente-volontairement.png&w=384&q=75");

  console.log(`  ── ${page} — ${urls.length} URL(s) d'image ──`);
  if (urls.length === 0) {
    // Pas un échec en soi (une page peut n'avoir aucune image), mais on le DIT : un
    // « 0 image, tout va bien » ressemble à s'y méprendre à « la porte n'a rien mesuré ».
    console.log("     ⚠️  aucune image référencée — cette page n'est donc pas couverte.\n");
    continue;
  }

  for (const url of urls) {
    controles++;
    const r = await fetch(BASE + url).catch(() => null);
    const type = r?.headers.get("content-type") ?? "";
    const octets = r?.ok ? (await r.arrayBuffer()).byteLength : 0;
    const ok = !!r?.ok && type.startsWith("image/") && octets > 0;
    const court = url.length > 68 ? url.slice(0, 65) + "…" : url;
    console.log(
      `     ${ok ? "✅" : "❌"} ${court.padEnd(70)} ${r?.status ?? "—"} ${type.split(";")[0] || "—"} ${octets} o`,
    );
    if (!ok) echecs.push(`${page} → ${url} (HTTP ${r?.status ?? "—"}, ${type || "sans type"}, ${octets} o)`);
  }
  console.log("");
}

if (echecs.length === 0) {
  if (CASSER) {
    console.error(
      "\n❌ AUTO-VALIDATION EN ÉCHEC : une URL délibérément inexistante a été injectée et" +
        "\n   la porte est restée VERTE. Elle ne mesure donc rien — la corriger AVANT de" +
        "\n   se fier à un vert (`pieges/instrument-non-valide.md`).\n",
    );
    process.exit(1);
  }
  console.log(
    `✅ IMAGES CONFORMES — ${controles} URL(s) servie(s) sur ${pagesBalayees.length} pages répondent 200 avec des octets d'image.\n`,
  );
  process.exit(0);
}

if (CASSER) {
  console.log("\n✅ AUTO-VALIDATION RÉUSSIE : URL inexistante injectée ⇒ la porte a bien ÉCHOUÉ sur :\n");
  for (const e of echecs) console.log("   " + e);
  console.log("");
  process.exit(0);
}

console.error(`\n❌ ${echecs.length} IMAGE(S) NON SERVIE(S) :\n`);
for (const e of echecs) console.error("   " + e);
console.error(
  "\n   ⚠️ Un 400 sur `/_next/image?url=…` vient presque toujours de `images.localPatterns`" +
    "\n      dans next.config.ts : le chemin n'y est pas listé. Voir le commentaire sur place.\n",
);
process.exit(1);
