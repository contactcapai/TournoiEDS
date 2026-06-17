import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonome (binaire + assets minimal) requis pour l'image Docker de la vitrine.
  // Prerequis de la Story 1.8 (deploiement self-hosted Caddy/Docker sur VPS). Pose ici, exploite plus tard.
  output: "standalone",
};

export default nextConfig;
