import { RolesCompte } from "@/components/admin/RolesCompte/RolesCompte";
import { DESCRIPTION_ROLE, LIBELLE_ROLE, ROLES_ADMIN, estParticipant } from "@/lib/roles";
import { exigerRolePage } from "@/server/auth/guard";
import { identifiantsAdminAutorises } from "@/server/auth/allowlist";
import { listerComptes } from "@/server/db/queries/comptes";
import styles from "@/styles/admin-page.module.css";

// ══════════════════════════════════════════════════════════════════════════════════════
// QUI PEUT ENTRER, ET POUR QUOI FAIRE (Story 8.1, absorbe l'ex-Story 7.9)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 CETTE PAGE PORTE SA PROPRE GARDE, comme les huit autres sections — le layout garde le
// chrome, il ne protège pas les pages : Next rend l'arbre de segments EN PARALLÈLE, et le
// `redirect()` d'un layout n'arrête pas un rendu déjà commencé ailleurs (mesuré en 6.1, le
// corps de la réponse contenait le tableau de bord entier).
//
// ⚠️ ELLE LISTE TOUS LES COMPTES, y compris ceux qui n'ont aucun rôle. C'est le cas nominal
// depuis la 8.1 : quelqu'un se connecte d'abord (ce qui ne lui ouvre rien), et on lui ouvre
// les droits ensuite. N'afficher que les administrateurs rendrait l'écran inutilisable pour
// la seule chose qu'on lui demande.

export const dynamic = "force-dynamic";

export default async function AdminAccesPage() {
  await exigerRolePage("admin_site");

  const comptes = await listerComptes();
  const noyauDeSecours = identifiantsAdminAutorises();

  return (
    <>
      <h1 className={styles.titre}>Accès</h1>
      <p className={styles.chapo}>
        Qui peut entrer dans le back-office, et pour quoi faire. Un rôle donné ou retiré prend
        effet à la page suivante, sans attendre la fin de session.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitre}>Ce que chaque rôle ouvre</h2>
        <ul className={styles.liste}>
          {ROLES_ADMIN.map((role) => (
            <li className={styles.ligne} key={role}>
              <div className={styles.ligneCorps}>
                <p className={styles.ligneTitre}>{LIBELLE_ROLE[role]}</p>
                <p className={styles.ligneLieu}>{DESCRIPTION_ROLE[role]}</p>
              </div>
            </li>
          ))}
        </ul>
        {/* 🔴 LA SÉPARATION EST STRICTE, ET ELLE SE DIT. Sans cette phrase, « administration
            du site » se lit spontanément comme « tout », et on retirerait à quelqu'un un rôle
            qu'on croyait redondant. */}
        <p className={styles.mention}>
          Les deux rôles sont <strong>indépendants</strong>&nbsp;: administrer le site
          n&rsquo;ouvre pas les tournois, et l&rsquo;inverse est vrai aussi. Qui doit tout
          atteindre porte les deux.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitre}>Les comptes</h2>

        {comptes.length === 0 ? (
          /* ⚠️ Cet état est en principe inatteignable — la page est servie à quelqu'un qui
             est connecté, donc au moins un compte existe. Il est écrit quand même : un écran
             qui rend une liste vide sans un mot se lit comme une panne. */
          <p className={styles.vide}>
            Aucun compte enregistré. Vous voyez cette page par le noyau de secours&nbsp;:
            connectez-vous une fois normalement pour créer votre compte.
          </p>
        ) : (
          <ul className={styles.liste}>
            {comptes.map((compte) => {
              const designation = compte.nom ?? compte.email ?? "ce compte";
              const secours =
                compte.identifiantDiscord !== null &&
                noyauDeSecours.includes(compte.identifiantDiscord);

              return (
                <li className={styles.ligne} key={compte.id}>
                  <div className={styles.ligneCorps}>
                    <p className={styles.ligneTitre}>{designation}</p>
                    <p className={styles.ligneLieu}>
                      {compte.email ?? "Pas d'adresse e-mail connue"}
                      {estParticipant(compte.roles) && " — aucun rôle : n'ouvre rien"}
                    </p>
                    {/* 🔴 LE NOYAU DE SECOURS SE VOIT, SINON IL PIÈGE. Retirer tous ses rôles
                        à ce compte ne le ferme PAS : `AUTH_ADMIN_DISCORD_IDS` lui rend
                        `admin_site` à la requête suivante. Un écran qui laisserait croire
                        l'inverse mentirait sur l'état réel des accès. */}
                    {secours && (
                      <p className={styles.ligneDate}>
                        Noyau de secours&nbsp;: ce compte garde l&rsquo;administration du site
                        même sans rôle ici (variable <code>AUTH_ADMIN_DISCORD_IDS</code> du
                        serveur).
                      </p>
                    )}
                  </div>

                  <div className={styles.ligneActions}>
                    <RolesCompte
                      utilisateurId={compte.id}
                      roles={compte.roles}
                      designation={designation}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
