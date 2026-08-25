"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@repo/ui";

import { ChampFichier } from "@/components/admin/ChampFichier/ChampFichier";
import { ChampTexte } from "@/components/admin/ChampTexte/ChampTexte";
import { ALT_MAX, ALT_MIN, CAPTION_MAX, photoInputSchema } from "@/lib/schemas/photo";
import { televerserPhoto } from "@/server/actions/galerie";
import styles from "@/styles/admin-form.module.css";
import propre from "./PhotoUploader.module.css";

/**
 * Téléversement de photos (Story 6.4, FR21) — **le geste central de la story**.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 UNE REQUÊTE PAR FICHIER, ET C'EST LE FAIT ① DU CADRAGE QUI L'IMPOSE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Une Server Action refuse **1 Mo par défaut** (`next.config.ts` remonte la borne à 12 Mo,
 * mais elle reste par REQUÊTE). Le refus est un `ApiError(413)` levé par un `Transform` posé
 * sur le FLUX de requête, donc **avant que le corps de l'action ne s'exécute** : avant
 * `exigerRoleAction()`, avant Zod, avant tout message écrit par nous. Envoyer huit photos d'un
 * coup ferait donc tomber le lot entier sur un 413 muet.
 *
 * Trois conséquences, dans l'ordre d'importance :
 *   ① l'écran accepte N fichiers, le RÉSEAU en transporte UN à la fois ;
 *   ② un fichier refusé ne fait pas perdre les autres — c'est la différence entre
 *      « publier un retour en moins de dix minutes » (FR21) et « recommencer » ;
 *   ③ l'écran peut dire OÙ ON EN EST (« 3 / 8 »), ce qu'un envoi unique ne permet pas.
 *
 * ⚠️ CONTREPARTIE ÉCRITE À L'ÉCRAN, PAS LAISSÉE À DEVINER : le lot n'est **pas atomique**.
 * Un échec au 5ᵉ fichier laisse quatre photos créées — en brouillon, donc invisibles du
 * public, mais bien présentes dans la galerie du back-office.
 *
 * 🔴 UN `<input type="file">` NE PEUT PAS ÊTRE CONTRÔLÉ AU SENS DE REACT — sa valeur ne se
 * pilote pas depuis le state. Or React 19 RÉINITIALISE les champs non contrôlés d'un
 * `<form action={fn}>` une fois l'action résolue, succès COMME échec (défaut réel de la
 * Story 5.1). Les fichiers choisis vivent donc dans le state du composant (`File[]`), et
 * l'`<input>` n'est qu'un déclencheur de sélection : sans cela, un échec sur le 5ᵉ fichier
 * viderait la sélection et obligerait à tout recommencer — exactement ce que ② évite.
 * ⚠️ C'est aussi pourquoi ce formulaire n'utilise PAS `<form action={…}>` : la soumission
 * est une boucle, pas un envoi.
 */

/**
 * 🔴 10 Mo CÔTÉ CLIENT, 12 Mo CÔTÉ SERVEUR — ET L'ÉCART EST LA GARDE (arbitrage Q1).
 *
 * La borne client est la seule qui produise un message UTILE : elle connaît la taille du
 * `File` sans rien transmettre, et peut donc nommer la taille du fichier ET la limite. La
 * borne serveur (`experimental.serverActions.bodySizeLimit`) est le filet, et elle doit
 * rester STRICTEMENT SUPÉRIEURE : le multipart transporte plus que l'octet du fichier
 * (frontières, en-têtes, encodage des autres champs). Sans cette marge de 2 Mo, un fichier
 * de 10,0 Mo accepté ici repartirait en 413 — c'est-à-dire exactement le défaut qu'on
 * cherche à éviter.
 *
 * ⚠️ Volontairement haute : la dette **R15** attend des originaux HAUTE DÉFINITION, et cette
 * story conserve l'original tel quel. La baisser rendrait R15 insoluble.
 */
const TAILLE_MAX_OCTETS = 10 * 1024 * 1024;

/** « 4,2 Mo » plutôt que « 4404019 octets » — le message doit être lisible, pas exact. */
function formaterTaille(octets: number): string {
  const mo = octets / (1024 * 1024);
  return `${mo.toFixed(1).replace(".", ",")} Mo`;
}

