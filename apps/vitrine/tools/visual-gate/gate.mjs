// 🔴 PORTE DE LA DoD — sort en code 1 si une garde tombe.
//
// C'est la différence entre un script et une porte : celui-ci ÉCHOUE. Les autres
// fichiers de ce dossier produisent des relevés qu'un humain lit ; celui-ci rend un
// verdict qu'une commande peut exiger.
//
// Il couvre les défauts que NI lint, NI typecheck, NI build, NI Lighthouse (périmètre
// a11y + SEO) ne voient — inventaire complet dans
// `00 référence/pieges/dette-invisible.md`, section « Ce que les portes voient ».
//
//   ① DÉBORDEMENT HORIZONTAL (dette R14, tranchée à la rétro Epic 2)
//      `globals.css` pose `overflow-x: clip` : un dépassement est rogné EN SILENCE
//      — ni scrollbar, ni avertissement, et notre périmètre Lighthouse n'a aucun
//      audit de largeur. Cette mesure est le SEUL témoin.
//      ⚠️ Ne jamais repasser `clip` à `hidden` : `body` redeviendrait un conteneur
//      de défilement → header non sticky ET apparitions au scroll figées (2.8).
//
//   ② HEADER STICKY (dette R19)
//      A dormi 9 stories, en annulant le livrable central de la Story 1.4, avec CI
//      verte et Lighthouse 100/100. `position: sticky` PRÉSENT dans le CSS ne prouve
//      rien : la garde est comportementale — on scrolle, puis on relève la position.
//
//   ④ DÉBORDEMENT DE TEXTE **À L'INTÉRIEUR DE SA PROPRE BOÎTE** (dette R38, Story 6.10)
//      ① balaie les BOÎTES ; une boîte ne grandit pas quand un mot insécable dépasse —
//      c'est le TEXTE qui déborde d'elle, et `overflow-x: clip` le rogne EN SILENCE.
//      MESURÉ en 6.9 : un intitulé de 80 caractères insécables (saisie VALIDE) faisait
//      248px de boîte pour 2006px de texte à 320px de viewport — 1758px — et cette
//      porte restait VERTE. Le témoin juste est `scrollWidth > clientWidth` PAR
//      ÉLÉMENT (à ne pas confondre avec le témoin INTERDIT du projet, qui porte sur le
//      DOCUMENT et qui est aveugle sous `clip`). Exclusions déclarées en sortie.
//
//   ③ CLASSES FANTÔMES
//      `styles.xxx` sur une classe inexistante vaut `undefined` et atterrit tel quel
//      dans l'attribut `class`. Les CSS Modules ne sont pas typés ici : lint,
//      typecheck et build restent verts pendant que le rendu perd des déclarations.
//      Défaut réellement introduit en Story 2.10, attrapé par cette mesure.
//
// Usage :  node tools/visual-gate/gate.mjs [baseUrl]
//          (le serveur de PRODUCTION doit tourner : `pnpm build && pnpm start`)
import { launchChrome } from "./cdp.mjs";
import { PROBE, STICKY } from "./probe.mjs";
import { BASE as BASE_DEFAUT, PAGES, WIDTHS } from "./config.mjs";

const BASE = process.argv[2] ?? BASE_DEFAUT;

// Témoin d'EFFET avant de commencer : un port qui répond ne prouve pas que le bon
// serveur tourne (`00 référence/pieges/faux-succes.md`).
const sonde = await fetch(BASE + PAGES[0]).catch(() => null);
if (!sonde?.ok) {
  console.error(`\n❌ Rien ne répond correctement sur ${BASE}${PAGES[0]}.`);
  console.error("   Lancer d'abord : pnpm --filter vitrine build && pnpm --filter vitrine start\n");
  process.exit(2);
}

const chrome = await launchChrome();
// Mouvement réduit émulé : sans ça, une animation d'entrée encore en vol rend la
// mesure non déterministe (`pieges/instrument-non-valide.md`).
await chrome.setEmulatedMedia({ "prefers-reduced-motion": "reduce" });

const echecs = [];
let controles = 0;

