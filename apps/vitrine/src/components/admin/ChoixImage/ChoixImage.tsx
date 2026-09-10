"use client";

import Image from "next/image";
import { type ReactNode, useId, useState } from "react";
import { Button } from "@repo/ui";

import { ChampFichier } from "@/components/admin/ChampFichier/ChampFichier";
import { IMAGE_TAILLE_MAX_OCTETS, formaterTaille } from "@/lib/galerie";
import { televerserPhoto } from "@/server/actions/galerie";
import type { ImageChoisissable } from "@/server/db/queries/photos";
import form from "@/styles/admin-form.module.css";
import styles from "./ChoixImage.module.css";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * CHOISIR UNE IMAGE, OU L'IMPORTER — UN SEUL BLOC, TROIS CONSOMMATEURS (Story 15.1)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 C'EST LE MODÈLE DE BRICE, ÉCRIT EN COMPOSANT : *« on choisit une image de la médiathèque
 * ou on l'importe directement, et elle s'ajoute à la médiathèque »*. Partout où une image est
 * requise — un événement, un tournoi, un post — c'est **le même geste**, donc le même bloc.
 * L'écran de tournoi proposait jusqu'ici une **liste déroulante de textes** (`<option>{alt}`) :
 * on y choisissait une image sans la voir.
 *
 * 🔴 DES `<input type="radio">` RÉELS, PAS DES `<div>` CLIQUABLES, ET CE N'EST PAS UN DÉTAIL.
 * Un groupe de radios donne **gratuitement** ce qu'il faudrait sinon réimplémenter et qu'on
 * réimplémente toujours mal : la navigation aux flèches, l'annonce « 3 sur 12 » au lecteur
 * d'écran, le focus visible, et la valeur postée **sans champ caché**. La vignette est le
 * `<label>` — cliquer dessus coche le radio, c'est du HTML, pas du JavaScript.
 * ⚠️ Le radio est masqué VISUELLEMENT (`.radio`, jamais `display: none` ni `hidden`) : les
 * deux dernières le retireraient de l'ordre de tabulation et du groupe annoncé.
 *
 * 🔴 « AUCUNE IMAGE » EST UNE OPTION DU GROUPE, PAS UN BOUTON « RETIRER ». C'est ce qui rend
 * le champ réversible sans geste particulier, et ce qui fait que `value=""` est toujours
 * posté — les schémas (`event.photoId`, `tournament.photoId`) transforment la chaîne vide en
 * `null` **avant** de valider le format, précisément pour ça.
 *
 * ⚠️ **L'IMPORT N'EST PAS UN `<form>`** — ce bloc vit DANS le formulaire de l'événement ou du
 * tournoi, et un `<form>` imbriqué est du HTML invalide (le navigateur le déplace ou l'ignore,
 * en silence). Le bouton est donc un `type="button"` explicite qui appelle l'action lui-même.
 * 🔴 Sans ce `type`, il vaudrait `submit` par défaut et **enregistrerait l'événement** au lieu
 * d'importer l'image : un défaut qui ne casse rien, ne lève rien, et fait juste autre chose.
 *
 * ⚠️ L'image importée arrive **publiée et hors galerie** (`usage=visuel`). Le raisonnement
 * complet vit dans `televerserPhoto` ; ici on se contente de le **dire au bénévole**, au
 * moment où il importe, plutôt que de le lui laisser découvrir sur la page d'accueil.
 */
export interface ChoixImageProps {
  /** `name` du champ posté — `"photoId"` chez les trois consommateurs actuels. */
  nom: string;
  /** L'image déjà choisie, ou `null`. */
  valeurInitiale: string | null;
  /** Les images proposables (`getImagesPourChoix`) — publiées, galerie ET visuels. */
  images: readonly ImageChoisissable[];
  /** Libellé du groupe. Il porte le `<legend>`, donc il nomme le champ entier. */
  label: string;
  /**
   * Ce que CE champ-ci a de particulier à dire — l'usage de l'image, ses conséquences.
   *
   * ⚠️ **Le bloc ne dit de lui-même que ce qui vaut PARTOUT** (le poids maximal, le fait
   * qu'une image importée rejoigne la médiathèque hors galerie). Le reste appartient au
   * champ : « c'est l'image qui apparaît quand un lien du site est collé », « elle passe
   * derrière le titre de l'accueil ». Les écrire ici ferait un bloc qui parle de quatre
   * usages à la fois, donc qui n'en explique aucun.
   */
  aide?: ReactNode;
  /** Message d'erreur renvoyé par l'action pour ce champ. */
  erreur?: string;
  /**
   * Prévenu à chaque changement de choix — **pour les consommateurs qui ne soumettent pas un
   * `<form>`** (le composeur réseaux appelle son action à la main).
   *
   * ⚠️ Le composant reste maître de son state : ce rappel NOTIFIE, il ne pilote pas. En faire
   * un composant contrôlé obligerait les deux formulaires qui n'en ont pas besoin (événement,
   * tournoi) à tenir un state pour un champ que le navigateur poste déjà tout seul.
   */
  onChange?: (id: string) => void;
}

