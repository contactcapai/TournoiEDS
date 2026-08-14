import Image from "next/image";
import Link from "next/link";
import { Brush, Button, ExternalIcon, PhotoFrame } from "@repo/ui";

import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import { formatLongDate, formatTime } from "@/lib/date-paris";
import { LIBELLES_ETAT_INSCRIPTION } from "@/lib/libelles-tournoi";
import { classerDestination, NEW_TAB_SR } from "@/lib/links";
import { cleanText } from "@/lib/text";
import type { FicheTournoiData } from "@/server/db/queries/tournaments";
import editorial from "@/styles/editorial.module.css";
import motion from "@/styles/motion.module.css";
import styles from "./FicheTournoi.module.css";

/**
 * Le rendu public d'une fiche de tournoi (Story 9.3 — A20, A23). Server Component pur.
 *
 * 🔴 IL VIT DANS UN COMPOSANT ET NON DANS LA PAGE, PARCE QU'IL A **DEUX** CONSOMMATEURS :
 * `(public)/tournois/[slug]` et l'aperçu du bénévole `/admin/tournois/[id]/apercu`. C'est la
 * doctrine de la prévisualisation, écrite à la Story 6.3 et jamais démentie depuis : *« ce sont
 * les composants publics RÉELS, pas une maquette du formulaire. Une reproduction "fidèle"
 * divergerait au premier changement du rendu public, et mentirait exactement au moment où on
 * lui demande de dire la vérité. »*
 *
 * ⚠️ Il ne requête PAS : les deux appelants lisent puis distribuent en props (patron AC1 de la
 * 3.2). C'est ce qui permet à l'un de filtrer sur `is_published` et à l'autre non, **sans**
 * qu'aucune règle de rendu ne diverge entre les deux.
 *
 * 🔴 ET IL NE LIT PAS L'HORLOGE : `estPasse` lui **arrive**, calculé dans la couche données
 * (patron `getEventById`). Comparer `startsAt` à `new Date()` ici serait l'impureté que
 * `react-hooks/purity` refuse — deux rendus du même arbre pourraient répondre différemment.
 *
 * ⚠️ **AUCUNE PROP D'HABILLAGE** (pas de `variant`, pas de `compact`) : l'aperçu montre le rendu
 * réel ou ne sert à rien. La 3ᵉ prop « au cas où » est refusée depuis `SectionHead`.
 *
 * 🔴 **`headingLevel` EST LA SEULE EXCEPTION, ET UN CONSOMMATEUR RÉEL L'EXIGE** — ce n'est pas
 * une prop « au cas où ». Servie publiquement, la fiche EST le document : son titre est le
 * `<h1>`. Dans l'aperçu, l'écran d'admin porte déjà son propre `<h1>Aperçu</h1>` (patron de
 * `agenda/[id]/apercu`), et un second `<h1>` serait un défaut d'accessibilité réel — celui-là
 * même que Lighthouse audite et que ce projet tient à 100/100 depuis la Story 2.1.
 * ⚠️ Les **sections** descendent avec lui (`headingLevel + 1`) : décaler le titre sans décaler
 * ses sections fabriquerait un saut de niveau, c'est-à-dire l'autre moitié du même audit
 * (`heading-order`). Les deux se règlent ensemble ou pas du tout.
 */
