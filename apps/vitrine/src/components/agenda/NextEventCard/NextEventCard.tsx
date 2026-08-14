import { Button } from "@repo/ui";
import { formatBigDate, formatPlageHoraire } from "@/lib/date-paris";
import { LIBELLES_ETAT_INSCRIPTION } from "@/lib/libelles-tournoi";
import { estJeudiJeux } from "@/lib/rendez-vous";
import { cleanText } from "@/lib/text";
import type { RendezVous } from "@/server/db/queries/rendez-vous";
import styles from "./NextEventCard.module.css";

// Carte du prochain rendez-vous (`.next` de la maquette) — Server Component pur.
//
// Écrite par la Story 3.2 dans `components/home/EventHub/`, EXTRAITE ICI par la 3.3
// à l'arrivée de son deuxième consommateur réel (la page /agenda). C'est le
// déclencheur d'extraction du projet — « payé DEUX fois », METHODE.md §5 — et
// `EXPERIENCE.md` l.128 place explicitement cette carte sur les DEUX surfaces
// (« Hub, page Agenda »).
//
// ⚠️ NOMMAGE : `architecture.md` l.500 annonçait `NextThursdayCard`. Le nom serait
// FAUX : la Story 3.2 a établi (AC5) que la prochaine date n'est pas forcément un
// jeudi — un temps fort peut tomber n'importe quel jour, et la carte le rend sans
// distinction. `architecture.md` est corrigé plutôt que le code renommé à tort.

// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 ELLE REND DEUX NATURES DEPUIS LA STORY 9.5 — ET ELLE N'EN FABRIQUE AUCUNE (A9)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// Elle prenait un `AgendaEvent`. Depuis que `tournament.event_id` est facultatif, le prochain
// rendez-vous peut être un **tournoi sans événement**. Le convertir en `AgendaEvent` aurait
// été le geste évident — et il aurait obligé à **inventer** un `type`, un `bar`, une
// `description` : c'est-à-dire à refaire, d'un cran plus bas, la dette **R48** que cette
// story solde. Elle reçoit donc l'union `RendezVous` et **branche** dessus.
//
// 🔴 CE QUE R48 A COÛTÉ, ET QUI SE LIT DANS CE FICHIER : deux lignes de copie FIXE que le
// code assumait en toutes lettres (« le reste de la phrase est une copie FIXE, pas une
// donnée », « copie fixe, JAMAIS data-dépendante »). Ces commentaires étaient **JUSTES** tant
// que tout rendez-vous était un jeudi en bar. Ils sont devenus faux par **ÉLARGISSEMENT DU
// DOMAINE**, pas par erreur — `pieges/patron-eprouve-une-seule-nature.md`.
// ⚠️ Le correctif de la 9.5 n'était PAS de rendre ces phrases saisissables : c'était de
// **dériver de la nature** et de **MASQUER** ce qu'on ne garantit pas.
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 STORY 9.6 — LA COPIE FIXE DEVIENT UN **REPLI**, PARCE QUE LE MODÈLE PORTE MAINTENANT LE FAIT
// ══════════════════════════════════════════════════════════════════════════════════════
//
// Les deux phrases de cette carte — « **Gratuit** · ouvert à tous, même sans matériel » et
// « on reste **tant qu'on veut** » — disent **en dur** exactement ce que `price_text` et
// `ends_at` portent depuis la 9.6. Elles n'étaient sûres que pour une raison, écrite ici même :
// *« le modèle ne porte ni prix ni jauge, et il ne doit pas commencer à en porter par ce
// biais »*. **Il en porte.** Un jeudi jeux payant rendrait donc « Gratuit » — un mensonge à
// l'écran, c'est-à-dire R48 refaite au même endroit, un mois plus tard.
//
// ⇒ Règle **« un seul propriétaire par fait »** (note d'archi §5), et elle tranche seule :
// **la valeur SAISIE l'emporte, la copie fixe est le REPLI quand rien n'est saisi.**
//
// ⚠️ **LA FRONTIÈRE Q6 TIENT, ET IL FAUT VOIR POURQUOI** : ce qui devient saisissable est le
// **tarif**, jamais la phrase. « ouvert à tous, même sans matériel » n'entre dans aucune
// colonne — c'est un fait **distinct** d'un prix, et il **survit** au remplacement du mot
// « Gratuit ». Découper la phrase est le livrable ; la rendre éditable serait le défaut.
// ⚠️ Et `null` ne veut **jamais** dire « gratuit » : sans tarif saisi, on ne déduit rien — on
// retombe sur ce que la NATURE du rendez-vous garantit, et sur rien d'autre.

