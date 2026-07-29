// Périmètre commun aux portes et aux instruments de ce dossier.
//
// ⚠️ AJOUTER ICI TOUTE NOUVELLE PAGE PUBLIQUE. Une page absente de cette liste
// n'est couverte par AUCUNE des portes de ce dossier — en silence, ce qui est
// exactement le mode de défaillance que cet outillage existe pour supprimer.
// Les Epics 3 à 5 en ajoutent au moins deux (/agenda, /partenaires).
export const PAGES = (process.env.GATE_PAGES ?? "/,/l-asso,/animations").split(",");

// 7 largeurs de référence du projet : 320 (le plus tendu), 412, 768, 880 (le
// breakpoint), 1024, 1440, 1920.
export const WIDTHS = (process.env.GATE_WIDTHS ?? "320,412,768,880,1024,1440,1920")
  .split(",")
  .map(Number);

export const BASE = process.env.GATE_BASE ?? "http://127.0.0.1:4310";
