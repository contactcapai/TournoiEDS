// Mesure ponctuelle : sur une carte de /tournois PORTANT UN VISUEL, l'élément qui reçoit
// réellement le clic au centre de la photo est-il l'overlay du lien, ou l'image ?
//
// Le raisonnement CSS (ordre de peinture) dit « l'image ». On ne le croit pas sur parole :
// on fabrique le cas, on interroge `document.elementFromPoint`, et on nettoie.
import postgres from "postgres";
import { launchChrome } from "./cdp.mjs";

const BASE = process.env.GATE_BASE;
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const MARQUE = "ZZ-PREUVE-OVERLAY";
const SLUG = "zz-preuve-overlay";

let idEvt = null;
try {
  const [photo] = await sql`select id, filename from photo where is_published = true limit 1`;
  if (!photo) {
    console.log("❌ aucune photo publiée en base — la mesure est impossible, on ne conclut rien.");
    process.exit(2);
  }
  console.log(`Photo témoin : ${photo.filename}`);

  const [evt] = await sql`
    insert into event (title, venue_name, starts_at, is_published)
    values (${MARQUE + "-evt"}, 'Salle temoin', now(), true) returning id`;
  idEvt = evt.id;
  await sql`
    insert into tournament (event_id, photo_id, name, game, slug, starts_at, registration_mode, is_published)
    values (${idEvt}, ${photo.id}, ${MARQUE}, 'CS2', ${SLUG}, now() + interval '1 hour', 'interne', true)`;

  const chrome = await launchChrome(9401);
  await chrome.setEmulatedMedia({ "prefers-reduced-motion": "reduce" });
  await chrome.setViewport(1440);
  await chrome.goto(BASE + "/tournois");

  const r = await chrome.eval(`(() => {
    const img = [...document.images].find(i => i.currentSrc.includes(${JSON.stringify(photo.filename)}) || i.src.includes(${JSON.stringify(photo.filename)}));
    if (!img) return { erreur: "image du témoin introuvable dans le DOM" };
    // Il FAUT amener l'élément dans le viewport : elementFromPoint travaille en coordonnees
    // de fenetre et rend null hors ecran. Sans ça la sonde ne mesure rien — et une sonde qui
    // ne mesure rien doit le DIRE, pas conclure.
    img.scrollIntoView({ block: "center" });
    const b = img.getBoundingClientRect();
    if (b.width === 0) return { erreur: "image de largeur nulle" };
    const x = b.left + b.width / 2, y = b.top + b.height / 2;
    const el = document.elementFromPoint(x, y);
    if (!el) return { erreur: "elementFromPoint rend null (hors viewport ?)" };
    const lien = el.closest("a");
    return {
      tag: el.tagName.toLowerCase(),
      classe: String(el.className).slice(0, 60),
      clicMeneAuLien: Boolean(lien),
      hrefAtteint: lien ? lien.getAttribute("href") : null,
    };
  })()`);
  await chrome.close();

  console.log("\nAu centre de la photo, l'élément qui reçoit le clic :");
  console.log(JSON.stringify(r, null, 2));
  console.log(
    r.erreur
      ? "\n⚠️ MESURE IMPOSSIBLE — on ne conclut pas."
      : r.clicMeneAuLien
        ? "\n✅ Cliquer la photo mène bien à la fiche."
        : "\n❌ Cliquer la photo NE mène PAS à la fiche — l'overlay est recouvert.",
  );
} finally {
  await sql`delete from tournament where name like ${MARQUE + "%"}`;
  if (idEvt) await sql`delete from event where id = ${idEvt}`;
  const [{ n }] = await sql`select count(*)::int as n from tournament where name like ${MARQUE + "%"}`;
  console.log(`🧹 ménage : ${n} témoin(s) restant(s) (attendu 0).`);
  await sql.end();
}
