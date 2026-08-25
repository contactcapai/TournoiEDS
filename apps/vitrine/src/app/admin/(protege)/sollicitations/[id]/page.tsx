import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { SollicitationActions } from "@/components/admin/SollicitationActions/SollicitationActions";
import { formatLongDate, formatTime } from "@/lib/date-paris";
import { SOLICITATION_TYPE_LABELS } from "@/lib/schemas/solicitation";
import { cleanText } from "@/lib/text";
import { exigerRolePage } from "@/server/auth/guard";
import { getSollicitationById } from "@/server/db/queries/solicitations";
import styles from "@/styles/admin-page.module.css";
import propre from "../sollicitations.module.css";

// Détail d'une sollicitation (Story 6.11, FR36).
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 LECTURE SEULE — ET C'EST LE SEUL `[id]` DU BACK-OFFICE DANS CE CAS
// ══════════════════════════════════════════════════════════════════════════════════════
//
// Les cinq autres `[id]/page.tsx` sont des formulaires d'édition. Ici, le nom, l'adresse, le
// type et le message ont été saisis par un VISITEUR : les rendre modifiables serait falsifier
// une demande reçue. Ne pas ajouter de `<SollicitationForm>` d'admin — il n'y a rien à
// corriger, et l'action `definirTraitementSollicitation` n'écrit qu'un booléen.
//
// 🔴 Garde en PREMIÈRE INSTRUCTION (défaut mesuré en 6.1 : une garde de `layout` n'arrête pas
// le rendu de la `page` enfant).
//
// 🔴 L'IDENTIFIANT EST VALIDÉ AVANT D'ATTEINDRE LA BASE : un `/admin/sollicitations/pas-un-uuid`
// remis tel quel à une colonne `uuid` fait lever Postgres (`invalid input syntax for type
// uuid`) → une 500, là où la réponse juste est un 404. Zod valide un FORMAT ; l'existence,
// elle, est le `notFound()` qui suit.
//
// ⚠️ `params` EST UNE PROMESSE depuis Next 15.

