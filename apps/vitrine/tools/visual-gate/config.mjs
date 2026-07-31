// Périmètre commun aux portes et aux instruments de ce dossier.
//
// ⚠️ AJOUTER ICI TOUTE NOUVELLE PAGE PUBLIQUE. Une page absente de cette liste
// n'est couverte par AUCUNE des portes de ce dossier — en silence, ce qui est
// exactement le mode de défaillance que cet outillage existe pour supprimer.
// `/partenaires` a été ajoutée par la Story 4.2 : le compte de `pnpm --filter
// vitrine gate` est passé de 84 à 105 (5 pages × 7 largeurs × 3 gardes), et c'est
// CE CHANGEMENT DE COMPTE qui prouve que l'ajout a pris — un compte inchangé après
// l'ajout d'une page est le signal d'une erreur de configuration, pas un succès.
// L'Epic 5 n'ajoute aucune route (le formulaire vit sur /partenaires).
//
// ⚠️ `/`, `/agenda` ET `/partenaires` LISENT LA BASE à chaque requête (Stories 3.2,
// 3.3 et 4.2) : le Postgres de dev doit tourner et `apps/vitrine/.env.local` être
// renseigné, sinon elles répondent en erreur et la porte ne mesure rien.
//   docker compose -f docker/docker-compose.dev.yml up -d
export const PAGES = (
  process.env.GATE_PAGES ?? "/,/agenda,/partenaires,/l-asso,/animations"
).split(",");

// 7 largeurs de référence du projet : 320 (le plus tendu), 412, 768, 880 (le
// breakpoint), 1024, 1440, 1920.
export const WIDTHS = (process.env.GATE_WIDTHS ?? "320,412,768,880,1024,1440,1920")
  .split(",")
  .map(Number);

export const BASE = process.env.GATE_BASE ?? "http://127.0.0.1:4310";
