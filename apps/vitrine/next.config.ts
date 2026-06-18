import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Build autonome (binaire + assets minimal) requis pour l'image Docker de la vitrine.
  // Prerequis de la Story 1.8 (deploiement self-hosted Caddy/Docker sur VPS). Pose ici, exploite plus tard.
  output: "standalone",
  // En monorepo, Next doit tracer les fichiers a inclure depuis la RACINE du repo (et non apps/vitrine),
  // sinon le build standalone oublie des deps hoistees -> crash a l'execution (Story 1.8). __dirname = apps/vitrine.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Le design system partage `@repo/ui` est publie en TS/CSS brut (pas de build) : Next doit le transpiler.
  // Declare des maintenant pour que l'import devienne possible des la Story 1.2 (tokens) sans casser le build.
  transpilePackages: ["@repo/ui"],
};

export default nextConfig;