try {
  for (const page of PAGES) {
    for (const width of WIDTHS) {
      await chrome.setViewport(width);
      await chrome.goto(BASE + page);
      const d = await chrome.eval(PROBE);
      const s = await chrome.eval(STICKY, true);
      const ou = `${page} @${width}px`;
      controles += 4;

      for (const b of d.overflow.debordements) {
        const sens = b.depasseADroite
          ? `déborde de ${b.depasseADroite}px À DROITE`
          : `déborde de ${b.depasseAGauche}px À GAUCHE`;
        echecs.push(
          `① DÉBORDEMENT — ${ou} : <${b.tag.toLowerCase()}> au chemin ${b.path} ` +
            `${sens} du viewport (${d.overflow.viewportWidth}px) — rogné EN SILENCE. ` +
            `Texte : « ${b.texte} »`,
        );
      }
      if (s.found && !s.sticky) {
        echecs.push(
          `② HEADER NON STICKY — ${ou} : après défilement de ${s.scrollY}px, ` +
            `le header est à top ${s.topAfterScroll}px (attendu 0)`,
        );
      }
      for (const t of d.overflow.debordementsTexte) {
        echecs.push(
          `④ DÉBORDEMENT DE TEXTE — ${ou} : <${t.tag.toLowerCase()}> au chemin ${t.path} ` +
            `tient dans une boîte de ${t.boite}px mais son contenu en fait ${t.contenu}px ` +
            `(${t.depassement}px hors de la boîte) — rogné EN SILENCE. ` +
            `Parade : \`overflow-wrap: anywhere\`. Texte : « ${t.texte} »`,
        );
      }
      if (d.phantomClasses.length) {
        for (const f of d.phantomClasses) {
          echecs.push(
            `③ CLASSE FANTÔME — ${ou} : <${f.tag.toLowerCase()}> au chemin ${f.path} ` +
              `porte "undefined" dans son attribut class ("${f.className}")`,
          );
        }
      }
    }
  }
} finally {
  await chrome.close();
}

const combinaisons = PAGES.length * WIDTHS.length;
if (echecs.length === 0) {
  console.log(
    `\n✅ PORTE VERTE — ${controles} contrôles sur ${combinaisons} combinaisons ` +
      `(${PAGES.length} pages × ${WIDTHS.length} largeurs).`,
  );
  console.log(
    "   ① aucun débordement de boîte · ② header sticky partout · ③ aucune classe fantôme · " +
      "④ aucun débordement de texte dans sa boîte",
  );
  // 🔴 EXEMPTIONS DÉCLARÉES — une porte verte ne veut PAS dire « tout est couvert ».
  console.log(
    "   ⚠️ Périmètre du contrôle ④ : les FEUILLES DE TEXTE (éléments sans enfant élément).\n" +
      "      Un ancêtre hérite mécaniquement du scrollWidth de ses descendants — le signaler\n" +
      "      serait un artefact de propagation, pas une découverte. LIMITE ASSUMÉE : un\n" +
      "      débordement dans un élément qui porte AUSSI des enfants éléments n'est pas vu.\n" +
      "   ⚠️ Exemptions : décoratifs `aria-hidden` · motif `.sr-only` (boîte de 1px par\n" +
      "      construction, 92 à 126px de « débordement » mesurés) · primitive `Brush` (son trait\n" +
      "      `::after` est posé à left/right -4px, donc +4px de scrollWidth PAR CONSTRUCTION —\n" +
      "      exemptée PAR SON NOM et non par un seuil : un seuil à 5px masquerait un vrai\n" +
      "      débordement de 4px ailleurs) · conteneurs réellement défilants (leur scrollWidth\n" +
      "      supérieur au clientWidth est CE QUI LES REND défilables) et leur contenu.\n",
  );
  process.exit(0);
}

console.error(`\n❌ PORTE ROUGE — ${echecs.length} échec(s) sur ${combinaisons} combinaisons :\n`);
for (const e of echecs) console.error("   " + e);
console.error(
  "\n⚠️ Aucun de ces défauts n'est visible par lint, typecheck, build ou Lighthouse.\n" +
    "   Voir 00 référence/pieges/dette-invisible.md\n",
);
process.exit(1);
