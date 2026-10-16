import { Brush, Button } from "@repo/ui";

import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import { TournamentCard, TournamentList } from "@/components/tournois/TournamentList/TournamentList";
import type { PublicTournament } from "@/server/db/queries/tournaments";
import motion from "@/styles/motion.module.css";
import styles from "./TournamentBridge.module.css";

/**
 * Le bloc « Nos tournois » de l'accueil : les PROCHAINS TOURNOIS RÉELS (retour UX du
 * 2026-10-16). Il montrait un classement TFT d'exemple — inventé, et seul jeu cité alors que dix
 * tournois de la Game'in Reims étaient en ligne.
 *
 * ⚠️ Mêmes cartes que `/tournois` : deux présentations d'un même tournoi divergeraient.
 * ⚠️ `motion.reveal` sur le contenu et PAS sur la section : le chapô de `SectionHead` (--grey)
 * tombe sous 4,5:1 pendant le fondu (patron EventHub 3.2, ProofBand 4.1).
 */
export function TournamentBridge({ tournois }: { tournois: readonly PublicTournament[] }) {
  return (
    <section className={styles.section} aria-labelledby="tournoi-title">
      <Wrap>
        <SectionHead
          eyebrow="Compétition accessible"
          titleId="tournoi-title"
          title={
            <>
              Nos <Brush>tournois</Brush>
            </>
          }
          intro={
            tournois.length > 0
              ? "Les prochains tournois de l'asso. Chaque fiche dit comment s'inscrire."
              : "Aucun tournoi annoncé pour l'instant — les prochains paraîtront ici."
          }
        />
        <div className={motion.reveal}>
          {tournois.length > 0 ? (
            <TournamentList>
              {tournois.map((tournoi) => (
                <TournamentCard key={tournoi.id} tournoi={tournoi} variante="a-venir" />
              ))}
            </TournamentList>
          ) : null}
          <div className={styles.cta}>
            <Button variant="gold" href="/tournois">
              Voir tous les tournois
            </Button>
          </div>
        </div>
      </Wrap>
    </section>
  );
}
