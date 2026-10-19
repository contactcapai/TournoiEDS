import { lireCompte } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { ouvrirVignette } from "@/server/medias";

// Vignettes du back-office (2026-10-19). Hors de `/admin` parce que le proxy y réserve
// `/admin/medias` au rôle « Site », alors que le choix d'image d'un TOURNOI sert aussi le
// rôle « Tournois ». 🔴 La garde est donc ICI, en première instruction : rien d'autre ne la tient.
// Brouillons compris, comme `/admin/medias` ; refus et absence répondent le même 404.

export const dynamic = "force-dynamic";

function introuvable() {
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const compte = await lireCompte();
  if (compte === null || compte.roles.length === 0) return introuvable();

  const { filename } = await params;

  let ligne;
  try {
    ligne = await db.query.photo.findFirst({
      columns: { filename: true },
      where: (table, { eq }) => eq(table.filename, filename),
    });
  } catch {
    return introuvable();
  }
  if (!ligne) return introuvable();

  const vignette = await ouvrirVignette(ligne.filename);
  if (!vignette) return introuvable();

  return new Response(new Uint8Array(vignette), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(vignette.length),
      // `private` : le seul navigateur de l'administrateur. Le nom est un UUID dont le
      // contenu ne change jamais (une photo se remplace en la supprimant).
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