export function FicheTournoi({
  tournoi,
  headingLevel = 1,
}: {
  tournoi: FicheTournoiData;
  headingLevel?: 1 | 2;
}) {
  // Dérivé, jamais passé en second paramètre : deux props de niveau finiraient par diverger,
  // et c'est exactement le saut de titre qu'on veut rendre impossible.
  const niveauSection = (headingLevel + 1) as 2 | 3;

  // `cleanText` : dernier filet du rendu contre une écriture qui contournerait Zod ET les
  // `CHECK` (`UPDATE` direct, restauration de sauvegarde) — `btrim` ne retire pas U+200B, et un
  // champ fait UNIQUEMENT de caractères sans largeur doit compter comme ABSENT, pas comme une
  // ligne vide (dette R41, Story 7.8).
  const salle = cleanText(tournoi.venueName);
  const format = cleanText(tournoi.formatText);
  const lots = cleanText(tournoi.prizes);

  /**
   * 🔴 LE PODIUM NE SE REND QUE SUR UN TOURNOI PASSÉ — RÈGLE QU'AUCUN `CHECK` NE POUVAIT TENIR
   * (AC4 de la 9.1) : une contrainte doit être IMMUABLE, or « passé » se compare à `now()`. Une
   * ligne valide aujourd'hui et invalide demain ferait échouer **toute restauration de
   * sauvegarde**, le jour précis où l'on en a le plus besoin.
   *
   * ⚠️ Les trois rangs sont filtrés **après** `cleanText` : les `CHECK`
   * `tournament_podium_sans_trou_*` interdisent déjà les trous, mais ils ne voient pas un
   * `podium_second` fait uniquement de caractères sans largeur — que `cleanText` ramène à
   * `null`. Filtrer après nettoyage est ce qui garantit qu'on ne rend jamais « 2ᵉ — » suivi de
   * rien. Patron repris **tel quel** de `TournamentCard` : deux façons de rendre un podium
   * divergeraient au premier ajustement de vocabulaire.
   */
  const podium: { rang: string; nom: string }[] = tournoi.estPasse
    ? [
        { rang: "1ᵉʳ", nom: cleanText(tournoi.podiumFirst) },
        { rang: "2ᵉ", nom: cleanText(tournoi.podiumSecond) },
        { rang: "3ᵉ", nom: cleanText(tournoi.podiumThird) },
      ].filter((place): place is { rang: string; nom: string } => place.nom !== null)
    : [];

  /**
   * 🔴 LE VISUEL N'EST RENDU QUE S'IL EST **SERVABLE**, et la décision se prend ici.
   * `/medias/[filename]` répond **404** pour une photo non publiée (garde de la 6.4), et rien
   * n'empêche de dépublier une photo déjà choisie comme visuel — `photo_id` reste alors intact,
   * la dépublication n'étant pas une suppression. Le raisonnement complet vit sur
   * `RELATION_VISUEL` dans `queries/tournaments.ts`.
   * ⚠️ **Et l'absence est le cas NOMINAL** : le seul tournoi saisi sur staging n'a pas de
   * visuel. La fiche doit donc être entière sans lui — le bloc est **omis**, jamais remplacé par
   * un cadre vide qui promettrait une photo.
   */
  const visuel = tournoi.photo?.isPublished ? tournoi.photo : null;

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * 🔴 L'ÉVÉNEMENT N'EST NOMMÉ QUE S'IL EST **PUBLIÉ** — ET RIEN D'AUTRE NE LE GARANTIT
   * ══════════════════════════════════════════════════════════════════════════════════════
   *
   * Mesuré le 2026-08-14 : `getEventsPourRattachement` **ne filtre pas** sur `is_published`
   * (délibérément — un bénévole prépare la Game'in Reims des semaines à l'avance, événement
   * d'agenda en brouillon compris), et `actions/tournois.ts` ne **couple pas** la publication
   * d'un tournoi à celle de son événement. Un tournoi publié rattaché à un événement
   * **brouillon** est donc un état parfaitement atteignable, et personne ne l'interdit.
   * ⇒ Nommer l'événement sans ce booléen **publierait le titre d'un brouillon d'agenda**.
   * ⚠️ Et **aucune porte visuelle ne le verrait** : une page qui affiche une ligne de plus n'a
   * pas l'air cassée. C'est la même famille que la fuite de brouillons que le filtre
   * `is_published` de la liste interdit — dite ici parce qu'elle passe par une RELATION.
   */
  const evenement = tournoi.event?.isPublished ? tournoi.event : null;

  /**
   * 🔴 LE BOUTON « S'INSCRIRE » EST UN **CONTRAT DÉJÀ ÉCRIT AU BÉNÉVOLE**, mot pour mot.
   * `AIDES_MODE_INSCRIPTION` s'affiche dans le formulaire d'admin **au moment du choix** :
   *   · `mately` → *« l'adresse ci-dessous devient le bouton « S'inscrire » de la page du
   *     tournoi »* ⇒ le libellé est « S'inscrire », et pas un synonyme ;
   *   · `interne` → *« la page du tournoi affichera l'état des inscriptions mais aucun
   *     bouton »* ⇒ aucun bouton, même si une URL traînait en base.
   * Une fiche qui ne les tiendrait pas ferait **mentir le back-office**, et le mensonge serait
   * invisible côté admin.
   *
   * 🔴 **QUATRE CONDITIONS, ET CHACUNE EST UNE PROMESSE QU'ON REFUSE DE FAIRE À VIDE :**
   *   ① le tournoi n'est **pas passé** — la base autorise un tournoi passé resté `ouvertes`
   *      (personne ne referme les inscriptions d'un tournoi terminé, aucun geste n'existe pour
   *      ça), et proposer de s'y inscrire serait une promesse impossible, famille de R2 ;
   *   ② les inscriptions sont **ouvertes** — `completes` et `fermees` disent l'état sans offrir
   *      de porte ;
   *   ③ le mode est `mately` ;
   *   ④ l'URL est **réellement externe**. Le `CHECK` `tournament_mately_a_son_url` garantit
   *      déjà qu'un mode `mately` porte une URL, mais il ne dit pas qu'elle est `http(s)` :
   *      `classerDestination` est le SEUL endroit du dépôt qui tranche « externe / interne /
   *      absente », et un `"#"` ne doit JAMAIS annoncer « nouvel onglet » (dette R2, mesurée
   *      par `gate:links`).
   */
  const urlInscription = cleanText(tournoi.registrationUrl);
  const inscriptionOuverte =
    !tournoi.estPasse &&
    tournoi.registrationState === "ouvertes" &&
    tournoi.registrationMode === "mately" &&
    urlInscription !== null &&
    classerDestination(urlInscription) === "externe";

  return (
    <>
      {/* ① Tête de page. Le `<h1>` est celui du document quand la fiche est servie
          publiquement ; dans l'aperçu, l'écran d'admin lui donne son propre `<h1>` et
          `headingLevel` descend d'un cran — d'où la prop plutôt qu'un niveau en dur. */}
      <section className={editorial.head} aria-labelledby="tournoi-title">
        <Wrap>
          <SectionHead
            headingLevel={headingLevel}
            titleId="tournoi-title"
            eyebrow={tournoi.estPasse ? "Déjà joué" : "Compétition"}
            title={<Brush>{tournoi.name}</Brush>}
          />

          {/* ══════════════════════════════════════════════════════════════════════════
              L'ESSENTIEL (A23 ①) — UNE LISTE DE DESCRIPTION, PAS UN TABLEAU
              ══════════════════════════════════════════════════════════════════════════
              `<dl>` : chaque ligne est un COUPLE terme/valeur, et c'est exactement ce
              qu'un lecteur d'écran annonce alors. Un tableau supposerait deux dimensions
              qui n'existent pas ici, et une suite de <p> perdrait le lien entre
              l'étiquette et sa valeur.
              🔴 CHAQUE LIGNE FACULTATIVE DISPARAÎT ENTIÈREMENT quand la donnée manque —
              jamais une étiquette orpheline, jamais « — », jamais « Non renseigné »
              (NFR8, UX-DR10). Seuls la date et le jeu sont inconditionnels : `starts_at`
              et `game` sont `notNull` ET non vides (`tournament_game_valide`). */}
          <dl className={styles.essentiel}>
            <div className={styles.ligne}>
              <dt className={styles.terme}>Quand</dt>
              <dd className={styles.valeur}>
                {formatLongDate(tournoi.startsAt)} · {formatTime(tournoi.startsAt)}
              </dd>
            </div>

            <div className={styles.ligne}>
              <dt className={styles.terme}>Jeu</dt>
              <dd className={styles.valeur}>{tournoi.game}</dd>
            </div>

            {salle ? (
              <div className={styles.ligne}>
                <dt className={styles.terme}>Où</dt>
                <dd className={styles.valeur}>{salle}</dd>
              </div>
            ) : null}

            {/* ⚠️ UNE CAPACITÉ N'EST PAS UN CHIFFRE DE COMMUNAUTÉ — distinction à ne pas
                « harmoniser ». FR16 interdit les chiffres de communauté (membres,
                audience), et c'est pourquoi `workshop` et `member` n'ont AUCUNE colonne
                d'effectif. Une capacité de tournoi est autre chose : une contrainte
                d'organisation que le visiteur doit connaître pour décider, explicitement
                demandée par A23 ①. Le raisonnement est écrit sur la colonne elle-même. */}
            {tournoi.capacity !== null ? (
              <div className={styles.ligne}>
                <dt className={styles.terme}>Places</dt>
                <dd className={styles.valeur}>{tournoi.capacity}</dd>
              </div>
            ) : null}

            {/* Le rattachement, NOMMÉ SANS LIEN (arbitrage) : `/agenda` n'a aucune ancre
                par événement aujourd'hui, et en fabriquer une au passage serait livrer
                une seconde chose non demandée. */}
            {evenement ? (
              <div className={styles.ligne}>
                <dt className={styles.terme}>Dans le cadre de</dt>
                <dd className={styles.valeur}>{evenement.title}</dd>
              </div>
            ) : null}
          </dl>
        </Wrap>
      </section>

      {/* ② COMMENT S'INSCRIRE (A23 ②) — section relevée sur --navy, procédé de la maquette
          pour ses sections d'agenda, repris par /agenda et /tournois.

          🔴 `motion.reveal` n'est PAS sur la <section> : elle contient le <h2> et son
          chapô en --grey, qui tombe à 3,25:1 sur --navy pendant le fondu (4,60:1 au
          plein). C'est le patron par défaut de toute section animée à fond --navy depuis
          qu'il a été payé DEUX fois — `EventHub` (3.2) puis `ProofBand` (4.1). La classe
          n'enveloppe donc que le contenu, dont les textes sont en --cream/--light.
          ⚠️ Valeur RE-MESURÉE et non recopiée : le calcul rend 3,25 à o=0,75 (3,20 au
          plancher 0,747) ; `/agenda` écrit « 3,24:1 ». L'écart est au centième et ne
          change aucune décision — les deux passent sous 4,5 —, mais on ne recopie pas un
          chiffre.

          🔴 CETTE SECTION EXISTE MÊME SUR UN TOURNOI PASSÉ, et elle y montre le PODIUM :
          sur un tournoi joué, l'information utile n'est pas « pouvait-on s'inscrire »,
          c'est QUI A GAGNÉ. C'est la lecture d'A7 déjà arbitrée sur la carte (Story 9.2),
          tenue ici à l'identique — deux surfaces qui répondraient différemment à la même
          question seraient un défaut, pas une nuance. */}
      <section
        className={`${editorial.section} ${styles.action}`}
        aria-labelledby="action-title"
      >
        <Wrap>
          <SectionHead
            headingLevel={niveauSection}
            eyebrow={tournoi.estPasse ? "Résultats" : "Participer"}
            titleId="action-title"
            title={tournoi.estPasse ? "Le podium" : "S'inscrire"}
          />

          <div className={motion.reveal}>
            {tournoi.estPasse ? (
              podium.length > 0 ? (
                /* `<ol>` et non `<ul>` : un podium est un CLASSEMENT, l'ordre porte le
                   sens. Le rang est écrit en toutes lettres et pas laissé au marqueur
                   natif — la liste peut ne compter qu'une ou deux places (un 1ᵉʳ seul est
                   valide), et un « 1. » puis « 2. » automatiques diraient la même chose
                   sans la dire. Patron de `TournamentCard`, repris tel quel. */
                <ol className={styles.podium} role="list">
                  {podium.map((place) => (
                    <li key={place.rang} className={styles.podiumPlace}>
                      <span className={styles.podiumRang}>{place.rang}</span>
                      <span className={styles.podiumNom}>{place.nom}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                /* ⚠️ UN ÉTAT VIDE QUI DIT CE QUI SE PASSE, jamais « aucun podium ».
                   Doctrine tenue depuis la 3.2, rendue non négociable par la leçon 4.2 :
                   *un état « tout à zéro » ressemble à « tout va bien »* — donc aussi à
                   une panne. Le podium se SAISIT (le moteur n'existe pas encore) : son
                   absence sur un tournoi récent est le cas normal, pas un défaut. */
                <p className={styles.vide}>
                  Les résultats de ce tournoi ne sont pas encore en ligne — ils arrivent
                  dès que la feuille de match est remontée.
                </p>
              )
            ) : (
              <div className={styles.inscription}>
                <p className={styles.etat}>
                  <span className={styles.etatLabel}>Inscriptions</span>
                  <span className={styles.etatValeur}>
                    {LIBELLES_ETAT_INSCRIPTION[tournoi.registrationState]}
                  </span>
                </p>

                {inscriptionOuverte && urlInscription ? (
                  /* Lien SORTANT : il part chez MATELY. `target="_blank"` +
                     `rel="noopener noreferrer"` + `ExternalIcon` + mention SR, et
                     UNIQUEMENT parce que `classerDestination` a répondu « externe » —
                     jamais posé à la main sur un href non classé. */
                  <Button
                    href={urlInscription}
                    target="_blank"
                    rel="noopener noreferrer"
                    icon={<ExternalIcon />}
                    className={styles.ctaInscription}
                  >
                    S&rsquo;inscrire
                    <span className="sr-only">{NEW_TAB_SR}</span>
                  </Button>
                ) : (
                  /* ⚠️ AUCUN BOUTON INERTE ICI. Un `<Button inactive>` porterait
                     l'apparence d'un CTA sans destination : le projet l'a prévu pour les
                     cas où le CTA doit RESTER visible (Story 5.5), ce qui n'est pas le
                     nôtre — il n'y a rien à promettre. La phrase ci-dessous DIT pourquoi,
                     ce qu'un bouton grisé ne fait pas. */
                  <p className={styles.etatAide}>
                    {tournoi.registrationState === "completes"
                      ? "Toutes les places annoncées sont prises."
                      : tournoi.registrationMode === "interne"
                        ? "Les inscriptions se prennent directement avec nous — sur place ou sur notre Discord."
                        : "Les inscriptions ne sont pas ouvertes pour le moment."}
                  </p>
                )}
              </div>
            )}
          </div>
        </Wrap>
      </section>

      {/* ③ LE DÉTAIL DU FORMAT (A23 ③) — SECTION ENTIÈREMENT OMISE quand aucune des trois
          données n'est saisie : pas de section vide, pas de « rien à afficher » (même
          traitement que le carrousel d'/agenda et que les catégories vides de
          /partenaires).
          🔴 LE FORMAT ANNONCÉ EST **ÉDITORIAL**, ET LES PHASES FERONT FOI (A23 ③). Le jour
          où elles existeront (Story 10.1), il y aura DEUX descriptions du même format :
          les phases l'emportent, et cette section devra alors DÉRIVER ce qu'elle affiche
          au lieu de lire deux sources. C'est décidé maintenant pour ne pas l'être dans
          l'urgence.
          Fond par défaut (--navy-deep) : le contraste des textes clairs y est encore
          meilleur que sur --navy — RE-MESURÉ, `--light` sous fondu donne 8,71:1 contre
          7,47:1. */}
      {format || lots || tournoi.matchDurationMinutes !== null ? (
        <section className={editorial.section} aria-labelledby="format-title">
          <Wrap>
            <SectionHead
              headingLevel={niveauSection}
              eyebrow="Le déroulé"
              titleId="format-title"
              title="Comment ça se joue"
            />

            <div className={motion.reveal}>
              <dl className={styles.format}>
                {format ? (
                  <div className={styles.ligne}>
                    <dt className={styles.terme}>Format</dt>
                    <dd className={styles.valeur}>{format}</dd>
                  </div>
                ) : null}

                {tournoi.matchDurationMinutes !== null ? (
                  <div className={styles.ligne}>
                    <dt className={styles.terme}>Durée d&rsquo;un match</dt>
                    {/* ⚠️ « min » et non « minutes » : la colonne est un ENTIER en minutes
                        (et pas du texte) précisément pour que personne n'ait à re-parser
                        du français — la Story 11.1 doit l'envoyer à MATELY. L'unité est
                        donc écrite ICI, une seule fois, et jamais saisie. */}
                    <dd className={styles.valeur}>
                      {tournoi.matchDurationMinutes}&nbsp;min
                    </dd>
                  </div>
                ) : null}

                {lots ? (
                  <div className={styles.ligne}>
                    <dt className={styles.terme}>Lots</dt>
                    <dd className={styles.valeur}>{lots}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </Wrap>
        </section>
      ) : null}

      {/* ④ LE VISUEL — omis complètement quand il n'y en a pas (cas NOMINAL). */}
      {visuel ? (
        <section className={`${editorial.section} ${motion.reveal}`}>
          <Wrap>
            <div className={styles.media}>
              {/* ⚠️ AUCUNE `caption` sur le cadre : le `figcaption` de `PhotoFrame` est
                  rendu en Caveat et NE SE COUPE PAS — en Story 6.4, un titre long y a fait
                  déborder /agenda de 33px à 320px. Aucune donnée de tournoi n'est bornée
                  assez court (le nom va à 80 caractères). Le nom du tournoi est déjà le
                  titre, juste au-dessus.
                  ⚠️ `alt` vient de la photo elle-même : obligatoire depuis la 4.3 (NFR3),
                  et il DÉCRIT l'image là où le texte de la page décrit le tournoi. */}
              <PhotoFrame rotation={-2}>
                <Image
                  src={`/medias/${visuel.filename}`}
                  alt={visuel.alt}
                  fill
                  sizes="(max-width: 880px) 100vw, 640px"
                  loading="lazy"
                />
              </PhotoFrame>
            </div>
          </Wrap>
        </section>
      ) : null}

      {/* ⑤ RENVOI FINAL — la fiche est la seule page de SECOND NIVEAU du site public, donc
          la seule qui ait besoin de dire d'où l'on vient. Un simple renvoi dans le
          vocabulaire des renvois existants, et PAS un fil d'Ariane : aucune autre page n'en
          porte, et en introduire un ici en ferait une convention à tenir sur sept pages.
          ⚠️ La phrase se DÉRIVE du rattachement plutôt que d'affirmer : depuis la Story 9.5,
          `event_id` est facultatif, et « ce tournoi fait partie d'un rendez-vous plus large »
          serait faux sur un tournoi qui EST le rendez-vous. C'est la même famille de défauts
          que la dette R48 — et c'est la phrase jumelle, sur `/tournois`, qui l'a payée. */}
      <section className={`${editorial.section} ${motion.reveal}`}>
        <Wrap>
          <div className={styles.retour}>
            <p>
              {evenement
                ? "Ce tournoi fait partie d’un rendez-vous plus large : le programme complet est dans l’agenda."
                : "Les autres tournois, à venir comme déjà joués, sont sur la page des tournois."}
            </p>
            <div className={styles.retourActions}>
              <Button variant="outline" href="/tournois">
                Tous les tournois
              </Button>
              {/* `Link` et non `Button` : deux boutons côte à côte donneraient deux CTA de
                  même poids là où il n'y a qu'une destination principale. */}
              <Link className={styles.lienDoux} href="/agenda">
                Voir l&rsquo;agenda
              </Link>
            </div>
          </div>
        </Wrap>
      </section>
    </>
  );
}
