import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SollicitationActions } from "@/components/admin/SollicitationActions/SollicitationActions";
import { formatLongDate, formatTime } from "@/lib/date-paris";
import { SOLICITATION_TYPE_LABELS } from "@/lib/schemas/solicitation";
import { cleanText } from "@/lib/text";
import { lireAdmin } from "@/server/auth/guard";
import {
  compterSollicitations,
  getSollicitationsForAdmin,
  SOLLICITATIONS_MAX,
  type AdminSollicitation,
} from "@/server/db/queries/solicitations";
import styles from "@/styles/admin-page.module.css";
import propre from "./sollicitations.module.css";

// Boîte de réception des sollicitations (Story 6.11, FR36) — Server Component pur.
//
// 🔴 CETTE PAGE PORTE SA PROPRE GARDE, ET CE N'EST PAS UNE REDONDANCE — DÉFAUT MESURÉ EN
// STORY 6.1. Une garde placée dans un `layout` N'EMPÊCHE PAS la `page` enfant de s'exécuter :
// Next rend l'arbre de segments EN PARALLÈLE, et le `redirect()` du layout n'arrête pas un
// rendu déjà commencé ailleurs.
//
// ⚠️ CE QUI EST À L'ÉCRAN ICI EST DE LA DONNÉE PERSONNELLE DE **TIERS** — collectivités,
// écoles, entreprises qui n'ont aucun lien avec l'association et n'ont consenti qu'à recevoir
// une réponse. C'est la catégorie la plus large du projet (RGPD, NFR5).
//
// ⚠️ LA LISTE NE CHARGE NI `email` NI `message` : `getSollicitationsForAdmin` ne les demande
// pas. Une donnée qui n'est pas lue ne peut pas fuiter dans la charge RSC. Le détail, lui,
// les charge — c'est son objet.