export function ChoixImage({
  nom,
  valeurInitiale,
  images,
  label,
  aide,
  erreur,
  onChange,
}: ChoixImageProps) {
  const idBase = useId();
  // 🔴 LA LISTE VIT DANS LE STATE, ET C'EST CE QUI PERMET D'IMPORTER SANS RECHARGER. Une
  // image importée est ajoutée EN TÊTE (`getImagesPourChoix` trie par date décroissante :
  // l'écran reste donc cohérent avec ce que rendrait un rechargement) puis sélectionnée —
  // sans quoi il faudrait la retrouver soi-même dans la grille, c'est-à-dire refaire à la
  // main le geste qu'on vient de faire.
  const [liste, setListe] = useState<readonly ImageChoisissable[]>(images);
  const [choix, setChoix] = useState(valeurInitiale ?? "");

  // ⚠️ UN SEUL POINT DE PASSAGE : les trois endroits qui changent le choix (« aucune », une
  // vignette, un import qui vient d'aboutir) passent par ici. Trois `setChoix` directs
  // auraient laissé le rappel s'oublier sur l'un des trois — et c'est toujours celui de
  // l'import qu'on oublie, puisqu'il n'est pas un clic.
  function choisir(id: string) {
    setChoix(id);
    onChange?.(id);
  }

  const [fichier, setFichier] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);

  const idImport = `${idBase}-import`;
  const idDescription = `${idBase}-description`;
  const idErreur = `${idBase}-erreur`;

  async function importer() {
    // ⚠️ LES DEUX REFUS SONT DITS ICI, PAS AU SERVEUR, parce qu'ils sont connus SANS RIEN
    // TRANSMETTRE — et parce qu'un refus de taille côté serveur tombe en `413` avant le corps
    // de l'action, donc sans message écrit par nous (voir `next.config.ts`).
    if (fichier === null) {
      setEchec("Choisissez d'abord un fichier à importer.");
      return;
    }
    if (fichier.size > IMAGE_TAILLE_MAX_OCTETS) {
      setEchec(
        `Ce fichier fait ${formaterTaille(fichier.size)}, au-delà des ` +
          `${formaterTaille(IMAGE_TAILLE_MAX_OCTETS)} acceptés. Réduisez-le et réessayez.`,
      );
      return;
    }

    setEnvoiEnCours(true);
    setEchec(null);

    const donnees = new FormData();
    donnees.set("fichier", fichier);
    donnees.set("alt", description);
    // 🔴 C'EST CE CHAMP QUI DIT « CETTE IMAGE EST IMPORTÉE POUR UN USAGE » : publiée, donc
    // servable tout de suite, et hors de la galerie de l'accueil. Voir `televerserPhoto`.
    donnees.set("usage", "visuel");

    const resultat = await televerserPhoto(donnees);
    setEnvoiEnCours(false);

    if (!resultat.ok) {
      setEchec(resultat.error);
      return;
    }

    // ⚠️ On reconstruit l'entrée depuis ce que l'action REND (`id`, `filename`) et ce qu'on
    // vient de saisir — jamais depuis une seconde lecture : la ligne n'existe que depuis une
    // milliseconde, et une relecture ferait un aller-retour pour des valeurs qu'on connaît.
    // Le point focal vaut son défaut (le centre), qui est exactement ce que la base a écrit.
    setListe((avant) => [
      { id: resultat.data.id, filename: resultat.data.filename, alt: description, focalX: 50, focalY: 50 },
      ...avant,
    ]);
    choisir(resultat.data.id);
    setFichier(null);
    setDescription("");
  }

  return (
    <fieldset className={styles.groupe}>
      <legend className={form.legend}>{label}</legend>
      {aide ? <p className={form.sousChamp}>{aide}</p> : null}
      {/* 🔴 CETTE PHRASE-LÀ VAUT POUR LES QUATRE ÉCRANS, ET SON ABSENCE A COÛTÉ UN
          DIAGNOSTIC FAUX (2026-09-10). Une image en brouillon n'apparaît pas dans la grille,
          et rien ne le disait : Brice a cherché la sienne, ne l'a pas trouvée, et en a déduit
          une règle qui n'existe pas (« il faut qu'elle soit rattachée à un événement »).
          ⚠️ Ce n'est pas une précaution : `/medias/[filename]` répond 404 sur un brouillon
          (garde 6.4), donc une image non publiée ne s'afficherait nulle part. */}
      <p className={form.sousChamp}>
        Seules les images <strong>publiées</strong> sont proposées&nbsp;: une image en
        brouillon ne s&rsquo;afficherait nulle part. Vous pouvez la publier depuis la{" "}
        <strong>médiathèque</strong>, ou en importer une ci-dessous.
      </p>

      <div className={styles.grille} role="none">
        {/* « Aucune image » d'abord : c'est l'état par défaut et le plus fréquent, et il doit
            être atteignable en une tabulation, pas après douze vignettes. */}
        <label className={styles.case}>
          <input
            className={styles.radio}
            type="radio"
            name={nom}
            value=""
            checked={choix === ""}
            onChange={() => choisir("")}
          />
          <span className={styles.vignetteVide} aria-hidden="true">
            &mdash;
          </span>
          <span className={styles.nom}>Aucune image</span>
        </label>

        {liste.map((image) => (
          <label className={styles.case} key={image.id}>
            <input
              className={styles.radio}
              type="radio"
              name={nom}
              value={image.id}
              checked={choix === image.id}
              onChange={() => choisir(image.id)}
            />
            <span className={styles.vignette}>
              {/* 🔴 SERVIE PAR LA ROUTE D'ADMIN ET `unoptimized` — les deux sont des gardes,
                  pas des réglages. `/medias/` refuse les brouillons par conception (404), et
                  l'optimiseur `/_next/image` fait sa requête DEPUIS LE SERVEUR, sans cookie
                  de session : il recevrait la redirection de la garde, pas une image, et
                  rendrait 400. Raisonnement complet sur la liste de `/admin/galerie`. */}
              <Image
                src={`/admin/medias/${image.filename}`}
                alt=""
                fill
                sizes="140px"
                className={styles.vignetteImage}
                /* 🔴 `lazy` RÉPOND À UNE OBJECTION ÉCRITE, il n'est pas décoratif. La 7.3
                   avait écarté la grille de vignettes en Réglages au motif qu'elle
                   « demanderait de charger autant d'images » que la médiathèque en compte
                   (bornée à 200). Avec le chargement différé, le navigateur ne va chercher
                   que ce qui entre à l'écran — l'objection tombe pour de bon, au lieu
                   d'être balayée. */
                loading="lazy"
                // ⚠️ Le point focal, ici comme partout : la vignette recadre, donc elle COUPE.
                // Sans lui on choisirait une image sur un cadrage que le site n'applique pas.
                style={{ objectPosition: `${image.focalX}% ${image.focalY}%` }}
                unoptimized
              />
            </span>
            {/* `alt` est la description, obligatoire depuis la 4.3 : c'est le seul texte qui
                identifie une image à coup sûr. Le nom de fichier, lui, est généré. */}
            <span className={styles.nom}>{image.alt}</span>
          </label>
        ))}
      </div>

      {erreur ? (
        <p className={form.erreur} id={idErreur}>
          {erreur}
        </p>
      ) : null}

      <div className={styles.import}>
        <ChampFichier
          id={idImport}
          label="Ou importer une image"
          accept="image/jpeg,image/png,image/webp,image/avif"
          aide={
            <>
              JPEG, PNG, WebP ou AVIF, {formaterTaille(IMAGE_TAILLE_MAX_OCTETS)} maximum. Elle
              rejoint la{" "}
              <strong>médiathèque</strong> et devient utilisable tout de suite&nbsp;; elle
              n&rsquo;entre <strong>pas</strong> dans la galerie de l&rsquo;accueil — vous
              pourrez l&rsquo;y ajouter depuis la médiathèque si vous le souhaitez.
            </>
          }
          onChange={(fichiers) => {
            setFichier(fichiers?.[0] ?? null);
            setEchec(null);
          }}
        />

        <div className={form.champ}>
          <label className={form.label} htmlFor={idDescription}>
            Description de l&rsquo;image (obligatoire)
          </label>
          <input
            id={idDescription}
            className={form.saisie}
            type="text"
            value={description}
            onChange={(evenement) => setDescription(evenement.target.value)}
          />
          {/* 🔴 CE N'EST PAS UN CHAMP DE CONFORT, ET C'EST POURQUOI IL EST ICI PLUTÔT QUE
              « PLUS TARD, DANS LA MÉDIATHÈQUE » : `alt` est `notNull` en base et c'est
              l'accessibilité de toute image publiée (NFR3). Le demander au moment de
              l'import est la seule façon de l'obtenir de quelqu'un qui regarde l'image. */}
          <p className={form.sousChamp}>
            Ce que <strong>montre</strong> l&rsquo;image, pour les personnes qui ne la voient
            pas. Exemple&nbsp;: «&nbsp;l&rsquo;affiche du tournoi TFT du 24 septembre&nbsp;».
          </p>
        </div>

        {echec ? <p className={form.erreur}>{echec}</p> : null}

        {/* 🔴 `type="button"` — SANS LUI CE BOUTON ENREGISTRERAIT L'ÉVÉNEMENT. Voir la tête
            de ce fichier : c'est le défaut le plus discret de ce composant. */}
        <Button type="button" onClick={importer} disabled={envoiEnCours}>
          {envoiEnCours ? "Import en cours…" : "Importer cette image"}
        </Button>
      </div>
    </fieldset>
  );
}
