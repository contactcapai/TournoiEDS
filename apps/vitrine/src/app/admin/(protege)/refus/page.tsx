import Link from "next/link";
import { redirect } from "next/navigation";

import { LIBELLE_ROLE, estRoleAdmin } from "@/lib/roles";
import { lireCompte } from "@/server/auth/guard";
import { sectionsPour } from "../../_sections";
import styles from "@/styles/admin-page.module.css";

// ══════════════════════════════════════════════════════════════════════════════════════
// « CONNECTÉ, MAIS PAS POUR ÇA » (Story 8.1)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI UNE PAGE PLUTÔT QU'UN RENVOI VERS LE LOGIN. Depuis la 8.1 il existe DEUX
// refus, et les confondre fait une boucle : « pas connecté » se répare en se connectant,
// « connecté sans le rôle » ne se répare pas en se reconnectant. Renvoyer ce second cas
// vers `/admin/login` le ferait renvoyer vers `/admin`, qui renverrait vers le login.
//
// 🔴 ET POURQUOI PAS UN RENVOI SILENCIEUX VERS LE TABLEAU DE BORD : quelqu'un qui suit un
// lien vers `/admin/agenda` et se retrouve ailleurs sans un mot croit à un bug, réessaie,
// puis appelle. Un refus qui ne se nomme pas coûte plus cher que le refus lui-même.
//
// ⚠️ AUCUN RÔLE EXIGÉ ICI, par construction — c'est la page du refus. `sections.ts` la
// classe « connecte », et le layout parent ne demande qu'une session.

export const dynamic = "force-dynamic";

export default async function AdminRefusPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const compte = await lireCompte();
  if (compte === null) redirect("/admin/login");

  const params = await searchParams;
  const sections = sectionsPour(compte.roles);

  // ⚠️ Le paramètre vient de l'URL : on ne l'affiche JAMAIS tel quel. Il ne sert qu'à
  // choisir un libellé dans une table fermée — sans ça, `?role=<n'importe quoi>` ferait
  // écrire notre page sous la dictée de qui l'ouvre.
  const roleDemande = estRoleAdmin(params.role) ? LIBELLE_ROLE[params.role] : null;

  return (
    <>
      <h1 className={styles.titre}>Cette section ne vous est pas ouverte</h1>

      <p className={styles.chapo}>
        {roleDemande === null
          ? "Votre compte n'a pas les droits nécessaires pour cette page."
          : `Cette page demande le rôle « ${roleDemande} », que votre compte ne porte pas.`}
      </p>

      <div className={styles.vide}>
        <p>
          Ce n&rsquo;est pas une panne et vous n&rsquo;avez rien à réessayer&nbsp;: vous êtes
          bien connecté, c&rsquo;est ce rôle-là qui manque. Un responsable de
          l&rsquo;association peut vous l&rsquo;ouvrir depuis le back-office, et cela prend
          effet immédiatement — sans que vous ayez à vous reconnecter.
        </p>
      </div>

      {sections.length > 0 && (
        <p className={styles.mention}>
          Ce que votre compte ouvre&nbsp;:{" "}
          {sections.map((section, rang) => (
            <span key={section.href}>
              {rang > 0 && ", "}
              <Link className={styles.lien} href={section.href}>
                {section.libelle}
              </Link>
            </span>
          ))}
          .
        </p>
      )}

      <p className={styles.mention}>
        <Link className={styles.lien} href="/admin">
          Retour au tableau de bord
        </Link>
      </p>
    </>
  );
}