export const metadata: Metadata = {
  title: "Sollicitations",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function LigneSollicitation({ demande }: { demande: AdminSollicitation }) {
  // `cleanText` : filet du rendu contre une écriture qui contournerait Zod et les `CHECK`
  // (`UPDATE` direct, restauration). Jamais un fragment vide à l'écran.
  const expediteur = cleanText(demande.name) ?? "(expéditeur manquant)";
  const objet = SOLICITATION_TYPE_LABELS[demande.requestType];

  // 🔴 DATE **AVEC L'HEURE ET LA MINUTE**, et c'est la dette R31 qui l'exige. Le bouton du
  // formulaire public n'est jamais désactivé et l'action n'a aucune clé d'idempotence : deux
  // lignes quasi identiques peuvent exister. Une date au jour près les rendrait
  // indiscernables — c'est la minute qui permet au bénévole d'en supprimer une en sachant
  // laquelle il garde.
  const recuLe = `${formatLongDate(demande.createdAt)} à ${formatTime(demande.createdAt)}`;

  return (
    <li className={styles.ligne}>
      <div className={styles.ligneCorps}>
        <p className={styles.ligneDate}>{recuLe}</p>
        <p className={styles.ligneTitre}>{expediteur}</p>
        <p className={propre.objet}>{objet}</p>

        <span
          className={`${styles.etat} ${
            demande.isProcessed ? propre.etatTraitee : propre.etatATraiter
          }`}
        >
          {demande.isProcessed ? "Traitée" : "À traiter"}
        </span>
      </div>

      <div className={styles.ligneActions}>
        <Link className={styles.lien} href={`/admin/sollicitations/${demande.id}`}>
          Lire la demande
        </Link>
        <SollicitationActions
          id={demande.id}
          expediteur={expediteur}
          recuLe={recuLe}
          isProcessed={demande.isProcessed}
        />
      </div>
    </li>
  );
}

export default async function AdminSollicitationsPage() {
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  const [aTraiter, traitees, totaux] = await Promise.all([
    getSollicitationsForAdmin(false, SOLLICITATIONS_MAX),
    getSollicitationsForAdmin(true, SOLLICITATIONS_MAX),
    compterSollicitations(),
  ]);

  const aucune = totaux.aTraiter === 0 && totaux.traitees === 0;

  // 🔴 MESURÉ, JAMAIS ÉCRIT EN DUR (dette R32). `server/mail/client.ts` fait dépendre tout le
  // transport de cette variable : sans elle, `notifySolicitation` lève et l'échec est
  // SILENCIEUX côté visiteur, par conception (découplage de l'AC3 de la 5.1). Écrire « les
  // e-mails ne partent pas » en clair fabriquerait une affirmation fausse le jour où le mot de
  // passe d'application arrive, et que plus rien ne corrigerait — `pieges/cadrage-perime.md`,
  // mais gravé dans le produit.
  // ⚠️ ON NE REND QU'UN BOOLÉEN DÉRIVÉ. La valeur ne quitte jamais le serveur.
  // ⚠️ ET ON NE PRÉTEND PAS L'INVERSE : la présence du secret ne prouve AUCUN envoi réussi.
  // R32 ne se solde que par un message réellement émis, ce que cette story ne fait pas.
  //
  // 🔴 `.trim()` — TROUVÉ EN REVUE (Edge Case Hunter). Sans lui, une variable composée
  // d'espaces rendait `Boolean("   ") === true` : la mention DISPARAISSAIT alors que
  // `createTransport` (`server/mail/client.ts` l.18, `if (!pass)`) ne lève PAS non plus sur
  // cette valeur et tente un envoi SMTP voué à l'échec — échec silencieux par conception
  // (découplage AC3 de la 5.1). Le seul avertissement du système s'éteignait donc exactement
  // dans le cas où il fallait le lire.
  //
  // ⚠️ LIMITE QUI DEMEURE, ET ELLE EST L'ESSENCE DE R32 : un mot de passe PRÉSENT MAIS FAUX
  // (typiquement celui de Google recopié AVEC ses espaces internes, piège documenté dans
  // `.env.example`) reste indétectable ici. Aucune lecture d'environnement ne peut le voir —
  // seul un message réellement émis le prouverait. Cet écran ne dit donc jamais que les
  // notifications FONCTIONNENT ; il dit seulement, quand il en est sûr, qu'elles ne partent pas.
  const notificationsConfigurees = Boolean(process.env.GMAIL_APP_PASSWORD?.trim());

  return (
    <>
      <h1 className={styles.titre}>Sollicitations</h1>
      <p className={styles.chapo}>
        Les demandes reçues par le formulaire de la page <strong>Partenaires</strong>. Rien de
        ce qui est écrit ici n&rsquo;apparaît sur le site : cet écran est une boîte de
        réception, pas une page à publier.
      </p>

      {!notificationsConfigurees ? (
        /* ⚠️ Cette mention DISPARAÎT d'elle-même dès que la variable est renseignée : il n'y
           a rien à ré-éditer, donc rien à oublier. */
        <p className={styles.mention} role="note">
          Aucun mot de passe d&rsquo;application n&rsquo;est configuré :{" "}
          <strong>aucune notification par e-mail ne part</strong>. Cet écran est donc, pour
          l&rsquo;instant, le seul endroit où ces demandes sont visibles — pensez à y passer
          régulièrement.
        </p>
      ) : null}

      {aucune ? (
        /* ⚠️ Un état vide qui dirait « aucune demande » se lirait comme une panne. Celui-ci
           dit ce que ça SIGNIFIE — même doctrine que les états vides de la home (3.2),
           d'/agenda (3.3), du tableau de bord (6.1), de l'agenda (6.3), de la galerie (6.4),
           des partenaires (6.5), des ateliers (6.9) et des membres (6.10). */
        <p className={styles.vide}>
          Aucune demande pour l&rsquo;instant. Le formulaire de la page « Partenaires »
          fonctionne : personne ne l&rsquo;a encore utilisé. Les demandes arriveront ici,
          la plus récente en haut, et vous pourrez les marquer traitées au fur et à mesure.
        </p>
      ) : (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionTitre}>À traiter</h2>
            {totaux.aTraiter > SOLLICITATIONS_MAX ? (
              /* 🔴 LA BORNE SE DIT. Cette table ne fait que CROÎTRE — une troncature muette
                 serait indistinguable d'un « il n'y a rien de plus », sur la seule donnée du
                 site qu'on ne peut pas re-fabriquer. */
              <p className={styles.mention} role="note">
                Les <strong>{SOLLICITATIONS_MAX}</strong> demandes les plus récentes sont
                affichées, sur <strong>{totaux.aTraiter}</strong> en attente. Marquez-en
                comme traitées pour faire remonter les plus anciennes.
              </p>
            ) : null}
            {aTraiter.length > 0 ? (
              <ul className={styles.liste}>
                {aTraiter.map((demande) => (
                  <LigneSollicitation key={demande.id} demande={demande} />
                ))}
              </ul>
            ) : (
              <p className={styles.vide}>
                Tout est traité. Les nouvelles demandes apparaîtront ici.
              </p>
            )}
          </section>

          {/* ⚠️ La section « Traitées » ne s'affiche PAS quand elle est vide : une section
              vide sous une section pleine se lit comme un défaut de chargement. */}
          {traitees.length > 0 ? (
            <section className={styles.section}>
              <h2 className={styles.sectionTitre}>Traitées</h2>
              {totaux.traitees > SOLLICITATIONS_MAX ? (
                <p className={styles.mention} role="note">
                  Les <strong>{SOLLICITATIONS_MAX}</strong> plus récentes sont affichées, sur{" "}
                  <strong>{totaux.traitees}</strong> traitées. Supprimez celles dont vous
                  n&rsquo;avez plus besoin pour alléger cette liste.
                </p>
              ) : null}
              <ul className={styles.liste}>
                {traitees.map((demande) => (
                  <LigneSollicitation key={demande.id} demande={demande} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
