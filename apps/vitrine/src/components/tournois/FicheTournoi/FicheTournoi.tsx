import type { ReactNode } from "react";

import Image from "next/image";
import Link from "next/link";
import { Brush, Button, ExternalIcon, PhotoFrame } from "@repo/ui";

import { BlocInscription } from "@/components/tournois/BlocInscription/BlocInscription";
import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import { formatLongDate, formatPlageHoraire, jourLisible } from "@/lib/date-paris";
import { LIBELLE_NATURE } from "@/lib/schemas/phase";
import { LIBELLE_TABLEAU } from "@/lib/libelles-tournoi";
import type { EtatDuJour } from "@/lib/tournoi/en-cours";
import {
  etatInscriptionEnLigne,
  placesRestantes,
} from "@/lib/tournoi/inscription-en-ligne";
import { pseudoSuggere, type PseudosDuProfil } from "@/lib/tournoi/plateforme";
import { decouperEnJournees, numeroDeJournee } from "@/lib/tournoi/journees";
import { estParTables, type PhaseKind, type PhaseState } from "@/lib/tournoi/structure";
import type { PhaseAvecRencontres } from "@/lib/tournoi/rencontres-publiques";
import { LIBELLES_ETAT_INSCRIPTION } from "@/lib/libelles-tournoi";
import { classerDestination, NEW_TAB_SR } from "@/lib/links";
import { podiumVisible } from "@/lib/podium";
import { cleanText } from "@/lib/text";
import type { FicheTournoiData } from "@/server/db/queries/tournaments";
import editorial from "@/styles/editorial.module.css";
import motion from "@/styles/motion.module.css";
import styles from "./FicheTournoi.module.css";
import { CHEMIN_CONNEXION } from "@/lib/auth/chemins";

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
/**
 * Une phase telle que la fiche la rend. ⚠️ **STRUCTUREL ET MINIMAL, À DESSEIN** : la lecture
 * publique (`getDeroulePublic`) et la lecture d'admin (`getPhasesForTournament`) en rendent
 * chacune un sur-ensemble, si bien que les DEUX consommateurs de ce composant — la page
 * publique et l'aperçu du bénévole — le satisfont sans qu'aucune conversion soit écrite.
 */
export type PhaseAffichee = {
  id: string;
  position: number;
  name: string;
  kind: PhaseKind;
  state: PhaseState;
  playedOn: string | null;
};

/**
 * Une ligne de classement telle que la fiche la rend (Story 14.2).
 *
 * ⚠️ **STRUCTUREL ET MINIMAL, comme `PhaseAffichee`** : `LigneDeClassement` (lib) en est un
 * sur-ensemble, si bien que les deux consommateurs — la page publique et l'aperçu du bénévole —
 * le satisfont sans qu'aucune conversion soit écrite. ⚠️ `stats` ne remonte ici que les deux
 * grandeurs affichées : les trois autres (premières places, moitié haute, moyenne) sont des
 * critères de **départage**, pas des colonnes. Les faire entrer dans ce type ferait croire
 * qu'elles sont publiables, et quelqu'un finirait par les afficher.
 */
export type LigneClassementAffichee = {
  id: string;
  rang: number;
  nom: string;
  abandonne?: boolean;
  stats: { total: number; manchesJouees: number };
};

/**
 * La finale telle que la fiche la rend (Story 10.14).
 *
 * ⚠️ **DÉJÀ RÉSOLUE PAR L'APPELANT** : la règle « 20 points, puis un top 1 » est appliquée dans
 * `lib/tournoi/finale.ts`, pas ici. Un composant ne décide pas d'un vainqueur — il rend ce qu'on
 * lui donne, et les deux consommateurs (page publique et aperçu) lui donnent le même.
 */
export type FinalePubliee = {
  classement: readonly LigneClassementAffichee[];
  vainqueur: { nom: string; total: number } | null;
  /** Ceux qui ont déjà le seuil : il ne leur manque plus qu'un top 1. */
  enPositionDeGagner: readonly { nom: string; total: number }[];
  seuil: number;
};

/**
 * Ce que la fiche sait du tournoi **à l'instant où on la regarde** (Story 14.1).
 *
 * 🔴 L'ÉTAT EST CALCULÉ PAR L'APPELANT, PAS ICI, et ce n'est pas un caprice : ce composant
 * est un Server Component **pur**, et lire l'horloge pendant un rendu est une impureté que
 * `react-hooks/purity` refuse — deux rendus du même arbre pourraient répondre différemment.
 * La page lit l'heure UNE fois et passe le résultat.
 */
export type SuiviPublic = {
  etat: EtatDuJour;
  phases: readonly PhaseAffichee[];
  /**
   * 🔴 DÉJÀ FILTRÉ PAR L'APPELANT (`classementPubliable`), ET CE N'EST PAS UN DÉTAIL. Ce
   * composant a deux consommateurs dont l'un lit un BROUILLON : la règle de nommage ne peut
   * donc pas vivre dans la requête publique. Elle vit dans la lib, les deux pages l'appliquent,
   * et ce qui arrive ici est ce qui se publie — un composant ne décide pas d'un droit.
   */
  classement: readonly LigneClassementAffichee[];
  /**
   * 🔴 `null` = CE TOURNOI N'A PAS DE FINALE, et ce n'est pas la même chose qu'une finale vide.
   * Rendre un objet vide ferait écrire « personne n'a encore gagné » sur un tournoi qui n'a
   * aucune finale : une phrase vraie et hors sujet, donc trompeuse.
   */
  finale?: FinalePubliee | null;
  /**
   * Qui joue contre qui (Story 14.3).
   *
   * ⚠️ **LE TYPE VIENT DE LA LIB, IL N'EST PAS REDÉCLARÉ ICI** — contrairement à `PhaseAffichee`
   * et `LigneClassementAffichee` au-dessus. La raison est la même dans les deux cas : on prend le
   * type **minimal qui décrit ce qui se publie**. Pour les phases et le classement, les lectures
   * rendaient un sur-ensemble d'administration qu'il fallait rétrécir ; ici
   * `regrouperRencontresPubliques` produit **déjà** la forme publique, et la recopier n'ajouterait
   * qu'un endroit de plus à tenir d'accord.
   */
  rencontres?: readonly PhaseAvecRencontres[];
  /**
   * Le jour de Paris, lu **par la page** et jamais ici — lire l'horloge pendant un rendu est
   * l'impureté que `react-hooks/purity` refuse. Il décide quelle journée s'ouvre d'emblée.
   */
  aujourdHui?: string;
};

