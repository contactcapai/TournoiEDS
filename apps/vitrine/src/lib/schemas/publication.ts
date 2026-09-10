/**
 * Contrat du message envoyé à n8n pour annoncer un événement (FR23, AR-API2 — Story 6.7).
 *
 * Vit sous `src/lib/` et non `src/server/` comme les six autres schémas partagés du projet
 * (`event`, `partner`, `solicitation`, `workshop`, `member`, `site-setting`) — mais pour une
 * raison **différente** de la leur, et il faut la dire : les six autres sont partagés entre un
 * formulaire CLIENT et une Server Action. Celui-ci n'a **aucun consommateur client**. Il est
 * ici parce que sa deuxième lectrice ÉTAIT la porte `gate:reseaux` — supprimée au dégraissage
 * du 2026-08-15, avec seize autres. ⚠️ Il n'y reste donc plus qu'un consommateur, et le motif
 * qui justifiait cet emplacement a disparu avec l'instrument ; le fichier reste ici parce qu'il
 * ne porte aucun secret et que le déplacer serait du remue-ménage, pas parce qu'une porte le
 * lit. Depuis la 7.6 il est aussi lu par `lib/message-reseaux.ts`, qui n'est pas serveur.
 *
 * ⚠️ Le mettre sous `server/` avec `import "server-only"` empêcherait la porte de l'importer
 * sans le drapeau `--conditions=react-server`, et surtout ferait croire qu'il protège quelque
 * chose : il ne contient que des règles de forme, aucun secret.
 */
import { z } from "zod";

import { X_MAX } from "../message-reseaux";

import {
  BAR_ADRESSE_MAX,
  BAR_QUARTIER_MAX,
  BAR_VILLE_MAX,
  DESCRIPTION_MAX,
  EVENT_TYPES,
  JEUX_MAX,
  LIEU_ADRESSE_MAX,
  LIEU_NOM_MAX,
  TITRE_MAX,
} from "./event";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LA VERSION DU CONTRAT EST DANS LE MESSAGE — ET CE N'EST PAS DE LA CÉRÉMONIE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `00 référence/pieges/webhook-n8n.md` documente le mode de défaillance dominant de ce stack,
 * vu dans **six projets CapAI** : *« l'import n8n ne préserve pas tous les paramètres »* — des
 * champs d'entrée sont **dropés en silence** à l'import, et l'orchestrateur part en 400 sur un
 * champ vide. Le workflow qui reçoit ce message vit **hors de ce dépôt**, dans une instance
 * partagée avec douze autres projets : il peut être ré-importé, dupliqué ou restauré sans que
 * personne ici ne le sache.
 *
 * Un numéro de version explicite est ce qui transforme « le workflow reçoit un champ qu'il ne
 * connaît pas et l'ignore » en « le workflow refuse et le dit ». ⚠️ **À incrémenter dès qu'un
 * champ change de sens** — pas quand on en ajoute un facultatif.
 */
export const PAYLOAD_VERSION = 1;

/** Qui parle. Constante : ce webhook n'a qu'un seul appelant légitime. */
export const PAYLOAD_SOURCE = "vitrine-eds";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LA DATE PORTE L'OFFSET DE PARIS, ET UN `Z` EST **REFUSÉ**
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `2026-08-13T19:00:00+02:00` ✅ · `2026-08-13T17:00:00.000Z` ❌
 *
 * Les deux désignent le **même instant**. Le second n'est donc pas *faux* — il a simplement
 * perdu l'heure que les gens liront sur l'affiche, et un workflow qui compose « rendez-vous à
 * 17h00 » à partir de lui publierait une annonce fausse de deux heures **sur un réseau
 * social**, là où plus aucune porte de ce dépôt ne peut la voir.
 *
 * 🔴 **ON REFUSE DONC LE `Z` EXPLICITEMENT, alors qu'il est un offset ISO parfaitement
 * valide.** C'est le seul témoin qui attrape le geste réflexe `instant.toISOString()`, et
 * c'est un geste que six autres fichiers de ce dépôt font légitimement. La seule construction
 * autorisée est `toParisIso()` (`lib/date-paris.ts`), qui est aussi le seul endroit du projet
 * habilité à lire un offset.
 *
 * ⚠️ **ET LE PIÈGE EST INVERSÉ CHEZ LE DESTINATAIRE** : `pieges/webhook-n8n.md` a payé, sur
 * *13 Leguillette*, un `z.string().datetime()` côté n8n qui **rejetait** un offset ISO et
 * n'acceptait que le `Z`. Les deux erreurs viennent de la même croyance — qu'« ISO » désigne
 * une seule forme. D'où une règle **écrite ici**, exercée par la porte, et non un accord tacite.
 */
