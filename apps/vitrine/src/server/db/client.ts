// `server-only` en TOUTE PREMIÈRE LIGNE (Garde-fou n°1) : fait échouer le build si
// ce module est jamais atteint depuis un composant client. Accès Postgres + secrets
// restent strictement côté serveur (AR-DB3).
import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Singleton caché via globalThis : évite de multiplier les connexions au HMR dev.
const g = globalThis as unknown as { _db?: PostgresJsDatabase<typeof schema> };

function createDb() {
  const url = process.env.DATABASE_URL;
  // Erreur claire AU MOMENT DE L'USAGE (1ʳᵉ query), jamais à l'import → le build reste
  // sûr quand DATABASE_URL est absente (CI/local ; la vraie base arrive en Story 1.8).
  if (!url) {
    throw new Error(
      "DATABASE_URL manquante : renseigner apps/vitrine/.env.local (voir .env.example).",
    );
  }
  // `prepare: false` : compatible avec un pooler en mode transaction (pgBouncer/Supabase).
  // `casing: 'snake_case'` : DOIT rester identique à drizzle.config.ts, sinon le SQL généré
  // par drizzle-kit divergerait du mapping runtime (Garde-fou n°7).
  return drizzle(postgres(url, { prepare: false }), { schema, casing: "snake_case" });
}

// Proxy : la connexion n'est construite qu'au 1ᵉʳ accès, jamais à l'import — c'est ce qui
// garde le build sûr quand DATABASE_URL est absente (Garde-fou n°2).
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get: (_t, prop) => (g._db ??= createDb())[prop as keyof PostgresJsDatabase<typeof schema>],
});
