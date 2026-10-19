import Link from "next/link";

import { RolesCompte } from "@/components/admin/RolesCompte/RolesCompte";
import { TitrePage } from "@/components/admin/TitrePage/TitrePage";
import { DESCRIPTION_ROLE, LIBELLE_ROLE_COURT, ROLES_ADMIN, estParticipant } from "@/lib/roles";
import { exigerRolePage } from "@/server/auth/guard";
import { identifiantsAdminAutorises } from "@/server/auth/allowlist";
import { listerComptes, type CompteAvecRoles } from "@/server/db/queries/comptes";
import styles from "@/styles/admin-page.module.css";

import acces from "./acces.module.css";

// ══════════════════════════════════════════════════════════════════════════════════════
// QUI PEUT ENTRER, ET POUR QUOI FAIRE (Story 8.1, absorbe l'ex-Story 7.9)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 CETTE PAGE PORTE SA PROPRE GARDE, comme les huit autres sections — le layout garde le
// chrome, il ne protège pas les pages (mesuré en 6.1).
//
// ⚠️ L'équipe (un rôle, ou le noyau de secours) est TOUJOURS listée ; les autres comptes se
// trouvent par la recherche — à 200 inscrits, les dérouler noierait les quelques lignes utiles.

export const dynamic = "force-dynamic";

/** Sans recherche, on ne montre qu'un échantillon des comptes sans rôle. */
const AUTRES_SANS_RECHERCHE = 20;
const AUTRES_AVEC_RECHERCHE = 100;

const normaliser = (texte: string) =>
  texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default async function AdminAccesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigerRolePage("admin_site");

  const parametres = await searchParams;
  const q = typeof parametres.q === "string" ? parametres.q.trim() : "";
  const cherche = normaliser(q);

  const comptes = await listerComptes();
  const noyauDeSecours = identifiantsAdminAutorises();
  const estSecours = (compte: CompteAvecRoles) =>
    compte.identifiantDiscord !== null && noyauDeSecours.includes(compte.identifiantDiscord);
  const correspond = (compte: CompteAvecRoles) =>
    cherche === "" || normaliser(`${compte.nom ?? ""} ${compte.email ?? ""}`).includes(cherche);

  const equipe = comptes.filter((c) => !estParticipant(c.roles) || estSecours(c));
  const autres = comptes.filter((c) => estParticipant(c.roles) && !estSecours(c));
  const equipeVue = equipe.filter(correspond);
  const autresTrouves = autres.filter(correspond);
  const autresVus = autresTrouves.slice(0, q ? AUTRES_AVEC_RECHERCHE : AUTRES_SANS_RECHERCHE);
  const autresCaches = autresTrouves.length - autresVus.length;

  const ligne = (compte: CompteAvecRoles) => {
    const designation = compte.nom ?? compte.email ?? "ce compte";
    return (
      <li className={acces.compte} key={compte.id}>
        <div className={acces.identite}>
          <p className={acces.nom}>{designation}</p>
          <p className={acces.email}>{compte.email ?? "Pas d'adresse e-mail connue"}</p>
          {/* 🔴 Le noyau de secours se voit, sinon il piège : retirer ses rôles ici ne le ferme pas. */}
          {estSecours(compte) && (
            <p className={acces.secours}>
              Noyau de secours&nbsp;: garde l&rsquo;administration du site même sans rôle ici
              (<code>AUTH_ADMIN_DISCORD_IDS</code>).
            </p>
          )}
        </div>
        <RolesCompte utilisateurId={compte.id} roles={compte.roles} designation={designation} />
      </li>
    );
  };

  return (
    <>
      {/* 🔴 La séparation est stricte et se dit : sinon « Site » se lit comme « tout ». */}
      <TitrePage
        libelleInfo="Ce que chaque rôle ouvre"
        info={[
          "Qui peut entrer dans le back-office, et pour quoi faire.",
          ...ROLES_ADMIN.map((role) => (
            <>
              <strong>{LIBELLE_ROLE_COURT[role]}</strong>&nbsp;: {DESCRIPTION_ROLE[role]}
            </>
          )),
          "Les deux rôles sont indépendants : qui doit tout atteindre porte les deux. Un rôle donné ou retiré prend effet à la page suivante.",
        ]}
      >
        Accès
      </TitrePage>

      <form className={styles.filtres} method="get" role="search">
        <label className={styles.filtreLabel} htmlFor="acces-q">
          Rechercher un compte
        </label>
        <input
          id="acces-q"
          className={styles.recherche}
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Nom ou adresse e-mail"
        />
        <button className={styles.filtrer} type="submit">
          Chercher
        </button>
        {q ? (
          <Link className={styles.lien} href="/admin/acces">
            Tout afficher
          </Link>
        ) : null}
      </form>

      <section className={styles.section} aria-labelledby="acces-equipe">
        <h2 className={styles.sectionTitre} id="acces-equipe">
          L&rsquo;équipe ({equipe.length})
        </h2>
        {equipeVue.length === 0 ? (
          <p className={styles.vide}>
            {q
              ? "Aucun membre de l’équipe ne correspond à cette recherche."
              : "Personne n’a de rôle. Vous voyez cette page par le noyau de secours."}
          </p>
        ) : (
          <ul className={acces.comptes}>{equipeVue.map(ligne)}</ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="acces-autres">
        <h2 className={styles.sectionTitre} id="acces-autres">
          Les autres comptes ({autres.length})
        </h2>
        <p className={acces.aide}>
          Ils peuvent s&rsquo;inscrire aux tournois mais n&rsquo;ouvrent rien du back-office.
          Pour donner un rôle, cherchez la personne puis cliquez sur «&nbsp;Site&nbsp;» ou
          «&nbsp;Tournois&nbsp;».
        </p>
        {autresVus.length === 0 ? (
          <p className={styles.vide}>
            {q ? "Aucun compte ne correspond à cette recherche." : "Aucun autre compte."}
          </p>
        ) : (
          <ul className={acces.comptes}>{autresVus.map(ligne)}</ul>
        )}
        {autresCaches > 0 ? (
          <p className={acces.aide}>
            Et {autresCaches} autre{autresCaches > 1 ? "s" : ""}&nbsp;:{" "}
            {q ? "précisez la recherche." : "cherchez par nom ou adresse pour les trouver."}
          </p>
        ) : null}
      </section>
    </>
  );
}
