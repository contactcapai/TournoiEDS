"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@repo/ui";

import { reclamerInscription } from "@/server/actions/rattachement";
import styles from "./MesInscriptions.module.css";

export type InscriptionRattachee = {
  id: string;
  displayName: string;
  tournoiNom: string;
  tournoiSlug: string;
};

export type InscriptionProposee = InscriptionRattachee & {
  /** `null` = jamais demandée. Sinon, l'état de MA demande. */
  etatDemande: "en_attente" | "acceptee" | "refusee" | null;
};

/**
 * « Mes tournois » et « Est-ce vous ? » (Story 12.1, 2/2).
 *
 * 🔴 CE COMPOSANT NE RATTACHE RIEN, IL **DEMANDE**. Le rapprochement affiché n'est qu'une
 * suggestion tirée des pseudos déclarés ; c'est un bénévole qui tranche. L'écran doit donc le
 * dire — sans quoi quelqu'un croirait son historique perdu parce que le bouton « n'a rien fait ».
 */
export function MesInscriptions({
  rattachees,
  proposees,
}: {
  rattachees: readonly InscriptionRattachee[];
  proposees: readonly InscriptionProposee[];
}) {
  const [enTransition, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [demandees, setDemandees] = useState<Set<string>>(new Set());

  const reclamer = (entryId: string) => {
    demarrer(async () => {
      setErreur(null);
      try {
        const resultat = await reclamerInscription(entryId);
        if (!resultat.ok) {
          setErreur(resultat.error);
          return;
        }
        // ⚠️ ÉTAT LOCAL EN PLUS du `revalidatePath` côté action : le rendu revient, mais la
        // ligne doit cesser d'être cliquable IMMÉDIATEMENT, sinon un second clic part avant
        // que le serveur n'ait répondu. C'est `onConflictDoNothing` qui rattrape, pas l'écran.
        setDemandees((precedent) => new Set(precedent).add(entryId));
      } catch {
        setErreur("La demande a échoué. Réessayez.");
      }
    });
  };

  return (
    <>
      {rattachees.length > 0 ? (
        <ul className={styles.liste}>
          {rattachees.map((inscription) => (
            <li className={styles.ligne} key={inscription.id}>
              <span className={styles.nom}>{inscription.displayName}</span>
              {/* ⚠️ ON RENVOIE VERS LA FICHE, on ne recopie PAS le résultat : le classement et
                  les rencontres y sont déjà (14.2, 14.3), et les recalculer ici fabriquerait
                  un second classement qui divergerait du premier. */}
              <Link className={styles.lien} href={`/tournois/${inscription.tournoiSlug}`}>
                {inscription.tournoiNom}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.vide}>
          Aucune inscription n&rsquo;est encore rattachée à votre compte.
        </p>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════
          EST-CE VOUS ? — LA SUGGESTION, ET CE QU'ELLE N'EST PAS
          ══════════════════════════════════════════════════════════════════════════════
          ⚠️ LA SECTION N'EXISTE PAS QUAND IL N'Y A RIEN À PROPOSER. Écrire « aucune
          correspondance » à quelqu'un qui n'a déclaré aucun pseudo lui ferait chercher une
          panne : c'est le chapô ci-dessus, côté page, qui explique d'où viennent ces
          propositions. */}
      {proposees.length > 0 ? (
        <div className={styles.suggestions}>
          <p className={styles.aide}>
            Ces inscriptions portent l&rsquo;un des pseudos que vous avez déclarés. Si
            c&rsquo;est bien vous, demandez le rattachement&nbsp;:{" "}
            <strong>un bénévole vérifie avant que ce soit pris en compte</strong>.
          </p>

          <ul className={styles.liste}>
            {proposees.map((inscription) => {
              const demandee = inscription.etatDemande !== null || demandees.has(inscription.id);
              return (
                <li className={styles.ligne} key={inscription.id}>
                  <span className={styles.nom}>{inscription.displayName}</span>
                  <Link className={styles.lien} href={`/tournois/${inscription.tournoiSlug}`}>
                    {inscription.tournoiNom}
                  </Link>

                  {/* 🔴 TROIS ÉTATS, TROIS PHRASES. « Refusée » se DIT : la taire laisserait
                      quelqu'un attendre indéfiniment une réponse déjà donnée, et re-demander
                      une inscription qui n'est pas la sienne. */}
                  {inscription.etatDemande === "refusee" ? (
                    <span className={styles.etat}>Demande refusée</span>
                  ) : demandee ? (
                    <span className={styles.etat}>Demande envoyée</span>
                  ) : (
                    <Button
                      disabled={enTransition}
                      onClick={() => reclamer(inscription.id)}
                      variant="outline"
                    >
                      C&rsquo;est moi
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {erreur ? (
        <p className={styles.erreur} role="status">
          {erreur}
        </p>
      ) : null}
    </>
  );
}