export const metadata: Metadata = {
  title: "Demande reçue",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DetailSollicitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigerRolePage("admin_site");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const demande = await getSollicitationById(id);
  if (!demande) notFound();

  // Filets de rendu contre une écriture qui contournerait Zod et les `CHECK` (`UPDATE` direct,
  // restauration de sauvegarde). Jamais un fragment vide à l'écran.
  const expediteur = cleanText(demande.name) ?? "(expéditeur manquant)";
  const email = cleanText(demande.email);
  // 🔴 UNE ADRESSE LISIBLE N'EST PAS UNE ADRESSE UTILISABLE — trouvé en revue (Edge Case
  // Hunter). Le `CHECK solicitation_email_valide` n'exige qu'un `@` et une longueur : une
  // valeur écrite par un chemin qui contourne Zod (`UPDATE` direct, restauration) peut valoir
  // `@@@@@@` et passer. On rendait alors un `href="mailto:@@@@@@"` — une **ancre morte**, très
  // exactement ce que le commentaire ci-dessous prétend éviter et ce que la Story 5.5 a
  // supprimé du site. La forme se re-valide donc ICI, avec le même `z.email()` que le schéma
  // public, avant de construire le lien.
  const emailUtilisable = email !== null && z.email().safeParse(email).success ? email : null;
  const message = cleanText(demande.message) ?? "(message manquant)";
  const recuLe = `${formatLongDate(demande.createdAt)} à ${formatTime(demande.createdAt)}`;

  return (
    <>
      <h1 className={styles.titre}>Demande de {expediteur}</h1>
      <p className={styles.chapo}>
        Reçue le {recuLe}. Cette page est en <strong>lecture seule</strong> : on ne modifie pas
        une demande envoyée par quelqu&rsquo;un d&rsquo;autre.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/sollicitations">
          Retour aux sollicitations
        </Link>
        {/* ⚠️ `mailto:` — PAS de `target="_blank"`, PAS de mention « nouvel onglet » :
            `isExternalUrl` (lib/links.ts) qualifie des URL http(s), un `mailto:` n'en est pas
            une, et annoncer un onglet qui ne s'ouvrira pas est une annonce trompeuse (leçon
            R2 / `gate:links`). Précédent : le lien e-mail en prose de `/partenaires` (4.2).
            ⚠️ Le lien n'existe QUE si l'adresse est lisible ET de forme valide
            (`emailUtilisable`) : une ancre `mailto:` qu'aucun client ne peut ouvrir est une
            ancre morte, exactement ce que la Story 5.5 a supprimé du site.
            ⚠️ ADRESSE ENCODÉE, PUIS LE `@` RESTAURÉ. `encodeURIComponent` seul rendrait
            `mailto:jean%40mairie.fr`, que certains clients de messagerie n'ouvrent pas ; ne
            rien encoder laisserait un `?` ou un `&` d'une adresse écrite en base par un
            chemin qui contourne Zod injecter des en-têtes `mailto` (bcc, body). Encoder puis
            restaurer le seul caractère qui doit rester littéral ferme les deux. */}
        {emailUtilisable !== null ? (
          <a
            className={styles.lien}
            href={`mailto:${encodeURIComponent(emailUtilisable).replace(/%40/g, "@")}`}
          >
            Répondre par e-mail
          </a>
        ) : null}
      </div>

      <span
        className={`${styles.etat} ${
          demande.isProcessed ? propre.etatTraitee : propre.etatATraiter
        }`}
      >
        {demande.isProcessed ? "Traitée" : "À traiter"}
      </span>

      {/* `dl` et non des paragraphes : ce sont des couples intitulé/valeur, et c'est ce qu'un
          lecteur d'écran doit entendre. */}
      <dl className={propre.fiche}>
        <div className={propre.champ}>
          <dt className={propre.intitule}>Nom ou structure</dt>
          <dd className={propre.valeur}>{expediteur}</dd>
        </div>

        <div className={propre.champ}>
          <dt className={propre.intitule}>Adresse e-mail</dt>
          <dd className={`${propre.valeur} ${propre.email}`}>
            {email ?? "(adresse manquante)"}
            {/* ⚠️ L'ABSENCE DU LIEN SE DIT. Sans cette phrase, un bénévole verrait une adresse
                à l'écran et pas de bouton « Répondre », sans savoir si c'est un défaut de la
                page ou de l'adresse. Le cas est rare (il suppose une écriture qui contourne
                Zod) mais son seul symptôme serait, sinon, un bouton manquant. */}
            {email !== null && emailUtilisable === null ? (
              <span className={propre.avertissement}>
                {" "}
                — cette adresse n&rsquo;a pas une forme valide : le bouton « Répondre » ne
                peut pas l&rsquo;utiliser. Recopiez-la à la main si elle vous paraît juste.
              </span>
            ) : null}
          </dd>
        </div>

        <div className={propre.champ}>
          <dt className={propre.intitule}>Type de demande</dt>
          {/* Libellé lu depuis `SOLICITATION_TYPE_LABELS`, jamais recopié : la constante
              existe précisément parce que deux copies divergeraient en silence (finding de
              revue de la 5.1). */}
          <dd className={propre.valeur}>{SOLICITATION_TYPE_LABELS[demande.requestType]}</dd>
        </div>

        <div className={propre.champ}>
          <dt className={propre.intitule}>Reçue le</dt>
          <dd className={propre.valeur}>{recuLe}</dd>
        </div>

        <div className={propre.champ}>
          <dt className={propre.intitule}>Message</dt>
          {/* `pre-wrap` : les retours à la ligne du visiteur sont conservés.
              `overflow-wrap: anywhere` (CSS) : saisie libre jusqu'à 5000 caractères — une URL
              longue ou un mot insécable y est valide, et `overflow-x: clip` le rognerait EN
              SILENCE (défaut mesuré en 6.9, 4ᵉ contrôle de `gate`). */}
          <dd className={propre.message}>{message}</dd>
        </div>
      </dl>

      {/* 🔴 LE CONSENTEMENT EST UN FAIT ACQUIS, PAS UNE BRANCHE DE RENDU. Le
          `CHECK (consent_given = true)` de la migration `0004` rend une ligne sans
          consentement INEXISTANTE : `demande.consentGiven` vaut toujours `true`. On l'affiche
          parce que le bénévole qui s'apprête à répondre doit pouvoir le voir — on ne teste
          pas une condition qui ne peut pas être fausse. */}
      <p className={styles.mention} role="note">
        Cette personne a <strong>coché la case de consentement</strong> pour être recontactée —
        c&rsquo;est ce qui vous autorise à lui répondre. Ne réutilisez pas son adresse pour
        autre chose que cette demande.
      </p>

      <div className={styles.section}>
        <h2 className={styles.sectionTitre}>Actions</h2>
        <SollicitationActions
          id={demande.id}
          expediteur={expediteur}
          recuLe={recuLe}
          isProcessed={demande.isProcessed}
          /* 🔴 Après suppression, on RETOURNE À LA LISTE : rafraîchir ici rejouerait la
             requête sur un identifiant qui n'existe plus et rendrait un 404 — juste
             techniquement, illisible pour quelqu'un qui vient de cliquer « Supprimer ». */
          redirigerVers="/admin/sollicitations"
        />
      </div>
    </>
  );
}
