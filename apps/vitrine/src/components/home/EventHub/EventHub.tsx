import { Brush, Button, ExternalIcon, LinkArrow } from "@repo/ui";
import { EventList, EventRow } from "@/components/agenda/EventList/EventList";
import { NextEventCard } from "@/components/agenda/NextEventCard/NextEventCard";
import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import { NEW_TAB_SR, classerDestination } from "@/lib/links";
import { destinationDuCta, estJeudiJeux } from "@/lib/rendez-vous";
import { etatDeVenue } from "@/lib/venues";
import type { RendezVous } from "@/server/db/queries/rendez-vous";
import motion from "@/styles/motion.module.css";
import styles from "./EventHub.module.css";

// Hub événementiel de l'accueil (Story 3.2) — transcription de la section `.agenda`
// de docs/refonte-2026/maquette/index.html (CSS l.94-116, markup l.251-281).
//
// Server Component pur : aucune interactivité, donc aucun 'use client'. C'est la PAGE
// qui lit la base et distribue en props — ce composant ne requête rien. Cette règle
// n'est pas cosmétique : le badge « CE JEUDI » du hero et la carte ci-dessous doivent
// désigner la MÊME date, ce que seule une lecture unique garantit.
//
// ⚠️ CE QU'IL RESTE ICI APRÈS LA STORY 3.3 : uniquement ce qui est PROPRE AU HUB —
// la coquille de section, la tête éditoriale, la note de roulement, le renvoi vers
// l'agenda et l'état vide. La carte et la liste sont parties dans
// `components/agenda/` à l'arrivée de leur 2ᵉ consommateur (la page /agenda).
// Ne PAS les réimplémenter ici.
//
// Les formulations sont CONTRACTUELLES (UX-DR18) — ne pas les reformuler.

export interface EventHubProps {
  /**
   * Ce que le visiteur peut faire des rendez-vous affichés (Story 12.2) — résolu par la PAGE.
   * ⚠️ `connecte` + l'ensemble de MES venues, pas un booléen par ligne : la page lit une fois,
   * et ce composant reste un Server Component pur.
   */
  venue: { connecte: boolean; mesVenues: ReadonlySet<string> };
  /** Prochain rendez-vous publié, ou `null` s'il n'y en a aucun (état vide). */
  next: RendezVous | null;
  /** Les suivants — le roulement. Peut être vide sans que ce soit l'état vide. */
  rest: RendezVous[];
  /**
   * Invitation Discord, ou `DESTINATION_ABSENTE` — Story 6.13.
   *
   * ⚠️ En PROP et non en import : la valeur vit dans `site_setting` et se lit par un module
   * `server-only`. La PAGE requête et distribue (patron AC1 de la 3.2) — c'est aussi ce qui
   * permet à la page de ne payer qu'une lecture pour ses deux consommateurs.
   */
  discordUrl: string;
}

