// `server-only` en TOUTE PREMIÈRE LIGNE (patron `server/db/client.ts`, Garde-fou n°1) : fait
// échouer le build si ce module est jamais atteint depuis un composant client. Le mot de passe
// d'application Gmail reste strictement côté serveur.
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LE COMPTE SMTP EST UNE CONSTANTE, ET IL NE DOIT **JAMAIS** DEVENIR UN RÉGLAGE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Jusqu'à la Story 6.13, cette valeur était `CONTACT_EMAIL`, importée de `lib/links.ts` — la
 * MÊME constante que celle affichée dans le footer. La 6.13 rend l'e-mail de contact
 * **saisissable au back-office** (`site_setting.contact_email`), et les deux se seraient donc
 * mis à bouger ensemble. **C'est le fait le plus dangereux du cadrage de cette story :**
 *
 *   · `GMAIL_APP_PASSWORD` est un mot de passe d'APPLICATION, lié au compte Google
 *     `esportdessacres@gmail.com`. Un bénévole qui modifierait l'e-mail public
 *     **invaliderait l'authentification SMTP** ;
 *   · et l'échec serait **TOTALEMENT SILENCIEUX** : `submitSolicitation` (Story 5.1, AC3)
 *     découple volontairement l'`INSERT` de l'envoi, précisément pour qu'une panne de mail ne
 *     perde jamais la donnée. Une sollicitation serait donc persistée et **notifiée à
 *     personne**, sans que rien ne le dise — c'est-à-dire la dette **R32** reproduite **par la
 *     saisie**, depuis un écran dont personne ne soupçonnerait le lien.
 *
 * ⇒ Ce qui SE SAISIT (`site_setting.contact_email`) est l'adresse **publiée** et le
 * **destinataire** des notifications (`to`). Ce qui NE SE SAISIT PAS est l'**identité du
 * transport** : `auth.user` ici, et `from` dans `notifySolicitation` — Gmail réécrit ou refuse
 * de toute façon un `from` qui n'est pas le compte authentifié (ou l'un de ses alias vérifiés).
 *
 * ⚠️ NE PAS « HARMONISER » LES DEUX. Elles portent aujourd'hui la même valeur, et c'est une
 * coïncidence : elles ne répondent pas à la même question.
 */
export const COMPTE_SMTP = "esportdessacres@gmail.com";

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
    auth: { user: COMPTE_SMTP, pass },
  });
}

// Le transport n'est construit qu'au 1ᵉʳ envoi, jamais à l'import — Garde-fou n°2 du patron.
export function getMailTransport(): Transporter {
  return (g._mailTransport ??= createTransport());
}
