import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit est un CLI hors Next : il ne charge PAS `.env.local` tout seul.
// On le charge explicitement (Garde-fou n°4, option A). `dotenv/config` lirait
// `.env`, pas `.env.local` → on passe le `path` à la main.
config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  // Convention archi : clés TS camelCase → colonnes DB snake_case (Garde-fou n°7).
  // MÊME valeur que dans le client (`drizzle(..., { casing })`) sinon les migrations
  // générées divergeraient du runtime. Posé ici dès la fondation.
  casing: "snake_case",
  dbCredentials: {
    // Non-null assertion : absente en `generate` offline (pas de connexion), c'est sans
    // incidence ; `migrate` exige la vraie valeur depuis `.env.local`.
    url: process.env.DATABASE_URL!,
  },
});