/**
 * Ce que la fiche doit savoir pour proposer de s'inscrire (Story 12.3).
 *
 * 🔴 **OBLIGATOIRE, PAS OPTIONNELLE — ET C'EST LA GARDE.** Les deux consommateurs la fournissent :
 * la page publique avec le compte connecté, l'aperçu du bénévole en **anonyme**. La rendre
 * facultative laisserait l'aperçu montrer une fiche AMPUTÉE de sa section la plus décisive, alors
 * que son métier est de dire la vérité sur le rendu public.
 *
 * ⚠️ **DES FAITS BRUTS, PAS UNE DÉCISION** : la fiche appelle elle-même `etatInscriptionEnLigne`.
 * Laisser chaque page calculer l'état donnerait deux appelants de la même règle, donc deux
 * occasions d'en oublier un morceau.
 */
export type InscriptionPublique = {
  /** Toutes places confondues, saisie bénévole comprise — voir `EtatInscription`. */
  readonly inscrits: number;
  /** L'inscription du compte connecté sur ce tournoi, `null` s'il n'en a pas. */
  readonly mienne: { readonly displayName: string } | null;
  /** Ses identifiants déclarés, pour pré-remplir le champ. */
  readonly profil: PseudosDuProfil | null;
  /** ⚠️ « Connecté » et « a un profil » sont deux choses : un compte neuf n'a aucune ligne. */
  readonly connecte: boolean;
};

