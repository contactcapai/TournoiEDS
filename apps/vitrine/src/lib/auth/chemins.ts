/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LES CHEMINS DE LA CONNEXION — SOURCE UNIQUE (Story 12.4)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CE FICHIER EXISTE PARCE QUE L'AUDIT DE LA 12.4 A COMPTÉ **52 RENVOIS** VERS
 * `/admin/login`, SUR 25 FICHIERS, DONT **17 EXÉCUTABLES ÉCRITS EN DUR**. `CHEMIN_LOGIN`
 * existait déjà dans `server/auth/sections.ts` — et n'avait **qu'un seul consommateur**
 * (`proxy.ts`). Un fait qui vit à deux endroits, l'un des deux se périmera : c'est
 * exactement ce qui a rendu ce déplacement d'URL coûteux.
 * ⇒ Une seule déclaration, et le prochain déménagement sera une ligne.
 *
 * 🔴 IL VIT DANS `lib/` ET NON DANS `server/`, ET C'EST STRUCTUREL : deux de ses
 * consommateurs sont des composants **client** (`MobileMenu`, `BoutonVenue`). Un module de
 * `server/auth/` y serait inimportable — et le laisser là aurait forcé à recopier la chaîne
 * côté client, c'est-à-dire à refabriquer le défaut que ce fichier corrige.
 * ⚠️ Aucune dépendance ici, jamais : ce sont des constantes de chaîne. Y importer quoi que
 * ce soit de `server/` casserait le build des deux appelants clients.
 */

/**
 * La page de connexion — destination de tout refus faute de session.
 *
 * 🔴 ELLE N'EST PLUS SOUS `/admin` DEPUIS LA 12.4, ET C'EST LE CŒUR DE LA STORY. Elle
 * s'appelait `/admin/login` du temps où seule l'équipe avait une raison de se connecter. La
 * 12.2 (« j'y serai ») et la 12.3 (s'inscrire à un tournoi) en ont donné une à tout le
 * monde : un joueur qui cliquait « S'inscrire » atterrissait sur une URL qui dit « admin »,
 * sur un écran intitulé « Back-office », **réservé à l'équipe** — un mur, au moment précis
 * où il voulait entrer.
 * ⚠️ L'URL compte autant que l'écran : elle se lit dans la barre d'adresse **et dans
 * l'e-mail du lien magique**.
 */
export const CHEMIN_CONNEXION = "/connexion";

/**
 * L'écran « regardez votre boîte mail », après l'envoi d'un lien magique.
 *
 * ⚠️ Il est OUVERT SANS SESSION, par construction : il s'affiche à quelqu'un qui, par
 * définition, n'est pas encore connecté. L'oublier le renverrait vers la connexion au moment
 * précis où on vient de lui envoyer un lien — il croirait à un échec et en redemanderait un,
 * invalidant le premier.
 */
export const CHEMIN_CONNEXION_VERIFIER = "/connexion/verifier";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LES ANCIENNES URLS — CONSERVÉES JOIGNABLES, ET CE N'EST PAS DU MÉNAGE OUBLIÉ
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `next.config.ts` les redirige vers les nouvelles. Elles restent déclarées **ouvertes** dans
 * `server/auth/sections.ts` pour une raison précise : le proxy est **fail-closed** sous
 * `/admin`, donc un chemin qu'aucune section ne couvre y est refusé. Si ces deux-là
 * cessaient d'être ouvertes, la redirection ne jouerait que si les `redirects` de
 * `next.config` s'exécutent **avant** le proxy — un ordre qui dépend de la version de Next et
 * qu'aucune de nos portes ne mesure.
 * ⇒ On ne parie pas sur l'ordre : on garde les deux chemins ouverts, la redirection joue dans
 * les deux cas, et le coût est nul.
 *
 * ⚠️ Elles ne sont PAS mortes : des bénévoles ont `/admin/login` en favori, et des liens
 * magiques déjà envoyés pointent l'ancien écran de vérification.
 */
export const CHEMIN_CONNEXION_HERITE = "/admin/login";
export const CHEMIN_CONNEXION_VERIFIER_HERITE = "/admin/login/verifier";