/** État vide : aucune date à venir. Propre au hub — la page /agenda a le sien. */
function EmptyState({ discordUrl }: { discordUrl: string }) {
  // Le comportement se dérive de la destination : le jour où la vraie invitation arrive,
  // ce lien devient sortant SANS retoucher ce fichier — comme le footer et le menu mobile.
  // 🔴 MISE À JOUR 6.13 : « la vraie invitation » se SAISIT désormais dans `/admin/reglages`.
  const discord = classerDestination(discordUrl);
  const discordExternal = discord === "externe";
  // 🔴 SANS DESTINATION, LE MOT N'EST PLUS UN LIEN (Story 5.5, dette R2). La phrase,
  // elle, N'EST PAS reformulée : c'est du contenu ÉDITORIAL, et le choix le moins
  // destructeur est aussi le plus réversible — le jour où l'invitation Discord existe,
  // la phrase redevient juste sans qu'on ait touché à un mot.
  // ⚠️ Point présenté au gate ÉDITORIAL de Brice : une tuile morte ne promet rien, un
  // MOT mort dans une phrase promet une action impossible. C'est la seule occurrence
  // de cette famille sur le site (avec l'aside et l'état vide d'`/agenda`).

  return (
    <div className={styles.empty}>
      <p className={styles.emptyText}>
        Pas de jeudi calé pour l&apos;instant — on prépare la suite. En attendant, dis
        bonjour sur{" "}
        {discord === "absente" ? (
          <span className={styles.emptyLink} data-inerte="">
            Discord
          </span>
        ) : (
          <a
            href={discordUrl}
            className={`${styles.emptyLink} ${styles.emptyLinkActif}`}
            {...(discordExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            Discord
            {/* 🔴 INDICATION VISIBLE DE LIEN SORTANT — AJOUTÉE PAR LA STORY 6.13, ET LE DÉFAUT
                N'ÉTAIT PAS ATTEIGNABLE AVANT ELLE. `EXPERIENCE.md` l.199 exige, pour un lien
                sortant à libellé TEXTE, « indication visible + texte lecteur d'écran ». Ce
                lien n'avait que le second — mais il ne pouvait pas être sortant : `DISCORD_URL`
                valait `DESTINATION_ABSENTE` depuis toujours (dette R29), donc le rendu retombait
                sur un `<span>` inerte. C'est cette story, en rendant la valeur SAISISSABLE, qui
                rend le cas atteignable.
                ⚠️ MESURÉ, PAS DÉDUIT : `gate:links` garde ② est passée ROUGE dès que la porte
                `gate:reglages` a renseigné les cinq destinations — l'état que personne n'avait
                jamais produit sur ce projet. */}
            <ExternalIcon />
            {discordExternal ? <span className="sr-only">{NEW_TAB_SR}</span> : null}
          </a>
        )}
        .
      </p>
      <Button variant="gold" href="/agenda">
        Voir l&apos;agenda
      </Button>
    </div>
  );
}

export function EventHub({ next, rest, discordUrl, venue }: EventHubProps) {
  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * 🔴 DEUX AFFIRMATIONS DE CE FICHIER ÉTAIENT FAUSSES — DETTE R48, MESURÉE SUR STAGING
   * ══════════════════════════════════════════════════════════════════════════════════════
   *
   * Le 2026-08-14, sur le premier événement `special` jamais saisi (« Tournoi TFT 15/09 »,
   * **mardi**, lieu « En ligne »), ce hub rendait « On se voit **jeudi** ? » puis « Roulement
   * sur **4 bars rémois** — 1 jeudi par mois chacun ». Les deux sont faux, et aucune porte ne
   * pouvait le voir : ce sont des phrases **justes** pour toute donnée que le projet avait
   * jamais eue. `special` existait depuis la 3.1 ; **personne n'en avait saisi un**.
   *
   * ⚠️ LES DEUX DÉRIVATIONS NE SONT PAS LA MÊME, ET C'EST LE POINT DÉLICAT :
   *   · le **titre** parle du **prochain** rendez-vous — celui que la carte montre ;
   *   · la **note de roulement** parle de **ce que la liste montre**. Elle reste vraie tant
   *     qu'au moins un jeudi jeux est rendu, même si le prochain rendez-vous est un tournoi :
   *     dans ce cas le roulement est bien ce qu'on est en train de décrire en dessous. La lier
   *     au seul `next` l'aurait fait disparaître d'un hub qui liste quatre jeudis.
   *
   * ⚠️ Les formulations restent **CONTRACTUELLES** (UX-DR18) : on ne reformule pas, on **masque
   * ou on substitue**, et la substitution du titre est portée au gate ÉDITORIAL de Brice.
   */
  const rendus = next ? [next, ...rest] : [];
  const titreJeudi = next !== null && estJeudiJeux(next);
  const roulementVrai = rendus.some(estJeudiJeux);
  const cta = next ? destinationDuCta(next) : null;

  return (
    // aria-labelledby ↔ id du <h2> de la tête de section (pattern acquis review 1.6 F6).
    <section className={styles.section} aria-labelledby="agenda-title">
      <Wrap>
        <SectionHead
          eyebrow="Le rendez-vous"
          titleId="agenda-title"
          title={
            <>
              On se voit{" "}
              {/* &nbsp; avant le « ? » : espace insécable de la typographie française,
                  déjà dans la maquette (`jeudi&nbsp;?`). Le {" "} explicite au-dessus
                  évite l'espace avalée par JSX (leçon 2.6). */}
              {/* 🔴 « jeudi » ⇒ « bientôt » quand le prochain rendez-vous
                  N'EST PAS un jeudi jeux (R48 ①). Le mot substitué reste DANS le `<Brush>` :
                  c'est lui que le trait de pinceau souligne, et le sortir changerait le titre. */}
              <Brush>
                {titreJeudi ? "jeudi" : "bient\u00F4t"}
                {"\u00A0"}?
              </Brush>
            </>
          }
          intro="Toutes nos dates sont ici, sur le site. Plus besoin de fouiller Discord pour savoir où on se retrouve cette semaine."
        />

        {/* 🔴 `motion.reveal` EST POSÉ ICI, ET SÛREMENT PAS SUR LA <section> —
            contrairement à ThreeAxes et DoubleDoor, qui la portent sur la section.
            Raison MESURÉE : cette section pose du `--grey` (le chapô de SectionHead)
            sur `--navy`. ⚠️ Elle n'est PLUS la seule depuis la Story 4.1 : `ProofBand`
            est dans le même cas et applique le même montage — c'est devenu le patron
            par défaut de toute section animée à fond `--navy` (motion.module.css).
            À pleine opacité la combinaison donne 4,60:1 — conforme, mais
            avec 0,10 de marge seulement. Or `motion.reveal` part de `opacity: 0.75`,
            ce qui mélange 25 % de fond dans le texte et fait tomber le rapport à
            ≈ 3,25:1 pendant toute l'apparition — même magnitude d'échec que l'or sur
            navy-deep attrapé par Lighthouse en Story 2.8.
            Ce <div> n'enveloppe donc QUE la carte et le roulement, dont les textes
            sont en --cream / --gold / --light. Le SectionHead reste à l'opacité 1.
            ⚠️ Ne pas « simplifier » en remontant cette classe sur la <section>. */}
        <div className={motion.reveal}>
          {next ? (
            <>
              {/* 🔴 LE CTA NE RENVOIE PLUS VERS /agenda (R48 ③) — sa destination se DÉRIVE des
                  tournois du rendez-vous, et il DISPARAÎT quand il n'y en a aucun. Ce n'est pas
                  une perte : « J'y serai » vers /agenda ne promettait rien qu'un clic pouvait
                  tenir, et le lien « Voir tout l'agenda » juste en dessous y mène déjà.
                  ⚠️ Le libellé reste « J'y serai » — formulation contractuelle (UX-DR18). Ce
                  qui était faux était la destination, pas le mot. */}
              <NextEventCard
                rendezVous={next}
                venue={
                  next.nature === "evenement"
                    ? {
                        evenementId: next.evenement.id,
                        connecte: venue.connecte,
                        jyVais: venue.mesVenues.has(next.evenement.id),
                      }
                    : undefined
                }
                cta={cta ? { label: "J'y serai", href: cta } : undefined}
              />

              {rest.length > 0 ? (
                <EventList>
                  {rest.map((rendezVous) => (
                    <EventRow
                      key={rendezVous.cle}
                      rendezVous={rendezVous}
                      venue={etatDeVenue(rendezVous, venue.connecte, venue.mesVenues)}
                    />
                  ))}
                </EventList>
              ) : null}

              {/* 🔴 LA NOTE DE ROULEMENT DÉCRIT LES JEUDIS — elle ne se rend donc que si la
                  liste en montre au moins un (R48 ②). Sur un hub qui n'affiche qu'un tournoi
                  et un temps fort, elle parlerait de quelque chose d'absent de l'écran. */}
              {roulementVrai ? (
                <p className={styles.footNote}>
                  Roulement sur 4 bars rémois — 1 jeudi par mois chacun
                </p>
              ) : null}

              <div className={styles.more}>
                <LinkArrow href="/agenda">Voir tout l&apos;agenda</LinkArrow>
              </div>
            </>
          ) : (
            <EmptyState discordUrl={discordUrl} />
          )}
        </div>
      </Wrap>
    </section>
  );
}