/** État d'un fichier dans le lot. `attente` → `encours` → `fait` | `echec`. */
type EtatFichier = {
  fichier: File;
  statut: "attente" | "encours" | "fait" | "echec";
  message?: string;
};

export interface PhotoUploaderProps {
  /** Événements auxquels rattacher les photos. Le rattachement reste FACULTATIF. */
  evenements: readonly { id: string; titre: string }[];
}

export function PhotoUploader({ evenements }: PhotoUploaderProps) {
  const router = useRouter();

  const [lot, setLot] = useState<EtatFichier[]>([]);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [eventId, setEventId] = useState("");
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [termine, setTermine] = useState(false);

  /**
   * 🔴 GARDE DE RÉ-ENTRÉE — DÉFAUT RÉEL TROUVÉ À LA PASSE ADVERSARIALE DU DEV.
   *
   * Le bouton n'est **jamais** `disabled` (patron de la Story 5.1 : un bouton grisé pendant
   * une latence réseau donne l'impression d'une page morte). Sans garde, un second clic
   * pendant l'envoi rappelle `envoyer()`, qui relit `lot` dans la fermeture du rendu
   * COURANT : les fichiers pas encore traités y sont toujours à `"attente"`, donc **ils
   * partiraient une seconde fois**. Conséquence : des photos EN DOUBLE, et — parce que le
   * nom est généré par le serveur — **deux fichiers distincts sur le volume**, que la
   * contrainte `unique()` ne peut pas voir (elle protège le nom, pas le contenu).
   *
   * ⚠️ UN `ref` ET NON UN `useState` : un `setState` n'est pas appliqué de façon synchrone,
   * donc `enCours` est encore `false` au moment où le second gestionnaire s'exécute. Seule
   * une valeur mutée sur place ferme la fenêtre.
   * ⚠️ Famille de la dette **R31** (pas de garde double-clic sur le formulaire de
   * sollicitation, ACCEPTÉE pour la v1) — mais ici la conséquence n'est pas une ligne en
   * double : c'est un OCTET en double sur un volume qu'on sauvegarde.
   */
  const envoiEnCours = useRef(false);

  // Focus au premier champ en erreur, dans l'ordre VISUEL (patron `EventForm`).
  useEffect(() => {
    if (erreurs.alt) document.getElementById("photo-alt")?.focus();
    else if (erreurs.caption) document.getElementById("photo-caption")?.focus();
  }, [erreurs]);

  const avancement = lot.filter((f) => f.statut === "fait" || f.statut === "echec").length;
  const echecs = lot.filter((f) => f.statut === "echec");
  const reussites = lot.filter((f) => f.statut === "fait");

  function choisir(fichiers: FileList | null) {
    setTermine(false);
    setErreurGenerale(null);
    if (!fichiers || fichiers.length === 0) {
      setLot([]);
      return;
    }
    setLot(
      Array.from(fichiers).map((fichier) => {
        // 🔴 LA BORNE CLIENT S'APPLIQUE À LA SÉLECTION, PAS À L'ENVOI : le refus est visible
        // AVANT le premier octet transmis, et il nomme la taille du fichier ET la limite.
        if (fichier.size > TAILLE_MAX_OCTETS) {
          return {
            fichier,
            statut: "echec" as const,
            message:
              `Ce fichier fait ${formaterTaille(fichier.size)}, la limite est de ` +
              `${formaterTaille(TAILLE_MAX_OCTETS)}. Réduisez-le, ou choisissez une autre photo. ` +
              "Il n'a pas été envoyé.",
          };
        }
        return { fichier, statut: "attente" as const };
      }),
    );
  }

  async function envoyer() {
    // Voir `envoiEnCours` : un second clic pendant l'envoi ferait repartir les fichiers
    // encore en attente une deuxième fois.
    if (envoiEnCours.current) return;

    setErreurGenerale(null);
    setTermine(false);

    // ── Validation CLIENT, avec le MÊME schéma Zod que le serveur ────────────────────
    // Le focus au premier champ en erreur ne doit pas attendre un aller-retour réseau. Le
    // serveur re-valide quand même : il ne fait jamais confiance au client.
    const analyse = photoInputSchema
      .omit({ filename: true, sortOrder: true, isPublished: true })
      .safeParse({ alt, caption, eventId: eventId === "" ? null : eventId });

    if (!analyse.success) {
      const champs: Record<string, string> = {};
      for (const souci of analyse.error.issues) {
        const clef = souci.path[0];
        if (typeof clef === "string" && !(clef in champs)) champs[clef] = souci.message;
      }
      setErreurs(champs);
      return;
    }
    setErreurs({});

    const aEnvoyer = lot.filter((f) => f.statut === "attente");
    if (aEnvoyer.length === 0) {
      setErreurGenerale("Choisissez au moins une photo à envoyer.");
      return;
    }

    envoiEnCours.current = true;
    setEnCours(true);

    // 🔴 BOUCLE SÉQUENTIELLE, JAMAIS `Promise.all`. Trois raisons, et la première suffit :
    // ① `sortOrder` est calculé par `max + 1` côté serveur — des envois parallèles liraient
    //    le même maximum et se donneraient le même rang ;
    // ② l'avancement (« 3 / 8 ») n'aurait aucun sens ;
    // ③ N téléversements simultanés de plusieurs mégaoctets depuis un poste de bénévole
    //    dégradent le débit au lieu de l'améliorer.
    for (const entree of aEnvoyer) {
      setLot((precedent) =>
        precedent.map((f) => (f.fichier === entree.fichier ? { ...f, statut: "encours" } : f)),
      );

      const donnees = new FormData();
      donnees.set("fichier", entree.fichier);
      donnees.set("alt", alt);
      donnees.set("caption", caption);
      donnees.set("eventId", eventId);

      let resultat: Awaited<ReturnType<typeof televerserPhoto>>;
      try {
        resultat = await televerserPhoto(donnees);
      } catch {
        // 🔴 CE `catch` ATTRAPE TROIS CHOSES DISTINCTES, ET AUCUNE N'EST « UNE ERREUR RÉSEAU ».
        // ① `exigerRoleAction()` s'exécute AVANT le `try` de la Server Action et **lève** : une
        //    session expirée ou un compte retiré de l'allowlist arrive ici (leçon 6.3) ;
        // ② un `413` du serveur, si un fichier franchissait la borne client — il ne
        //    emprunte PAS le retour discriminé (fait ① du cadrage) ;
        // ③ le fichier a été DÉPLACÉ OU SUPPRIMÉ du disque entre la sélection et l'envoi :
        //    le navigateur ne sait alors plus lire le `File`, et l'échec tombe ici aussi
        //    (cas ajouté après revue — la version précédente n'en nommait que deux, donc
        //    accusait à tort la session ou le poids).
        // Un message « erreur réseau » sur le geste nominal de la story serait un diagnostic
        // faux. On nomme donc les trois causes réellement possibles, sans en inventer.
        setLot((precedent) =>
          precedent.map((f) =>
            f.fichier === entree.fichier
              ? {
                  ...f,
                  statut: "echec",
                  message:
                    "L'envoi de ce fichier a échoué. Trois causes possibles : il est trop " +
                    "lourd, il a été déplacé ou supprimé de votre ordinateur depuis que vous " +
                    "l'avez choisi, ou votre session n'est plus valide — dans ce dernier cas, " +
                    "rechargez la page et reconnectez-vous. Rien n'a été enregistré pour ce fichier.",
                }
              : f,
          ),
        );
        continue;
      }

      setLot((precedent) =>
        precedent.map((f) =>
          f.fichier === entree.fichier
            ? resultat.ok
              ? { ...f, statut: "fait" }
              : { ...f, statut: "echec", message: resultat.error }
            : f,
        ),
      );

      if (!resultat.ok && resultat.fieldErrors) setErreurs(resultat.fieldErrors);
    }

    envoiEnCours.current = false;
    setEnCours(false);
    setTermine(true);
    // Ne concerne que le cache ROUTEUR du navigateur : les pages publiques sont
    // `force-dynamic`, il n'y a AUCUN cache de données à invalider (voir
    // `server/actions/galerie.ts`).
    router.refresh();
  }

  return (
    <div className={styles.form}>
      {/* ── Le champ fichier ─────────────────────────────────────────────────────────
          ✅ EXTRAIT PAR LA STORY 6.5, QUI EN EST LE 2ᵉ CONSOMMATEUR — comme annoncé ici, et
          après comptage. Ce qui a tranché n'est pas le JSX (8 lignes) mais le **style** du
          contrôle natif, dont deux copies auraient divergé en silence. Le raisonnement
          complet vit dans `components/admin/ChampFichier/ChampFichier.tsx`.
          ⚠️ `multiple` et `disabled` sont les DEUX props que ce consommateur-ci paie ; le
          champ de logo n'en utilise aucune. Aucune 3ᵉ prop « au cas où ». */}
      <ChampFichier
        id="photo-fichiers"
        label="Photos à téléverser"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        /* 🔴 LE SEUL `disabled` DE CET ÉCRAN, ET IL N'EST PAS UNE ENTORSE AU PATRON 5.1
           (« jamais de bouton grisé pendant une latence ») — DÉFAUT RÉEL TROUVÉ EN REVUE.
           Changer la sélection PENDANT l'envoi remplace `lot` par un nouveau tableau, alors
           que la boucle en cours itère sur l'ancien : ses `setLot` ne retrouvent plus aucune
           correspondance, **l'avancement se fige à l'écran pendant que les écritures
           continuent en base et sur le disque**. Le patron 5.1 interdit de griser une ACTION
           qu'on peut refaire ; il ne demande pas de laisser ouvrir une course invisible. */
        disabled={enCours}
        onChange={choisir}
        aide={
          <>
            JPEG, PNG, WebP ou AVIF, {formaterTaille(TAILLE_MAX_OCTETS)} maximum par photo.
            Les fichiers <strong>.svg</strong> ne sont pas acceptés. Vous pouvez en
            sélectionner plusieurs d&rsquo;un coup.
          </>
        }
      />

      {/* ── La description et la légende, avec leur distinction ÉCRITE ───────────────
          🔴 `alt` N'EST PAS LA LÉGENDE, et c'est ici — au point de saisie — que la
          distinction peut encore se perdre. La base et Zod ont fait tout ce qu'ils
          pouvaient : ils exigent un `alt` non vide, ils ne peuvent pas exiger qu'il soit
          PERTINENT. Lighthouse non plus — il voit un `alt` NON VIDE, pas un `alt` juste,
          et afficherait 100/100 sur une galerie inutilisable au lecteur d'écran. */}
      <ChampTexte
        id="photo-alt"
        name="alt"
        label="Description de la photo (obligatoire)"
        valeur={alt}
        onChange={setAlt}
        max={ALT_MAX}
        multiligne
        aide={
          `Ce que MONTRE la photo, pour les personnes qui ne la voient pas. ` +
          `Au moins ${ALT_MIN} caractères. Exemple : « Une dizaine de joueurs attablés ` +
          `devant deux écrans, dans un bar ».`
        }
        erreur={erreurs.alt}
      />

      <ChampTexte
        id="photo-caption"
        name="caption"
        label="Légende (facultative)"
        valeur={caption}
        onChange={setCaption}
        max={CAPTION_MAX}
        aide={
          "Ce qu'on COMMENTE, en écriture manuscrite sous la photo. Exemple : " +
          "« Le stand, plein à craquer ». Ce n'est pas la description : la légende commente, " +
          "la description informe."
        }
        erreur={erreurs.caption}
      />

      <div className={styles.champ}>
        <label className={styles.label} htmlFor="photo-eventId">
          Rattacher à un événement (facultatif)
        </label>
        <select
          id="photo-eventId"
          name="eventId"
          className={styles.saisie}
          value={eventId}
          onChange={(evenement) => setEventId(evenement.target.value)}
        >
          {/* ⚠️ Une photo SANS événement est un cas NOMINAL — « la vie de l'asso ». L'option
              par défaut le dit, plutôt que de laisser un vide qui ressemblerait à un oubli. */}
          <option value="">Aucun — une photo de la vie de l&rsquo;asso</option>
          {evenements.map((evenement) => (
            <option key={evenement.id} value={evenement.id}>
              {evenement.titre}
            </option>
          ))}
        </select>
        <p className={styles.sousChamp}>
          <span>
            Rattachée à un événement passé, la <strong>première photo publiée</strong>{" "}
            illustre sa vignette « Déjà passé » sur la page Agenda — en plus de la galerie de
            l&rsquo;accueil.
          </span>
        </p>
      </div>

      {/* ⚠️ La description et la légende sont les MÊMES pour tout le lot : c'est le compromis
          de « publier un retour de soirée en moins de dix minutes ». Le dire évite qu'on
          téléverse huit photos avec la même description en croyant les avoir décrites une
          par une. */}
      {lot.length > 1 ? (
        <p className={styles.avertissement} role="status">
          La description et la légende ci-dessus s&rsquo;appliqueront aux{" "}
          <strong>{lot.length} photos</strong> du lot. Vous pourrez ensuite les modifier une
          par une depuis la liste.
        </p>
      ) : null}

      {/* ── Le lot, et son avancement ──────────────────────────────────────────────── */}
      {lot.length > 0 ? (
        <div className={propre.lot}>
          <p className={propre.lotTitre} aria-live="polite">
            {enCours
              ? `Envoi en cours — ${avancement} / ${lot.length}`
              : `${lot.length} fichier${lot.length > 1 ? "s" : ""} sélectionné${lot.length > 1 ? "s" : ""}`}
          </p>
          <ul className={propre.lotListe}>
            {lot.map((entree) => (
              <li key={`${entree.fichier.name}-${entree.fichier.size}`} className={propre.lotLigne}>
                <span className={propre.lotNom}>{entree.fichier.name}</span>
                <span className={propre.lotTaille}>{formaterTaille(entree.fichier.size)}</span>
                <span className={propre.lotStatut}>
                  {entree.statut === "attente" && "en attente"}
                  {entree.statut === "encours" && "envoi…"}
                  {entree.statut === "fait" && "envoyée"}
                  {entree.statut === "echec" && "refusée"}
                </span>
                {entree.message ? <p className={propre.lotMessage}>{entree.message}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {erreurGenerale ? (
        <p className={styles.erreur} role="alert">
          {erreurGenerale}
        </p>
      ) : null}

      {/* ── Le bilan, y compris ce que le lot a laissé derrière lui ─────────────────── */}
      {termine ? (
        <div className={styles.confirmation} role="status">
          <p>
            {reussites.length > 0
              ? `${reussites.length} photo${reussites.length > 1 ? "s" : ""} enregistrée${reussites.length > 1 ? "s" : ""} en brouillon.`
              : "Aucune photo n'a été enregistrée."}
          </p>
          {/* 🔴 LA NON-ATOMICITÉ EST ÉCRITE, PAS LAISSÉE À DEVINER. Un lot partiellement
              réussi n'est pas annulé : les photos déjà créées restent, en brouillon. */}
          {echecs.length > 0 && reussites.length > 0 ? (
            <p>
              {echecs.length} fichier{echecs.length > 1 ? "s ont" : " a"} été refusé
              {echecs.length > 1 ? "s" : ""} — <strong>les autres sont bien enregistrées</strong>,
              le lot n&rsquo;est pas annulé. Reprenez seulement{" "}
              {echecs.length > 1 ? "les fichiers refusés" : "le fichier refusé"}.
            </p>
          ) : null}
          {reussites.length > 0 ? (
            <p>
              Rien n&rsquo;est visible sur le site tant que vous ne les avez pas publiées.{" "}
              <Link className={styles.lien} href="/admin/galerie">
                Aller à la galerie pour les décrire et les publier
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className={styles.actions}>
        {/* Jamais `disabled` pendant l'attente — patron 5.1 : un bouton grisé donne
            l'impression d'une page morte. Le libellé porte l'état. */}
        <Button type="button" onClick={envoyer}>
          {enCours
            ? `Envoi… ${avancement} / ${lot.length}`
            : lot.length > 1
              ? `Envoyer les ${lot.length} photos`
              : "Envoyer la photo"}
        </Button>
        <Link className={styles.lien} href="/admin/galerie">
          Retour à la galerie
        </Link>
      </div>
    </div>
  );
}
