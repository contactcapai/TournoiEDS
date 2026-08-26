"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";

import { NOM_MEMBRE_MAX } from "@/lib/schemas/engage";
import { meDesinscrireDuTournoi, sInscrireAuTournoi } from "@/server/actions/inscription";

import styles from "./BlocInscription.module.css";

/**
 * S'inscrire à un tournoi depuis sa fiche, et s'en retirer (Story 12.3).
 *
 * 🔴 **`'use client'` SUR CE SEUL BLOC**, patron `BoutonVenue` (12.2) : `FicheTournoi` est un
 * Server Component et le reste. ⚠️ Et il n'est monté **que** sur les deux cas interactifs —
 * « je peux m'inscrire » et « je suis inscrit ». Les cas « il faut se connecter » et « ce n'est
 * pas possible, voici pourquoi » sont un lien et une phrase : la fiche les rend elle-même, sans
 * faire traverser la frontière client à quoi que ce soit.
 *
 * 🔴 **LE CHAMP EST CONTRÔLÉ, ET CE N'EST PAS NÉGOCIABLE** — défaut réel trouvé par une porte en
 * Story 5.1 : React 19 **réinitialise** les champs non contrôlés d'un `<form action={…}>` une fois
 * l'action résolue, succès **comme** échec. Un pseudo corrigé à la main serait donc effacé
 * exactement au moment où l'on demande de le corriger.
 */
export function BlocInscription({
  tournoiId,
  inscritSous,
  pseudoPropose,
}: {
  tournoiId: string;
  /** Le pseudo sous lequel on est **déjà** inscrit, `null` si on ne l'est pas encore. */
  inscritSous: string | null;
  /** Ce que le profil suggère (`pseudoSuggere`), `null` si rien n'est déclaré. */
  pseudoPropose: string | null;
}) {
  const router = useRouter();
  const [enTransition, demarrer] = useTransition();
  const [inscription, setInscription] = useState(inscritSous);
  const [pseudo, setPseudo] = useState(pseudoPropose ?? "");
  const [erreur, setErreur] = useState<string | null>(null);

  /**
   * ⚠️ `router.refresh()` PLUTÔT QU'UN `revalidatePath` DANS L'ACTION : la fiche est
   * `force-dynamic`, il n'y a **aucun cache à invalider** — ce que l'écran doit refaire, c'est
   * relire le décompte de places, qui a bougé. Poser un `revalidatePath` donnerait l'illusion
   * d'une garde de fraîcheur là où il n'y en a pas à tenir.
   */
  const inscrire = (donnees: FormData) => {
    demarrer(async () => {
      setErreur(null);
      try {
        const resultat = await sInscrireAuTournoi(tournoiId, donnees);
        if (!resultat.ok) {
          setErreur(resultat.error);
          return;
        }
        setInscription(resultat.data.pseudo);
        router.refresh();
      } catch {
        setErreur("Une erreur réseau est survenue, merci de réessayer.");
      }
    });
  };

  const retirer = () => {
    demarrer(async () => {
      setErreur(null);
      try {
        const resultat = await meDesinscrireDuTournoi(tournoiId);
        if (!resultat.ok) {
          setErreur(resultat.error);
          return;
        }
        setInscription(null);
        router.refresh();
      } catch {
        setErreur("Une erreur réseau est survenue, merci de réessayer.");
      }
    });
  };

  if (inscription !== null) {
    return (
      <div className={styles.bloc}>
        {/* ⚠️ LE PSEUDO EST RÉPÉTÉ, ET C'EST L'INFORMATION UTILE : c'est sous ce nom que le
            bénévole invitera en lobby, donc c'est lui qu'on vient vérifier. */}
        <p className={styles.confirme}>
          Vous êtes inscrit sous le pseudo <strong>{inscription}</strong>.
        </p>
        {/* ⚠️ CONTOUR ET NON PLEIN : se retirer est le geste secondaire de ce bloc. Deux gestes
            voisins prennent deux FORMES, jamais deux couleurs (principe ② de l'Epic 13). */}
        <button className={styles.retrait} disabled={enTransition} onClick={retirer} type="button">
          Annuler mon inscription
        </button>
        {erreur ? <p className={styles.erreur}>{erreur}</p> : null}
      </div>
    );
  }

  return (
    <form action={inscrire} className={styles.bloc}>
      <label className={styles.label} htmlFor="inscription-pseudo">
        Le pseudo sous lequel vous jouerez
      </label>
      {/* ⚠️ L'AIDE DIT À QUOI SERT LE CHAMP, PAS SON FORMAT — patron `AIDES_MODE_INSCRIPTION`.
          C'est ce pseudo qui servira à vous inviter dans la partie, donc celui qu'il faut
          corriger si la suggestion tombe à côté. */}
      <p className={styles.aide} id="inscription-pseudo-aide">
        C&rsquo;est avec lui qu&rsquo;on vous invitera dans la partie, et c&rsquo;est lui qui
        apparaîtra dans les résultats.
      </p>
      <input
        aria-describedby="inscription-pseudo-aide"
        className={styles.champ}
        id="inscription-pseudo"
        maxLength={NOM_MEMBRE_MAX}
        name="pseudo"
        onChange={(evenement) => setPseudo(evenement.target.value)}
        required
        type="text"
        value={pseudo}
      />
      <Button className={styles.valider} disabled={enTransition} type="submit">
        Je m&rsquo;inscris
      </Button>
      {erreur ? <p className={styles.erreur}>{erreur}</p> : null}
    </form>
  );
}
