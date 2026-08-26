"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";

import { deciderReclamation } from "@/server/actions/rattachement";
import styles from "./ReclamationsEngages.module.css";

export type ReclamationEnAttente = {
  id: string;
  engage: string;
  demandeur: {
    email: string | null;
    pseudo: string | null;
    discordPseudo: string | null;
    riotId: string | null;
  };
};

/**
 * Les réclamations en attente sur un tournoi (Story 12.1, 2/2).
 *
 * 🔴 CE BLOC EST LE LIVRABLE AUTANT QUE LA RÈGLE. Le rattachement se fait par validation
 * humaine : sans écran pour trancher, les demandes s'empilent et personne ne le sait — c'est le
 * défaut de la 10.13, une capacité complète et introuvable.
 *
 * 🔴 ET IL MONTRE DE QUOI JUGER, pas seulement qui demande. « Quelqu'un réclame ClaraByte » ne
 * permet **rien** décider : le bénévole accepterait par défaut, et la validation ne serait
 * qu'une formalité. Avec l'adresse et les identifiants déclarés, il reconnaît la personne.
 */
export function ReclamationsEngages({
  reclamations,
}: {
  reclamations: readonly ReclamationEnAttente[];
}) {
  const router = useRouter();
  const [enTransition, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  if (reclamations.length === 0) return null;

  const decider = (claimId: string, decision: "acceptee" | "refusee") => {
    demarrer(async () => {
      setErreur(null);
      try {
        const resultat = await deciderReclamation(claimId, decision);
        if (!resultat.ok) {
          setErreur(resultat.error);
          return;
        }
        router.refresh();
      } catch {
        setErreur("L'enregistrement a échoué. Réessayez.");
      }
    });
  };

  return (
    <section className={styles.bloc} aria-labelledby="reclamations-titre">
      <h3 className={styles.titre} id="reclamations-titre">
        {reclamations.length} demande{reclamations.length > 1 ? "s" : ""} de rattachement
      </h3>

      <p className={styles.aide}>
        Un joueur affirme qu&rsquo;une de ces inscriptions est la sienne. Accepter lui donne son
        historique&nbsp;; <strong>ça ne change ni son pseudo ni ses résultats</strong>.
        {/* ⚠️ DIRE CE QUE LE GESTE NE FAIT PAS : un bénévole qui craint de modifier un
            classement n'osera pas trancher, et les demandes resteront en attente. */}
      </p>

      <ul className={styles.liste}>
        {reclamations.map((demande) => (
          <li className={styles.ligne} key={demande.id}>
            <div className={styles.qui}>
              <p className={styles.engage}>{demande.engage}</p>
              {/* ⚠️ `—` QUAND UN IDENTIFIANT MANQUE : la ligne reste lisible, et l'absence est
                  elle-même une information pour qui doit reconnaître quelqu'un. */}
              <p className={styles.demandeur}>
                {[
                  demande.demandeur.pseudo,
                  demande.demandeur.discordPseudo ? `Discord ${demande.demandeur.discordPseudo}` : null,
                  demande.demandeur.riotId ? `Riot ${demande.demandeur.riotId}` : null,
                  demande.demandeur.email,
                ]
                  .filter((element): element is string => element !== null && element.length > 0)
                  .join(" · ") || "Aucun identifiant déclaré"}
              </p>
            </div>

            {/* ⚠️ DEUX GESTES, DEUX FORMES — jamais deux couleurs (principe ② de l'exercice
                Stitch). Accepter est le geste attendu, refuser reste discret. */}
            <div className={styles.gestes}>
              <Button
                disabled={enTransition}
                onClick={() => decider(demande.id, "acceptee")}
                variant="outline"
              >
                Accepter
              </Button>
              <button
                className={styles.refuser}
                disabled={enTransition}
                onClick={() => decider(demande.id, "refusee")}
                type="button"
              >
                Refuser
              </button>
            </div>
          </li>
        ))}
      </ul>

      {erreur ? (
        <p className={styles.erreur} role="status">
          {erreur}
        </p>
      ) : null}
    </section>
  );
}
