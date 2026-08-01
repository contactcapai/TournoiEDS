// `server-only` en TOUTE PREMIÈRE LIGNE (patron `server/db/client.ts`, Garde-fou n°1) : fait
// échouer le build si ce module est jamais atteint depuis un composant client. Le mot de passe
// d'application Gmail reste strictement côté serveur.
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

import { CONTACT_EMAIL } from "@/lib/links";

// Singleton caché via globalThis : évite de multiplier les transports au HMR dev — même
// motif que `db/client.ts`.
const g = globalThis as unknown as { _mailTransport?: Transporter };

function createTransport() {
  const pass = process.env.GMAIL_APP_PASSWORD;
  // Erreur claire AU MOMENT DE L'USAGE (1ᵉʳ envoi), jamais à l'import → le build reste sûr
  // quand GMAIL_APP_PASSWORD est absente (CI/local sans le mot de passe d'application de Brice),
  // exactement comme `DATABASE_URL` en Story 1.7.
  if (!pass) {
    throw new Error(
      "GMAIL_APP_PASSWORD manquante : renseigner apps/vitrine/.env.local (voir .env.example).",
    );
  }
  // Port 587 + STARTTLS (secure: false) : standard actuel, préféré à 465/secure:true.
  // 🔴 `requireTLS: true`, trouvé manquant en revue (Blind Hunter) : sans lui, `secure: false`
  // sur 587 est un STARTTLS OPPORTUNISTE — si l'upgrade TLS est bloqué ou indisponible
  // (rétrogradation réseau, intermédiaire mal configuré), nodemailer retomberait en clair,
  // exposant le mot de passe d'application ET le contenu personnel du message. `requireTLS`
  // fait ÉCHOUER l'envoi plutôt que d'accepter une connexion non chiffrée — cohérent avec le
  // découplage envoi/persistance (AC3) : un échec ici ne perd jamais la donnée déjà en base.
  // 🔴 Délais explicites, trouvés manquants en revue (Edge Case Hunter) : sans eux, un
  // blocage réseau (SMTP qui ne répond pas) ferait attendre `notifySolicitation` jusqu'au
  // délai par défaut du système d'exploitation, retardant d'autant la réponse affichée à
  // l'utilisateur alors même que la donnée est déjà en sécurité en base.
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
    auth: { user: CONTACT_EMAIL, pass },
  });
}

// Le transport n'est construit qu'au 1ᵉʳ envoi, jamais à l'import — Garde-fou n°2 du patron.
export function getMailTransport(): Transporter {
  return (g._mailTransport ??= createTransport());
}