export function FicheTournoi({
  tournoi,
  headingLevel = 1,
  suivi,
  inscription,
}: {
  tournoi: FicheTournoiData;
  headingLevel?: 1 | 2;
  /** Absent = on ne sait rien du déroulé (aperçu d'un tournoi sans phases, par exemple). */
  suivi?: SuiviPublic;
  inscription: InscriptionPublique;
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
  const tarif = cleanText(tournoi.priceText);

  /* ══════════════════════════════════════════════════════════════════════════════════════
     🔴 LES PHASES L'EMPORTENT SUR LE FORMAT ÉDITORIAL — CONSIGNE ÉCRITE EN 9.3, APPLIQUÉE ICI
     ══════════════════════════════════════════════════════════════════════════════════════
     Le bloc de la section « Comment ça se joue » disait, en toutes lettres et depuis la
     Story 9.3 : « le format annoncé est ÉDITORIAL, et les phases FERONT FOI (A23 ③). Le jour
     où elles existeront (Story 10.1), il y aura DEUX descriptions du même format : les phases
     l'emportent, et cette section devra alors DÉRIVER ce qu'elle affiche au lieu de lire deux
     sources. C'est décidé maintenant pour ne pas l'être dans l'urgence. »

     Ce jour est arrivé : les phases existent (10.1 → 10.12) et la 14.1 les publie. On applique
     donc la décision au lieu d'ajouter une seconde description à côté de la première.
     ⚠️ `format_text` **cesse d'être rendu** dès qu'un tournoi porte des phases. Les lots et la
     durée de manche restent : ce ne sont pas des descriptions de format. */
  const journees = suivi ? decouperEnJournees(suivi.phases) : [];
  const derouleReel = journees.length > 0;

  /**
   * 🔴 LE PODIUM NE SE REND QUE SUR UN TOURNOI PASSÉ — RÈGLE QU'AUCUN `CHECK` NE POUVAIT TENIR
   * (AC4 de la 9.1) : une contrainte doit être IMMUABLE, or « passé » se compare à `now()`. Une
   * ligne valide aujourd'hui et invalide demain ferait échouer **toute restauration de
   * sauvegarde**, le jour précis où l'on en a le plus besoin. La règle se tient donc ICI, à
   * l'affichage.
   *
   * ⚠️ **CE QUI EST RENDU VISIBLE SE DÉRIVE DANS `lib/podium.ts`, PARTAGÉ AVEC LA CARTE.** Les
   * deux surfaces en portaient une copie identique, et toutes deux filtraient les trois rangs
   * **indépendamment** — ce qui laissait sortir un podium commençant à la 2ᵉ place. Le
   * raisonnement complet, et le défaut qu'il corrige, vivent sur la fonction.
   */
  const podium = tournoi.estPasse ? podiumVisible(tournoi) : [];

  const classement = suivi?.classement ?? [];
  const finale = suivi?.finale ?? null;

  /* ══════════════════════════════════════════════════════════════════════════════════════
     LES RENCONTRES, GROUPÉES PAR JOURNÉE (Story 14.3)
     ══════════════════════════════════════════════════════════════════════════════════════
     ⚠️ MÊME DÉCOUPAGE QUE LE DÉROULÉ, ET LA MÊME FONCTION : deux découpages du même déroulé
     finiraient par ne plus s'accorder, et la page dirait « Journée 2 » à un endroit et
     « Journée 3 » à l'autre pour les mêmes phases. */
  const journeesDeRencontres = decouperEnJournees(suivi?.rencontres ?? []);

  /**
   * 🔴 QUELLE JOURNÉE S'OUVRE D'EMBLÉE — « celle du jour, SINON LA DERNIÈRE ».
   *
   * La seconde moitié n'est pas un ornement : sans elle, un tournoi **déjà joué** n'aurait
   * aucune journée du jour, donc **tout serait replié** et le visiteur ne verrait qu'une pile
   * de titres. Un écran qui n'affiche rien par défaut a l'air cassé, pas économe.
   */
  const journeeDuJour = journeesDeRencontres.findIndex(
    (journee) => journee.jour === suivi?.aujourdHui,
  );
  const journeeOuverte = journeeDuJour !== -1 ? journeeDuJour : journeesDeRencontres.length - 1;

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * 🔴 « EN DIRECT » SE LIT SUR L'ÉTAT DU JOUR, JAMAIS SUR `estPasse` — DÉFAUT MESURÉ
   * ══════════════════════════════════════════════════════════════════════════════════════
   *
   * Cette dérivation a d'abord été écrite `tournoi.estPasse`. Mesuré sur staging le jour du
   * déploiement de la 14.2 : la fiche de `tft-simulation` affichait **« En ce moment — Manche
   * 4 »** en tête (bandeau 14.1) et **« Résultats »** trois sections plus bas, sur la même page,
   * au même instant. La phrase « rechargez pour la dernière version » disparaissait donc très
   * exactement le jour où elle sert.
   *
   * 🔴 LA CAUSE EST CELLE QUE LA 14.1 AVAIT DÉJÀ TRANCHÉE, et je l'ai refabriquée : `estPasse`
   * dérive de `starts_at ≷ now()`, si bien qu'un tournoi qui commence **ce matin** est « passé »
   * dès l'après-midi — c'est mot pour mot le défaut que la 14.1 a corrigé sur `/tournois`, où un
   * tournoi en train de se jouer s'affichait sous « Déjà joués ».
   *
   * ⇒ Le témoin est `etatDuJour`, **gardé par le calendrier** : il répond « ça se joue
   * aujourd'hui » sans jamais se fier au seul `starts_at`, et c'est déjà lui qui décide du
   * bandeau. Une seule source pour les deux, donc plus de contradiction possible **sur la même
   * page**.
   */
  const enDirect = suivi !== undefined && suivi.etat.nature !== "rien";

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
   *
   * ⚠️ **`cleanText` SUR LE TITRE, ET C'ÉTAIT LE SEUL TEXTE LIBRE DE CETTE FICHE À NE PAS L'AVOIR**
   * (défaut trouvé en revue). `event.title` est `notNull` avec un `CHECK` bâti sur `btrim` — qui
   * **ne retire pas** U+200B (dette R41). Un titre fait uniquement de caractères sans largeur
   * aurait donc rendu l'étiquette « Dans le cadre de » suivie de **rien** : exactement
   * l'étiquette orpheline que le reste de ce fichier s'applique à ne jamais produire.
   * ⇒ Le précédent existait déjà dans le dépôt, sur **ce champ précis** :
   * `server/actions/reseaux.ts` écrit `cleanText(evenement.title) ?? evenement.title`.
   */
  const titreEvenement = tournoi.event?.isPublished ? cleanText(tournoi.event.title) : null;
  const evenement = titreEvenement === null ? null : { ...tournoi.event, title: titreEvenement };

  /**
   * 🔴 LE BOUTON « S'INSCRIRE » EST UN **CONTRAT DÉJÀ ÉCRIT AU BÉNÉVOLE**, mot pour mot.
   * `AIDES_MODE_INSCRIPTION` s'affiche dans le formulaire d'admin **au moment du choix** :
   *   · `mately` → *« l'adresse ci-dessous devient le bouton « S'inscrire » de la page du
   *     tournoi »* ⇒ le libellé est « S'inscrire », et pas un synonyme ;
   *   · `interne` → *« la page du tournoi affiche un formulaire dès que vous passez l'état à
   *     Ouvertes »* ⇒ le formulaire de la 12.3, plus bas dans ce fichier.
   * Une fiche qui ne les tiendrait pas ferait **mentir le back-office**, et le mensonge serait
   * invisible côté admin.
   *
   * ✅ **LA SECONDE PHRASE A CHANGÉ AVEC LA STORY 12.3**, et les deux ont bougé ensemble : elle
   * disait *« aucun bouton, même si une URL traînait en base »*, ce qui était le contrat exact
   * du mode `interne` **tant qu'il n'avait pas de formulaire**. Le contrat n'a pas été trahi, il
   * a été **tenu** — mais un contrat tenu dont on ne réécrit pas l'énoncé devient un faux témoin.
   *
   * ⚠️ **CE QUI N'A PAS BOUGÉ : `registration_url` RESTE IGNORÉE EN MODE `interne`.** Une URL
   * laissée en base par un changement de mode ne doit toujours produire aucun lien — le
   * formulaire la remplace, il ne la rattrape pas.
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

  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * L'INSCRIPTION EN LIGNE (Story 12.3) — TROIS DÉRIVÉS, TOUS PURS
   * ══════════════════════════════════════════════════════════════════════════════════════
   *
   * ⚠️ **AUCUN N'EST CALCULÉ ICI À LA MAIN** : l'ordre des conditions vit dans
   * `etatInscriptionEnLigne` (testé), la borne de places dans `placesRestantes` (testée), le
   * choix du pseudo dans `pseudoSuggere` (testé). Ce composant les **appelle**, il ne les
   * réécrit pas — trois ternaires en JSX auraient été trois règles que rien ne garde.
   * ⚠️ **`estPasse` N'ENTRE PAS DANS LA RÈGLE** : ces dérivés ne sont lus que dans la branche
   * « à venir » du bloc d'action, un tournoi passé y montrant son podium. Le lui repasser
   * donnerait deux propriétaires à la même question.
   */
  const etatEnLigne = etatInscriptionEnLigne({
    registrationState: tournoi.registrationState,
    teamSize: tournoi.teamSize,
    capacity: tournoi.capacity,
    inscrits: inscription.inscrits,
    connecte: inscription.connecte,
    dejaInscrit: inscription.mienne !== null,
  });
  const placesLibres = placesRestantes(tournoi.capacity, inscription.inscrits);
  const pseudoPropose = pseudoSuggere(tournoi.game, inscription.profil);

  return (
    <>
      {/* ① Tête de page. Le `<h1>` est celui du document quand la fiche est servie
          publiquement ; dans l'aperçu, l'écran d'admin lui donne son propre `<h1>` et
          `headingLevel` descend d'un cran — d'où la prop plutôt qu'un niveau en dur. */}
      <section className={editorial.head} aria-labelledby="tournoi-title">
        <Wrap>
          {/* ══════════════════════════════════════════════════════════════════════════
              « ÇA SE JOUE » — AVANT LE TITRE, PARCE QUE C'EST PÉRISSABLE (Story 14.1)
              ══════════════════════════════════════════════════════════════════════════
              🔴 EN OR, PAS EN CORAIL. `--alert` est réservé à ce qui **bloque ou attend une
              réponse** (PR #73) ; un tournoi qui se joue est une bonne nouvelle, pas une
              alerte. L'élargir au reste viderait le token de son sens en une story.
              ⚠️ Le MOT porte l'information : la couleur ne fait que le répéter (AA).
              ⚠️ Deux natures, pas une : « une manche est en cours » est un fait SAISI par
              l'organisateur, « ça se joue aujourd'hui » n'est qu'un fait de calendrier. Les
              confondre annoncerait une manche lancée alors que personne n'a rien lancé. */}
          {suivi && suivi.etat.nature !== "rien" ? (
            <p className={styles.direct}>
              <span aria-hidden="true" className={styles.directPastille} />
              {suivi.etat.nature === "manche_en_cours"
                ? `En ce moment — ${suivi.etat.manche}`
                : "Ça se joue aujourd'hui"}
            </p>
          ) : null}

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
              et `game` sont `notNull` ET non vides (`tournament_game_valide`).
              🔴 CE BLOC EST LE CONTENU D'A23 ①, ET LA STORY 9.6 L'ÉTEND de deux faits — le
              tarif et l'horaire de fin. La note d'architecture §13 est corrigée À LA SOURCE
              plutôt que contredite en silence ici. */}
          <dl className={styles.essentiel}>
            <div className={styles.ligne}>
              <dt className={styles.terme}>Quand</dt>
              {/* `densite="longue"` : la fiche a la place d'écrire la date en toutes lettres
                  quand la fin tombe un autre jour, là où les cartes se contentent de
                  « dim. 22/11 ». C'est le seul écart entre les quatre surfaces, et il a un
                  consommateur réel de chaque côté — pas une prop « au cas où ». */}
              <dd className={styles.valeur}>
                {formatLongDate(tournoi.startsAt)} ·{" "}
                {formatPlageHoraire(tournoi.startsAt, tournoi.endsAt, "longue")}
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

            {/* Le tarif (Story 9.6, dette R55). Absent ⇒ la ligne disparaît ENTIÈREMENT —
                surtout pas « Gratuit » par défaut : `null` veut dire « on ne l'a pas dit »,
                et le déduire serait affirmer un fait qu'on n'a pas (famille R48).
                ⚠️ Placé AVANT « Places » : combien ça coûte et combien il reste de places
                répondent à la même question — « est-ce que je peux venir ? » — et le prix
                est celui des deux qui fait renoncer. */}
            {tarif ? (
              <div className={styles.ligne}>
                <dt className={styles.terme}>Tarif</dt>
                <dd className={styles.valeur}>{tarif}</dd>
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

                {tournoi.registrationMode === "interne" ? (
                  /* ══════════════════════════════════════════════════════════════════════
                     🔴 LE MODE « SUR NOTRE SITE » A ENFIN SON FORMULAIRE (Story 12.3)
                     ══════════════════════════════════════════════════════════════════════
                     Il existait depuis la 9.1 **sans aucune porte**, et l'aide écrite au
                     bénévole le disait : *« le formulaire d'inscription n'existe pas encore »*.
                     Cette phrase a été corrigée dans la même passe — une promesse tenue ailleurs
                     qu'à l'endroit qui la formule reste un mensonge côté back-office.

                     ⚠️ **LE MODE SE TESTE ICI, L'ÉTAT DANS `etatInscriptionEnLigne`** — et le
                     défaut de la 9.3 (juste en dessous) N'EST PAS réintroduit : l'état y est
                     testé **en premier**, si bien qu'un tournoi `interne` + `fermees` dit
                     toujours qu'il est fermé, jamais comment s'y prendre. La règle a un nom et
                     des tests précisément parce que cet ordre s'est déjà perdu une fois. */
                  <div className={styles.enLigne}>
                    {/* Le nombre annoncé vit dans le `<dl>` de l'en-tête ; ce qui RESTE se dit
                        ici, là où il sert à décider. Deux faits différents, deux endroits — et
                        celui-ci n'apparaît que si une capacité est saisie.

                        🔴 **ET JAMAIS À CÔTÉ D'UN REFUS** — défaut trouvé sur STAGING le jour du
                        déploiement, sur un tournoi réel : `tournoi-tft` rendait « Il reste 28
                        places » suivi de « les inscriptions ne sont pas encore ouvertes ». La
                        phrase était **vraie** et se lisait comme une **invitation**, contredite
                        par la ligne suivante — c'est le défaut de la 9.3 dans une autre forme,
                        et la leçon de la 10.14 : *une phrase vraie qui se lit fausse vaut une
                        phrase fausse*.
                        ⇒ Le compte ne paraît que là où il sert à **décider** ou à **se situer** :
                        quand on peut s'inscrire, qu'on doit se connecter pour le faire, ou qu'on
                        est déjà inscrit. Sur un refus, la raison porte déjà tout ce qu'il y a à
                        dire — « Toutes les places sont prises » énonce le compte à sa manière.
                        ⚠️ Aucun test neuf : c'est une dérivation d'affichage d'une ligne, tranchée
                        par l'écran réel. Un test l'aurait figée **en passant** dans sa version
                        fautive (même raisonnement qu'en PR #88). */}
                    {placesLibres !== null && etatEnLigne.cas !== "indisponible" ? (
                      <p className={styles.places}>
                        {placesLibres === 0
                          ? "Plus aucune place disponible."
                          : `Il reste ${placesLibres} place${placesLibres > 1 ? "s" : ""}.`}
                      </p>
                    ) : null}

                    {etatEnLigne.cas === "formulaire" || etatEnLigne.cas === "inscrit" ? (
                      <>
                        <BlocInscription
                          tournoiId={tournoi.id}
                          inscritSous={inscription.mienne?.displayName ?? null}
                          pseudoPropose={pseudoPropose}
                        />
                        {/* ⚠️ DIT SEULEMENT SI UN TARIF EST ANNONCÉ. Sans tarif saisi, écrire
                            « le règlement se fait sur place » inventerait un montant — et son
                            absence ne veut pas dire « gratuit » (famille R48). */}
                        {tarif ? (
                          <p className={styles.etatAide}>
                            Le règlement se fait sur place, le jour du tournoi.
                          </p>
                        ) : null}
                      </>
                    ) : etatEnLigne.cas === "connexion" ? (
                      <>
                        {/* ⚠️ UN LIEN, PAS UN BOUTON DÉSACTIVÉ — patron « J'y serai » (12.2) :
                            un anonyme voit le geste et il mène à la connexion. Le cacher ne le
                            montrerait qu'à ceux qui n'en ont plus besoin.
                            ⚠️ Le `next` est borné par `lib/auth/retour.ts` : sans lui, on se
                            connecterait pour s'inscrire et l'on atterrirait sur le back-office. */}
                        <Button
                          className={styles.ctaInscription}
                          href={`${CHEMIN_CONNEXION}?next=${encodeURIComponent(`/tournois/${tournoi.slug}`)}`}
                        >
                          Je m&rsquo;inscris
                        </Button>
                        <p className={styles.etatAide}>
                          Un compte est nécessaire pour retrouver et annuler votre inscription.
                        </p>
                      </>
                    ) : (
                      /* Une indisponibilité DIT sa raison — jamais un bouton éteint (principe ①
                         de l'Epic 13 : une règle se dit, elle ne se grise pas). */
                      <p className={styles.etatAide}>{etatEnLigne.raison}</p>
                    )}
                  </div>
                ) : inscriptionOuverte && urlInscription ? (
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
                     l'apparence d'un CTA sans destination : le projet l'a prévu pour les cas
                     où le CTA doit RESTER visible (Story 5.5), ce qui n'est pas le nôtre — il
                     n'y a rien à promettre. La phrase ci-dessous DIT pourquoi, ce qu'un bouton
                     grisé ne fait pas.

                     🔴 ELLE SE DÉRIVE DE L'ÉTAT **D'ABORD**, DU MODE ENSUITE — ET L'ORDRE
                     INVERSE ÉTAIT UN DÉFAUT RÉEL, TROUVÉ EN REVUE. La première version testait
                     `completes`, puis le **mode** : un tournoi `interne` dont les inscriptions
                     étaient `fermees` rendait donc « Inscriptions : Fermées » suivi de « Les
                     inscriptions se prennent directement avec nous » — une invitation à
                     s'inscrire sous une étiquette qui dit l'inverse.
                     ⚠️ Et ce n'est pas un cas tordu : `fermees` est la valeur **par défaut**
                     (`schema.ts` : *« rien ne s'ouvre par accident »*), et le mode `interne`
                     n'offre aucun bouton — donc un bénévole qui choisit « Sur notre site » et
                     ne touche jamais l'état tombe **exactement** dans ce cas.
                     ⇒ `ouvertes` est la SEULE branche où l'on dit comment s'y prendre ; les
                     deux autres états disent ce qui est, et rien de plus.
                     ⚠️ Le cas « `ouvertes` sans porte » (mode `mately` dont l'URL n'est pas
                     exploitable) ne dit PAS « ce n'est pas ouvert » — ce serait contredire
                     l'étiquette juste au-dessus. Il dit la seule chose vraie : on ne peut pas
                     s'inscrire **d'ici**.

                     🔴 **CE TERNAIRE NE PARLE PLUS QUE DU MODE `mately` DEPUIS LA 12.3**, et sa
                     branche `interne` a été RETIRÉE parce qu'elle est devenue **inatteignable** :
                     le mode `interne` est capté plus haut, avec son formulaire. La laisser aurait
                     été du code mort porteur d'une phrase FAUSSE (« les inscriptions se prennent
                     directement avec nous »), c'est-à-dire le pire des deux — ni exécutée, ni
                     repérable, et prête à ressortir au premier remaniement du ternaire. */
                  <p className={styles.etatAide}>
                    {tournoi.registrationState === "completes"
                      ? "Toutes les places annoncées sont prises."
                      : tournoi.registrationState === "fermees"
                        ? "Les inscriptions ne sont pas ouvertes pour le moment."
                        : "Les inscriptions se prennent auprès de nous : écrivez-nous et on vous indique la marche à suivre."}
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
      {derouleReel || format || lots || tournoi.matchDurationMinutes !== null ? (
        <section className={editorial.section} aria-labelledby="format-title">
          <Wrap>
            <SectionHead
              headingLevel={niveauSection}
              eyebrow="Le déroulé"
              titleId="format-title"
              title="Comment ça se joue"
            />

            <div className={motion.reveal}>
              {/* ══════════════════════════════════════════════════════════════════════
                  LE DÉROULÉ RÉEL — LES PHASES, GROUPÉES PAR JOURNÉE (Story 14.1)
                  ══════════════════════════════════════════════════════════════════════
                  🔴 IL PASSE AVANT LA LISTE `<dl>`, ET IL REMPLACE LE FORMAT ÉDITORIAL
                  quand il existe : c'est la décision écrite en 9.3 et rappelée en tête de
                  ce composant. Deux descriptions du même format, présentées à égalité,
                  finissent par se contredire — et c'est le public qui lit la contradiction.

                  ⚠️ `decouperEnJournees` groupe des suites CONSÉCUTIVES de même date, jamais
                  un `group by` : un déroulé samedi/dimanche/samedi se lirait « 1, 3 » puis
                  « 2 » pendant que les numéros diraient l'inverse (acquis 13.1). Un tournoi
                  d'un seul jour n'a AUCUN groupement — `playedOn` est nullable. */}
              {derouleReel ? (
                <ol className={styles.deroule}>
                  {journees.map((journee, rang) => {
                    const numero = numeroDeJournee(journees, rang);
                    return (
                      <li className={styles.journee} key={journee.jour ?? `sans-date-${rang}`}>
                        {journee.jour !== null ? (
                          <p className={styles.journeeTitre}>
                            {numero !== null ? `Journée ${numero} — ` : ""}
                            {jourLisible(journee.jour)}
                          </p>
                        ) : null}

                        <ol className={styles.phases}>
                          {journee.phases.map(({ phase }) => (
                            <li className={styles.phase} key={phase.id}>
                              <span className={styles.phaseNom}>{phase.name}</span>
                              <span className={styles.phaseNature}>
                                {LIBELLE_NATURE[phase.kind]}
                              </span>
                              {/* ⚠️ L'ÉTAT S'ÉCRIT, il ne se code pas en couleur seule (AA).
                                  « planifiée » ne s'affiche pas : c'est l'état par défaut de
                                  toute phase, le dire sur chaque ligne serait du bruit. */}
                              {phase.state !== "planifiee" ? (
                                <span
                                  className={
                                    phase.state === "en_cours"
                                      ? styles.phaseEtatEnCours
                                      : styles.phaseEtat
                                  }
                                >
                                  {phase.state === "en_cours" ? "en cours" : "terminée"}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      </li>
                    );
                  })}
                </ol>
              ) : null}

              <dl className={styles.format}>
                {/* 🔴 LE FORMAT ÉDITORIAL NE SE REND QUE FAUTE DE PHASES (décision 9.3). */}
                {!derouleReel && format ? (
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

      {/* ══════════════════════════════════════════════════════════════════════════
          LE CLASSEMENT (Story 14.2) — LA PREMIÈRE SURFACE DU SITE QUI NOMME QUELQU'UN
          ══════════════════════════════════════════════════════════════════════════
          🔴 IL VIENT APRÈS LE PODIUM ET NE LE REMPLACE JAMAIS. Ce sont deux questions, pas
          deux versions d'une seule : le podium dit QUI A GAGNÉ, le classement dit OÙ CHACUN
          A FINI. ⚠️ Et faire dériver le premier du second serait faux — sur un tableau, le
          vainqueur sort de l'ARBRE, pas des points : le calcul ne sait pas toujours répondre.
          C'est la limite exacte de la décision 9.3, qu'on n'étend donc pas jusqu'ici.

          ⚠️ LA SECTION N'EXISTE PAS QUAND AUCUNE LIGNE N'EST PUBLIABLE, et c'est ce silence
          qui couvre les deux cas muets d'un seul geste : un tournoi joué au SCORE (bracket,
          poule) ne produit aucun rang, et une manche générée mais pas encore dépouillée n'en
          produit pas encore. Écrire « aucun résultat » ici expliquerait au public une
          mécanique interne — et la phrase deviendrait fausse sans que rien ne le dise. */}
      {/* ══════════════════════════════════════════════════════════════════════════
          LE CLASSEMENT (14.2) — ET SES DEUX ESPACES DE POINTS (10.14)
          ══════════════════════════════════════════════════════════════════════════
          🔴 DÈS QU'UN TOURNOI PORTE UNE FINALE, IL A DEUX CLASSEMENTS ET PAS UN : on
          repart de zéro en finale. Les fondre en un seul rendrait le seuil de victoire
          (20 points) atteignable dès les qualifications, donc la règle absurde.
          ⚠️ LA FINALE PASSE EN PREMIER : c'est elle qui désigne le vainqueur. Les
          qualifications ne sont plus, à ce stade, qu'un rappel de comment on y est entré.
          ⚠️ Sur un tournoi SANS finale — tous ceux d'aujourd'hui —, un seul tableau, et
          exactement le rendu de la 14.2. */}
      {classement.length > 0 || (finale?.classement.length ?? 0) > 0 ? (
        <section className={editorial.section} aria-labelledby="classement-title">
          <Wrap>
            <SectionHead
              headingLevel={niveauSection}
              eyebrow={enDirect ? "En direct" : "Résultats"}
              titleId="classement-title"
              title="Le classement"
            />

            <div className={motion.reveal}>
              {finale && finale.classement.length > 0 ? (
                <div className={styles.classementBloc}>
                  {/* 🔴 LA RÈGLE SE DIT, TOUJOURS — sinon le public lit un tableau où le
                      premier « aurait dû » gagner et croit à une erreur. C'est le principe ①
                      de l'Epic 13 (« une règle se dit, ne se grise pas ») appliqué à un
                      classement, et la parade au défaut de la 10.13 : une règle juste que
                      personne ne voit ne sert à rien. */}
                  {/* ⚠️ LES ESPACES SONT EXPLICITES (`{" "}`) DANS CES TROIS PHRASES, ET C'EST
                      UN CORRECTIF, PAS UN STYLE. Mesuré dans le HTML rendu sur staging : la
                      phrase sortait « top&nbsp;1pour l'emporter » — l'espace écrit après
                      `</strong>` avait disparu. ⚠️ Je n'en fais PAS une loi générale : le même
                      motif existe ailleurs dans ce fichier et rend correctement, donc la cause
                      exacte n'est pas établie. Ce qui est établi, c'est que l'espace explicite
                      la rend fiable — et qu'aucune porte ne voit ce défaut : ni lint, ni
                      typecheck, ni test. Seul l'écran rendu l'attrape. */}
                  {finale.vainqueur ? (
                    <p className={styles.classementVainqueur}>
                      <strong>{finale.vainqueur.nom} remporte le tournoi</strong>{" "}
                      — les {finale.seuil} points atteints, puis un top&nbsp;1.
                    </p>
                  ) : finale.enPositionDeGagner.length > 0 ? (
                    <p className={styles.classementRegle}>
                      {/* 🔴 LE TOTAL DE CHACUN EST ÉCRIT, ET C'EST UN CORRECTIF : « X a les 20
                          points » se lit comme SON score alors que c'est le SEUIL — ClaraByte en
                          avait 23. Une phrase juste qu'on lit de travers vaut une phrase fausse. */}
                      <strong>
                        {finale.enPositionDeGagner
                          .map((f) => `${f.nom} (${f.total} pts)`)
                          .join(", ")}
                      </strong>{" "}
                      {finale.enPositionDeGagner.length > 1 ? "ont" : "a"} atteint les{" "}
                      {finale.seuil} points&nbsp;: il{" "}
                      {finale.enPositionDeGagner.length > 1 ? "leur" : "lui"} faut maintenant un{" "}
                      <strong>top&nbsp;1</strong>{" "}
                      pour l&rsquo;emporter.
                    </p>
                  ) : (
                    <p className={styles.classementRegle}>
                      Pour l&rsquo;emporter&nbsp;: atteindre <strong>{finale.seuil} points</strong>,
                      puis faire un <strong>top&nbsp;1</strong>{" "}
                      sur une manche suivante.
                    </p>
                  )}

                  <TableauDeClassement
                    lignes={finale.classement}
                    legende={
                      <>
                        <strong>La finale</strong> — les points y repartent de zéro.
                      </>
                    }
                  />
                </div>
              ) : null}

              {classement.length > 0 ? (
                <div className={styles.classementBloc}>
                  <TableauDeClassement
                    lignes={classement}
                    legende={
                      finale ? (
                        <>
                          <strong>Les qualifications</strong> — le cumul de toutes les manches
                          qui ont mené à la finale.
                        </>
                      ) : (
                        <>
                          Classement aux points, cumulé sur <strong>tout le tournoi</strong>.
                        </>
                      )
                    }
                  />
                </div>
              ) : null}

              {/* 🔴 « DIRECT » VEUT DIRE FRAIS AU RECHARGEMENT, ET ON L'ÉCRIT (arbitrage de
                  l'Epic 14). La page est `force-dynamic` : ces tableaux sont recalculés à
                  chaque affichage, ils ne sont jamais figés — mais elle ne se met PAS à jour
                  toute seule. Promettre le second en livrant le premier ferait rester
                  quelqu'un devant un écran qui ne bougera pas.
                  ⚠️ ELLE NE SE REND QUE SI ÇA SE JOUE AUJOURD'HUI — sur un tournoi qui ne se
                  joue pas, « rechargez » n'a plus d'objet et inventerait une attente. Le témoin
                  est `etatDuJour` et **jamais `estPasse`** : celui-ci dérive de `starts_at ≷
                  now()`, donc un tournoi commencé ce matin est « passé » l'après-midi même. Le
                  raisonnement complet, et le défaut mesuré, sont sur `enDirect` plus haut. */}
              {enDirect ? (
                <p className={styles.classementFraicheur} role="note">
                  Recalculé à chaque affichage&nbsp;: rechargez la page pour la dernière
                  version. Elle ne se met pas à jour toute seule.
                </p>
              ) : null}
            </div>
          </Wrap>
        </section>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════════
          LES RENCONTRES (Story 14.3) — QUI JOUE CONTRE QUI, ET CE QUI RESTE
          ═══════════════════════════════════════════════════════════════════════
          🔴 UNE SEULE PRÉSENTATION POUR TOUS LES FORMATS : des groupes (tableau, tour) et,
          dans chacun, les rencontres avec leurs places. Ce n'est pas un pis-aller faute
          d'arbre — c'est la présentation avec laquelle un VRAI tournoi a été joué de bout en
          bout au back-office le 2026-08-15, et la seule qui couvre AUSSI les formats par
          tables, qui n'ont pas d'arbre du tout. Un arbre resterait possible plus tard, sur
          des données déjà publiées.

          🔴 LE REPLI EST UN `<details>` NATIF, DONC ZÉRO JAVASCRIPT : la fiche reste
          entièrement RSC, et le pliage marche au clavier, au lecteur d'écran et sans script.
          Un composant client aurait été le premier de cette page, pour une fonction que le
          navigateur rend déjà. */}
      {journeesDeRencontres.length > 0 ? (
        <section className={editorial.section} aria-labelledby="rencontres-title">
          <Wrap>
            <SectionHead
              headingLevel={niveauSection}
              eyebrow={enDirect ? "En direct" : "Le détail"}
              titleId="rencontres-title"
              title="Les rencontres"
            />

            <div className={motion.reveal}>
              {journeesDeRencontres.map((journee, rang) => {
                const numero = numeroDeJournee(journeesDeRencontres, rang);
                const phases = journee.phases.map(({ phase }) => (
                  <PhaseDeRencontres key={phase.id} phase={phase} />
                ));

                // ⚠️ UN TOURNOI D'UN SEUL JOUR N'A AUCUNE JOURNÉE À NOMMER (`playedOn` est
                // nullable) : on ne l'enferme pas dans un repli au titre vide.
                if (journee.jour === null) {
                  return <div key={`sans-date-${rang}`}>{phases}</div>;
                }

                return (
                  <details
                    className={styles.journeeRepli}
                    key={journee.jour}
                    open={rang === journeeOuverte}
                  >
                    <summary className={styles.journeeResume}>
                      {numero !== null ? `Journée ${numero} — ` : ""}
                      {jourLisible(journee.jour)}
                    </summary>
                    {phases}
                  </details>
                );
              })}
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

/**
 * Un tableau de classement.
 *
 * 🔴 **EXTRAIT PARCE QU'IL Y EN A DEUX DEPUIS LA 10.14** — les qualifications et la finale. Deux
 * copies du même tableau divergeraient au premier ajustement, et c'est la fiche publique qui
 * afficherait deux présentations du même objet.
 *
 * ⚠️ **LOCAL À CE FICHIER, ET PAS UNE PRIMITIVE DE `@repo/ui`** : il n'a que ces deux
 * consommateurs, tous deux ici. Le sortir maintenant serait construire pour un besoin futur —
 * et c'est aussi la leçon de la 6.7, où un composant partagé a cassé au premier consommateur
 * d'une autre nature.
 *
 * ⚠️ **`<caption>` PORTE LE LIBELLÉ, PAS UN TITRE AU-DESSUS** : c'est le **nom accessible** du
 * tableau, donc un lecteur d'écran l'annonce en y entrant — là où un `<p>` voisin n'aurait aucun
 * lien avec lui. Et ça évite un niveau de titre de plus, que `headingLevel` devrait alors suivre.
 */
function TableauDeClassement({
  lignes,
  legende,
}: {
  lignes: readonly LigneClassementAffichee[];
  legende: ReactNode;
}) {
  return (
    <div className={styles.classementCadre}>
      <table className={styles.classement}>
        <caption className={styles.classementLegende}>{legende}</caption>
        <thead>
          <tr>
            <th scope="col">Rang</th>
            <th scope="col">Engagé</th>
            <th className={styles.classementChiffre} scope="col">
              Points
            </th>
            <th className={styles.classementChiffre} scope="col">
              Manches
            </th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => (
            <tr key={ligne.id}>
              <td className={styles.classementRang}>{ligne.rang}</td>
              <td className={styles.classementNom}>
                {ligne.nom}
                {/* 🔴 UN DROP GARDE SES POINTS ET SON RANG (R60) — et l'écran le DIT, sinon on
                    croirait à une erreur de saisie. Même mot que le back-office : « drop », pas
                    « a abandonné ». */}
                {ligne.abandonne ? <span className={styles.classementDrop}> — drop</span> : null}
              </td>
              <td className={styles.classementChiffre}>{ligne.stats.total}</td>
              <td className={styles.classementChiffre}>{ligne.stats.manchesJouees}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Le résultat d'une place, tel qu'on l'écrit. */
function resultatDePlace(place: { rank: number | null; score: number | null }) {
  // ⚠️ LE RANG PASSE AVANT LE SCORE, jamais les deux : une table se dépouille au RANG, un
  // tableau au SCORE (leçon 10.8, où un bracket joué au score ne produisait aucun classement).
  // Les afficher tous les deux inventerait une double lecture d'un résultat unique.
  if (place.rank !== null) return place.rank === 1 ? "1ᵉʳ" : `${place.rank}ᵉ`;
  if (place.score !== null) return String(place.score);
  return null;
}

/**
 * Une phase et ses rencontres, groupées par tableau puis par tour.
 *
 * ⚠️ **LOCAL À CE FICHIER**, comme `TableauDeClassement` : un seul consommateur, et le sortir
 * maintenant serait construire pour un besoin futur.
 * ⚠️ **AUCUN TITRE `<h*>` ICI** : la section porte déjà le sien, et un niveau de plus devrait
 * suivre `headingLevel` sur les deux consommateurs de la fiche. Les noms de phase et de tour
 * sont donc des paragraphes stylés — ils nomment, ils ne structurent pas le document.
 */
function PhaseDeRencontres({ phase }: { phase: PhaseAvecRencontres }) {
  const parTables = estParTables(phase.kind);

  return (
    <div className={styles.phaseBloc}>
      <p className={styles.phaseBlocTitre}>
        {phase.name}
        <span className={styles.phaseBlocNature}>{LIBELLE_NATURE[phase.kind]}</span>
      </p>

      {phase.groupes.map((groupe) => {
        /* ⚠️ `principal` A UN LIBELLÉ VIDE À DESSEIN : une élimination simple n'a qu'un
           tableau, le nommer inventerait une distinction. Et une phase par TABLES n'a pas de
           tour du tout — son groupe unique ne se nomme donc pas non plus. */
        const titre = parTables
          ? null
          : [LIBELLE_TABLEAU[groupe.bracket], `Tour ${groupe.round}`].filter(Boolean).join(" — ");

        return (
          <div className={styles.groupe} key={groupe.clef}>
            {titre ? <p className={styles.groupeTitre}>{titre}</p> : null}

            <ol className={styles.rencontres}>
              {groupe.rencontres.map((rencontre) => (
                <li className={styles.rencontre} key={rencontre.id}>
                  <p className={styles.rencontreTitre}>
                    {parTables ? `Table ${rencontre.position}` : `Rencontre ${rencontre.position}`}
                    {/* ⚠️ L'ÉTAT S'ÉCRIT, il ne se code pas en couleur seule (AA). Et le témoin
                        est le RÉSULTAT, jamais l'état déclaré de la rencontre : doctrine tenue
                        partout ailleurs sur ce moteur. */}
                    {!rencontre.depouillee ? (
                      <span className={styles.rencontreAttente}>à jouer</span>
                    ) : null}
                  </p>

                  <ol className={styles.places}>
                    {rencontre.places.map((place) => {
                      const resultat = resultatDePlace(place);
                      return (
                        <li className={styles.place} key={place.position}>
                          {/* ⚠️ `—` QUAND LE NOM EST TU : la place existe, elle est simplement
                              sans nom publiable (un drop dont la table n'est pas jouée, ou une
                              place vide). Masquer la LIGNE ferait croire à une table plus
                              petite qu'elle n'est, donc à un barème de points différent. */}
                          <span className={styles.placeNom}>{place.nom ?? "—"}</span>
                          {resultat ? (
                            <span className={styles.placeResultat}>{resultat}</span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