const ISO_AVEC_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

/** Vrai si la valeur est un instant ISO portant un offset explicite (jamais un `Z`). */
export function estIsoAvecOffset(valeur: string): boolean {
  return ISO_AVEC_OFFSET.test(valeur);
}

/**
 * URL absolue en `http(s)`.
 *
 * ⚠️ Volontairement **pas** la même règle que `urlHttpOptionnelle` (`./texte.ts`), et ce n'est
 * pas un oubli d'extraction : celle-là garde une valeur **saisie par un bénévole** et destinée
 * à devenir un `href` — d'où sa garde de casse et de double slash, liée à `isExternalUrl()`.
 * Celle-ci garde une valeur **construite par le code**, qui ne devient jamais un `href` de ce
 * site. Fusionner les deux ferait qu'un ajustement d'accessibilité du rendu public changerait
 * le contrat d'une intégration sortante.
 *
 * ⚠️ `http://` est **accepté** ici : en développement le lien vaut `http://localhost:3000/…`
 * (`NEXT_PUBLIC_SITE_URL`). Le refuser rendrait le verify d'entrée impayable en local, ce qui
 * est très exactement ce qui a produit la dette R32. Le durcissement `https` porte sur l'**URL
 * DU WEBHOOK** (`server/integrations/n8n.ts`), qui est ce qui transporte le jeton.
 */
const lienAbsolu = z
  .string()
  .refine((valeur) => /^https?:\/\//.test(valeur) && z.url().safeParse(valeur).success, {
    message: "Le lien de l'événement doit être une URL absolue en http(s).",
  });

/**
 * Le message envoyé au webhook n8n.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QU'IL NE CONTIENT PAS EST UNE GARDE — NE PAS LE « COMPLÉTER »
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * **Aucune donnée personnelle.** Ni e-mail, ni nom de bénévole, ni contenu de sollicitation, ni
 * identifiant de session, ni adresse IP. Ce message **quitte le périmètre du site** vers une
 * instance tierce partagée entre douze projets, dont les journaux d'exécution conservent les
 * corps reçus. Les deux tables du projet qui portent de la donnée personnelle (`solicitation`,
 * `member`) n'ont donc **rien à faire ici**. 🔴 **ET PLUS RIEN NE LE MESURE** : la garde ③ de
 * `gate:reseaux` le vérifiait sur le corps réellement émis, la porte a été supprimée le
 * 2026-08-15. Ce commentaire est désormais la SEULE chose qui tient la règle — il disait
 * précisément de ne pas s'y fier. Y ajouter un champ personnel ne ferait rougir personne.
 *
 * ⚠️ **Aucun champ de texte composé non plus** (« le post », « la légende »). La composition du
 * message publié vit **dans n8n**, qui est l'outil dont c'est le métier et le seul endroit où
 * elle peut être ajustée sans redéploiement. Ce que le site envoie, ce sont des **faits**.
 */
/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LES TEXTES SONT COMPOSÉS ICI ET ENVOYÉS PRÊTS À PUBLIER (Story 7.6)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Le schéma de base de données disait l'inverse — *« la composition du message vit dans n8n »*.
 * L'arbitrage a changé en écrivant la story : le workflow vit dans une instance partagée à
 * douze projets, ré-importable et restaurable sans que personne ici ne le sache, et un texte
 * qui y vivrait ne serait ni testé ni relu. `lib/message-reseaux.ts` le compose, sept tests le
 * tiennent — dont l'heure de Paris, qu'un premier brouillon publiait en UTC (« 16h00 » pour
 * une soirée à 18h00).
 *
 * ⚠️ **`version` RESTE À 1, ET C'EST DÉLIBÉRÉ.** Le champ est ADDITIF : le validateur du
 * workflow déjà en service exige `version === 1` strictement et ignore ce qu'il ne connaît
 * pas. Passer à 2 ferait refuser toute annonce entre le déploiement du site et le ré-import du
 * workflow — une panne fabriquée par un numéro. La règle en tête de ce fichier le dit déjà :
 * on incrémente quand un champ CHANGE DE SENS, pas quand on en ajoute un.
 *
 * ⚠️ Les bornes ne sont pas décoratives : **280 pour X est un REFUS d'API**, les autres sont
 * les plafonds documentés des plateformes. Elles doublent la garde de `composerMessages`.
 */