export interface NextEventCardProps {
  rendezVous: RendezVous;
  /** Cible du CTA, **dérivée par l'appelant** (`destinationDuCta`). La page /agenda n'a pas
   *  de CTA de carte et ne passe donc rien. */
  cta?: { label: string; href: string };
}

/* Icônes des faits. Transcrites de la maquette (l.265-267), sauf la dernière.
   Toutes décoratives : le sens est porté par le texte qui suit, d'où `aria-hidden`
   + `focusable="false"` — même patron que les icônes du SiteFooter. */

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <path d="M9 7v10" strokeDasharray="2 2" />
    </svg>
  );
}

/* 4ᵉ icône : AUCUNE référence dans la maquette (elle n'affiche pas les jeux).
   Composée dans la même grammaire que les trois autres — viewBox 24, contour 2px,
   pas d'aplat sauf les deux boutons. Validée au gate visuel de la Story 3.2. */
function GamepadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <rect x="2.5" y="7.5" width="19" height="9" rx="4.5" />
      <path d="M7 10.5v3M5.5 12h3" strokeLinecap="round" />
      <circle cx="16.5" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="14" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function NextEventCard({ rendezVous, cta }: NextEventCardProps) {
  const bigDate = formatBigDate(rendezVous.startsAt);
  const jeudiJeux = estJeudiJeux(rendezVous);

  // Le lieu, les jeux et le titre se lisent des DEUX natures — chacune sous son nom, sans
  // objet intermédiaire qui prétendrait qu'un tournoi est un événement.
  const evenement = rendezVous.nature === "evenement" ? rendezVous.evenement : null;
  const tournoi = rendezVous.nature === "tournoi" ? rendezVous.tournoi : null;
  const venueName = cleanText(evenement?.venueName ?? tournoi?.venueName ?? null);
  const venueAddress = cleanText(evenement?.venueAddress ?? null);
  const games = cleanText(evenement?.games ?? tournoi?.game ?? null);

  // Story 9.6 — les deux faits neufs, lus des DEUX natures sous leur propre nom.
  // ⚠️ `cleanText` sur le tarif : dernier filet du rendu contre une écriture qui contournerait
  // Zod ET le `CHECK` (`UPDATE` direct, restauration de sauvegarde), `btrim` ne retirant pas
  // U+200B (dette R41). Un tarif fait uniquement d'invisible doit compter comme ABSENT — sans
  // quoi la carte rendrait un fait vide à la place de sa copie fixe, c'est-à-dire une ligne
  // muette là où il y avait une phrase juste.
  const tarif = cleanText(evenement?.priceText ?? tournoi?.priceText ?? null);
  const fin = evenement?.endsAt ?? tournoi?.endsAt ?? null;

  return (
    <div className={styles.next}>
      <div className={styles.bigDate}>
        <b>{bigDate.day}</b>
        <span>{bigDate.month}</span>
      </div>

      <div className={styles.body}>
        {/* <h3> : sous le <h2> d'une tête de section, lui-même sous le <h1> de la
            page. Vrai sur la home (h1 du Hero) comme sur /agenda (h1 de page) —
            aucun saut de niveau, audit Lighthouse `heading-order`. */}
        <h3 className={styles.nextTitle}>{rendezVous.libelle}</h3>

        <div className={styles.facts}>
          {/* Lieu — TROIS branches désormais : le bar du roulement, le lieu libre d'un temps
              fort, ou le lieu propre d'un tournoi. Un nom de bar provisoire (« Bar partenaire
              #2 ») se rend TEL QUEL : la tolérance est réglée côté données par la 3.1, aucune
              branche UI. Si rien ne nomme un lieu, la ligne disparaît plutôt que d'annoncer un
              rendez-vous nulle part (NFR8).
              ⚠️ Pour un tournoi, `tournament_a_un_lieu` garantit qu'il y en a un — la branche
              vide reste écrite quand même : elle protège les événements, et une garde qu'on
              retire « parce qu'elle ne peut plus arriver » est celle qui revient. */}
          {evenement?.bar ? (
            <div>
              <PinIcon />
              <span>
                <strong>{evenement.bar.name}</strong> — {evenement.bar.district},{" "}
                {evenement.bar.city}
              </span>
            </div>
          ) : venueName ? (
            <div>
              <PinIcon />
              <span>
                <strong>{venueName}</strong>
                {venueAddress ? <> — {venueAddress}</> : null}
              </span>
            </div>
          ) : null}

          {/* Heure : formatée en horloge de Paris, jamais avec getHours().
              🔴 LA QUEUE DE PHRASE EST CONDITIONNELLE DEPUIS LA 9.5 (R48 ③). « on reste tant
              qu'on veut » décrit la soirée hebdomadaire, qui n'a pas d'heure de fin annoncée.
              Hors jeudi jeux, l'heure se rendait donc SEULE — une absence, jamais une
              affirmation.
              🔴 ET DEPUIS LA 9.6, LA FIN SAISIE PASSE DEVANT (A3). Les deux disent la même
              chose et ne peuvent pas cohabiter : « 19h00 → 23h00 — on reste tant qu'on veut »
              se contredirait dans la même ligne. La donnée l'emporte, la phrase est le repli.
              ⚠️ `formatPlageHoraire` NOMME LE JOUR quand la fin n'est pas le même — la Game'in
              Reims tient sur deux jours, et « 14h00 → 02h00 » dirait que c'est fini le soir
              même. Le raisonnement complet vit sur la fonction. */}
          <div>
            <ClockIcon />
            <span>
              {formatPlageHoraire(rendezVous.startsAt, fin)}
              {fin === null && jeudiJeux ? <> — on reste tant qu&apos;on veut</> : null}
            </span>
          </div>

          {/* 🔴 TROISIÈME FAIT — ET DEPUIS LA 9.6, LE TARIF SAISI PASSE DEVANT LA COPIE FIXE (A3).
              · **tarif saisi** ⇒ il l'emporte, quelle que soit la nature. Sur un jeudi jeux il
                remplace le seul mot « Gratuit » et « ouvert à tous, même sans matériel »
                SURVIT : ce n'est pas un prix, c'est un autre fait, et il reste vrai ;
              · jeudi jeux SANS tarif ⇒ la copie fixe d'origine, qui reste vraie. Elle n'est
                toujours PAS saisissable (frontière Q6) — c'est le TARIF qui l'est ;
              · tournoi ⇒ l'ÉTAT DES INSCRIPTIONS, seule promesse qu'on puisse tenir, et le
                libellé vient de `LIBELLES_ETAT_INSCRIPTION` — jamais recopié ici (patron
                `lib/libelles-tournoi.ts`, un seul exemplaire pour toutes les surfaces).
                ⚠️ A7 de la Story 9.2 : l'état ne se rend que sur un tournoi À VENIR, parce que
                la base autorise un tournoi passé resté « ouvertes » et que personne ne les
                referme. Ici la garantie est STRUCTURELLE — cette carte ne rend que des
                rendez-vous à venir (`getUpcomingRendezVous`) ;
              · temps fort SANS tarif ⇒ RIEN. On ne déduit toujours aucune gratuité d'une
                absence.
              ⚠️ **DEUX LIGNES ET NON UNE SUR UN TOURNOI PAYANT** : l'état des inscriptions et le
              prix répondent à deux questions différentes (« puis-je m'inscrire » / « combien »),
              et les coudre sur une seule ligne les ferait lire comme une seule condition. Point
              porté au gate visuel. */}
          {jeudiJeux ? (
            <div>
              <TicketIcon />
              <span>
                {tarif ?? "Gratuit"} · ouvert à tous, même sans matériel
              </span>
            </div>
          ) : (
            <>
              {tournoi ? (
                <div>
                  <TicketIcon />
                  <span>
                    Inscriptions :{" "}
                    {LIBELLES_ETAT_INSCRIPTION[tournoi.registrationState].toLowerCase()}
                  </span>
                </div>
              ) : null}
              {tarif ? (
                <div>
                  <TicketIcon />
                  <span>{tarif}</span>
                </div>
              ) : null}
            </>
          )}

          {/* 4ᵉ fait, CONDITIONNEL : ligne masquée plutôt que placeholder vide
              (UX-DR10). Le jeudi `thursday2` du seed, semé SANS `games`, existe
              pour l'éprouver. ⚠️ Côté tournoi, `game` est `notNull` et non vide
              (`tournament_game_valide`) : la ligne y est donc toujours rendue. */}
          {games ? (
            <div>
              <GamepadIcon />
              <span>Jeux : {games}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* CTA optionnel : pas de billetterie en v1 (UX-DR10).
          🔴 SA DESTINATION N'EST PLUS `/agenda` (R48 ③, arbitrage de Brice du 2026-08-14) —
          elle se DÉRIVE des tournois du rendez-vous (`destinationDuCta`), et le CTA disparaît
          quand il n'y en a aucun. Ce composant ne la calcule pas : la page décide, comme elle
          décide déjà de tout ce qui vient de la base (patron AC1 de la 3.2). */}
      {cta ? (
        <div className={styles.act}>
          <Button variant="gold" href={cta.href}>
            {cta.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