export const messagesSchema = z.object({
  discord: z.string().min(1).max(2000),
  x: z.string().min(1).max(X_MAX),
  facebook: z.string().min(1).max(5000),
  instagram: z.string().min(1).max(2200),
});

export const publicationPayloadSchema = z.object({
  version: z.literal(PAYLOAD_VERSION),
  source: z.literal(PAYLOAD_SOURCE),
  /**
   * 🔴 **NULLABLE DEPUIS L'ÉCRAN DE COMPOSITION** : un post libre (une photo, une nouvelle,
   * un remerciement) ne se rattache à aucune ligne d'agenda.
   *
   * ⚠️ **LE WORKFLOW EN SERVICE REFUSERA CE CAS TANT QU'IL N'EST PAS RÉ-IMPORTÉ** — son
   * validateur exige les cinq champs. Ce n'est pas une régression : les annonces d'événement
   * passent exactement comme avant, et un post libre échoue en le DISANT. Le JSON à jour est
   * dans `n8n/publication-reseaux.json`.
   */
  evenement: z
    .object({
    id: z.uuid(),
    /**
     * Bornes reprises de `./event.ts`, **importées et jamais recopiées**. Les recopier
     * fabriquerait un second jeu de bornes qui divergerait au premier ajustement — c'est R37,
     * soldée le 2026-08-05, qu'on referait le surlendemain.
     */
    titre: z.string().min(1).max(TITRE_MAX),
    type: z.enum(EVENT_TYPES),
    /** Instant ISO **avec offset de Paris**. Voir `ISO_AVEC_OFFSET` ci-dessus. */
    debut: z.string().refine(estIsoAvecOffset, {
      message:
        "La date doit être un instant ISO portant l'offset de Paris (jamais un « Z ») — " +
        "utiliser toParisIso().",
    }),
    /**
     * Le lieu tel qu'on le nomme : le bar du roulement, ou le nom de lieu saisi.
     * `null` est possible en théorie (une ligne écrite avant `event_has_venue`, corrigée en
     * 6.3) ; le rendu public le traite déjà ainsi, et n8n doit pouvoir le traiter aussi.
     */
    lieu: z.string().max(Math.max(LIEU_NOM_MAX, TITRE_MAX)).nullable(),
    /**
     * 🔴 LA BORNE COUVRE LA CONCATÉNATION, PAS UN SEUL CHAMP — corrigé en revue 6.7.
     * Elle valait `max(LIEU_ADRESSE_MAX, BAR_ADRESSE_MAX)` = 200, ce qui ne vaut que pour le
     * chemin « lieu libre » (une seule valeur). Le chemin BAR compose TROIS champs
     * (`address, district, city`, `reseaux.ts` → `lieuDuPayload`), chacun borné séparément à
     * la saisie : 200 + 120 + 80, plus les deux « , » = **404**. Un bar renseigné jusqu'à ses
     * bornes produisait donc un payload REFUSÉ par ce schéma, et l'écran accusait le site
     * (« c'est un défaut du site ») sans jamais nommer la vraie cause — annonce bloquée en
     * permanence pour ce bar, sans piste. La borne suit désormais ce que la saisie autorise.
     */
    adresse: z
      .string()
      .max(Math.max(LIEU_ADRESSE_MAX, BAR_ADRESSE_MAX + BAR_QUARTIER_MAX + BAR_VILLE_MAX + 4))
      .nullable(),
    jeux: z.string().max(JEUX_MAX).nullable(),
    description: z.string().max(DESCRIPTION_MAX).nullable(),
    /** Où l'annonce doit renvoyer : la page publique de l'agenda. */
      lien: lienAbsolu,
    })
    .nullable(),
  /** Prêts à publier, un par réseau — voir `lib/message-reseaux.ts`. */
  messages: messagesSchema,
  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * 🔴 OÙ L'ANNONCE DOIT PARAÎTRE — AJOUTÉ LE 2026-09-10, ET `version` RESTE À 1
   * ══════════════════════════════════════════════════════════════════════════════════════
   *
   * Jusqu'ici le paquet portait quatre textes et **aucune destination** : tout partait
   * partout, et seuls les réseaux ayant un nœud recevaient quelque chose. Le bénévole ne
   * pouvait donc pas décider « ce soir, Discord seulement ».
   *
   * 🔴 **CHAMP ADDITIF, DONC AUCUNE PANNE PENDANT LE DÉPLOIEMENT.** Le validateur en service
   * ignore les champs qu'il ne connaît pas : le site peut commencer à l'envoyer **avant** que
   * le workflow ne sache le lire. C'est exactement le raisonnement tenu pour `messages`, et
   * c'est ce qui fixe l'ordre : **le site d'abord, n8n ensuite**. Un numéro de version
   * incrémenté aurait fait refuser **toute** annonce entre les deux.
   *
   * 🔴 **`min(1)` : UNE LISTE VIDE EST UN REFUS, PAS UN SILENCE.** Sans cette borne, décocher
   * les quatre cases enverrait un paquet parfaitement valide qui ne publierait nulle part —
   * et l'écran dirait « annoncé ». Un faux succès, c'est-à-dire le défaut que la PR #118 a
   * corrigé sur ce même écran.
   *
   * ⚠️ **LES QUATRE TEXTES RESTENT EXIGÉS**, même en ne visant qu'un réseau (arbitrage de
   * Brice, 2026-09-10) : le modèle les rédige tous les quatre de toute façon, et n'exiger que
   * les textes cochés aurait obligé à mettre n8n à jour **avant** le site — c'est-à-dire à
   * fabriquer la fenêtre de panne que le paragraphe ci-dessus évite.
   *
   * ⚠️ **Les clés viennent de `lib/reseaux.ts`**, jamais réécrites ici : ce sont les mêmes que
   * celles de `messages`, et le workflow les compare telles quelles.
   */
  reseaux: z
    .array(z.enum(["discord", "x", "facebook", "instagram"]))
    .min(1, "Choisissez au moins un réseau."),
  /**
   * ══════════════════════════════════════════════════════════════════════════════════════
   * 🔴 L'IMAGE QUI ACCOMPAGNE LE POST — AJOUTÉE LE 2026-09-10, `version` TOUJOURS À 1
   * ══════════════════════════════════════════════════════════════════════════════════════
   *
   * Jusqu'ici l'image choisie dans `/admin/reseaux` servait **uniquement au modèle**, pour
   * qu'il sache de quoi il parle : elle était lue puis oubliée. Le post partait sans elle, et
   * personne ne pouvait le deviner depuis l'écran — on choisissait une image, elle ne
   * paraissait nulle part. Défaut trouvé par Brice **en faisant le parcours réel**, connecté,
   * là où toutes mes sondes voyaient un `200`.
   *
   * 🔴 **UNE URL PUBLIQUE, PAS DES OCTETS.** C'est ce que la médiathèque (15.1) a rendu
   * possible : l'image porte une ligne `photo` **publiée**, donc `/medias/<filename>` la sert.
   * Discord, Instagram et les autres veulent précisément ça — une adresse qu'ils vont
   * chercher eux-mêmes. Envoyer du base64 obligerait chaque nœud à la reposer quelque part.
   *
   * ⚠️ **`null` EST LE CAS NOMINAL** : un post sans image doit partir. Discord **refuse** un
   * embed dont l'URL est vide (mesuré : `400 {"embeds": ["0"]}`), donc c'est le workflow qui
   * décide d'attacher ou non — jamais une URL vide qu'on enverrait « au cas où ».
   * ⚠️ **Ce n'est PAS l'image de partage du site** (`site_setting.og_photo_id`), qui répond à
   * une autre question : « à quoi ressemble un lien du site collé dans une conversation ».
   * Les confondre a été proposé et **écarté par Brice** le 2026-09-10.
   */
  imageUrl: lienAbsolu.nullable(),
});

export type PublicationPayload = z.infer<typeof publicationPayloadSchema>;
