"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@repo/ui";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import { ChampFichier } from "@/components/admin/ChampFichier/ChampFichier";
import { LOGO_HAUTEUR, LOGO_LARGEUR_MAX } from "@/lib/logos";
import { remplacerLogoPartenaire, retirerLogoPartenaire } from "@/server/actions/partenaires";
import styles from "@/styles/admin-form.module.css";

/**
 * Téléversement, REMPLACEMENT et retrait du logo d'un partenaire (Story 6.5).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QUE CET ÉCRAN FAIT ET QUE LA GALERIE REFUSE DE FAIRE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `PhotoForm` (6.4) écrit noir sur blanc : *« Le fichier image ne se remplace pas ici. Pour
 * changer la photo elle-même, supprimez celle-ci et téléversez la nouvelle. »* C'est juste
 * **pour une photo** : une photo de soirée ne se met pas à jour.
 *
 * **Une marque, si.** Un sponsor refait sa charte, et son entrée — nom, catégorie,
 * description, lien, rang, place dans le bandeau — doit lui survivre. Obliger à supprimer
 * puis recréer ferait perdre tout le reste pour changer un fichier. Le remplacement est donc
 * un geste de premier ordre ici, et le retrait aussi.
 *
 * ⚠️ L'ANCIEN FICHIER PART AVEC LE REMPLACEMENT — sinon chaque changement de charte laisserait
 * sur le volume un octet que plus aucun écran ne peut atteindre. La décision et son ordre
 * (ligne d'abord, fichier ensuite) vivent dans `server/actions/partenaires.ts`.
 *
 * 🔴 UN SEUL FICHIER, DONC PAS DE LOT ET PAS DE BOUCLE — c'est toute la différence avec
 * `PhotoUploader`, et c'est pourquoi `ChampFichier` n'a que deux props optionnelles : ce
 * consommateur-ci n'en utilise **aucune**.
 */

/**
 * ⚠️ La borne CLIENT (5 Mo) est plus basse que celle de la galerie (10 Mo), et plus basse que
 * la borne serveur (12 Mo, `next.config.ts`). Les trois écarts sont voulus :
 *   · **plus basse que la galerie** parce qu'un logo n'est pas une photo : 5 Mo, c'est déjà
 *     très au-delà de tout fichier de marque réel, et R15 (qui exige des sources HD) ne
 *     concerne que les photos ;
 *   · **strictement inférieure au serveur** parce que le multipart transporte plus que
 *     l'octet du fichier. Sans marge, un fichier accepté ici repartirait en `413` — un refus
 *     qui tombe AVANT le corps de l'action, donc sans message écrit par nous.
 */
const TAILLE_MAX_OCTETS = 5 * 1024 * 1024;

function formaterTaille(octets: number): string {
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

export interface LogoUploaderProps {
  partenaireId: string;
  /** Nom du partenaire — sert le nom accessible des boutons et la confirmation. */
  nom: string;
  /** `true` si un logo est déjà en place : le vocabulaire de l'écran change. */
  aUnLogo: boolean;
  /**
   * `true` si le logo actuel vit dans `public/` (l'un des 4 semés), donc **n'est pas
   * supprimable** — voir `lib/logos.ts`. L'écran le DIT plutôt que de proposer un geste qui
   * ne ferait rien.
   */
  logoLivreAvecLeSite: boolean;
}

export function LogoUploader({
  partenaireId,
  nom,
  aUnLogo,
  logoLivreAvecLeSite,
}: LogoUploaderProps) {
  const router = useRouter();

  const [fichier, setFichier] = useState<File | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [bilan, setBilan] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  /**
   * 🔴 GARDE DE RÉ-ENTRÉE — MÊME RAISON QU'EN 6.4, ET LA CONSÉQUENCE EST PIRE ICI.
   *
   * Le bouton n'est jamais `disabled` (patron 5.1). Sans garde, un second clic pendant
   * l'envoi rappellerait `envoyer()` avec le même `File` : **deux normalisations, deux
   * fichiers distincts sur le volume**, et la seconde mise à jour écraserait `logo` en
   * laissant le premier fichier orphelin — que l'unicité de `partner_logo_unique` ne peut pas
   * voir, puisque les deux noms diffèrent.
   *
   * ⚠️ UN `ref` ET NON UN `useState` : un `setState` n'est pas appliqué de façon synchrone,
   * donc `enCours` serait encore `false` au moment où le second gestionnaire s'exécute.
   */
  const envoiEnCours = useRef(false);

  function choisir(fichiers: FileList | null) {
    setErreur(null);
    setBilan(null);
    const choisi = fichiers?.[0] ?? null;
    if (choisi && choisi.size > TAILLE_MAX_OCTETS) {
      setFichier(null);
      // La borne CLIENT s'applique à la SÉLECTION : le refus est visible avant le premier
      // octet transmis, et il nomme la taille du fichier ET la limite.
      setErreur(
        `Ce fichier fait ${formaterTaille(choisi.size)}, la limite est de ` +
          `${formaterTaille(TAILLE_MAX_OCTETS)}. Un logo n'a jamais cette taille : ` +
          "exportez-le plus petit. Il n'a pas été envoyé.",
      );
      return;
    }
    setFichier(choisi);
  }

  async function envoyer() {
    if (envoiEnCours.current) return;
    if (fichier === null) {
      setErreur("Choisissez d'abord un fichier.");
      return;
    }

    envoiEnCours.current = true;
    setEnCours(true);
    setErreur(null);
    setBilan(null);

    try {
      const donnees = new FormData();
      donnees.set("fichier", fichier);
      const resultat = await remplacerLogoPartenaire(partenaireId, donnees);

      if (!resultat.ok) {
        setErreur(resultat.error);
        return;
      }

      setFichier(null);
      setBilan(
        // 🔴 ON DIT LES DIMENSIONS RÉELLEMENT ÉCRITES, pas celles demandées : c'est la seule
        // façon que « redimensionné automatiquement » soit vérifiable par la personne qui
        // vient de cliquer.
        `Logo enregistré, redimensionné en ${resultat.data.largeur} × ${resultat.data.hauteur} pixels.` +
          (resultat.data.plusPetitQueLaBoite
            ? ` ⚠️ Le fichier d'origine faisait moins de ${LOGO_HAUTEUR} pixels de haut : il n'a ` +
              "PAS été agrandi (cela ne fabriquerait aucun détail et rendrait le logo flou). Il " +
              "apparaîtra donc plus petit que les autres dans le bandeau. Si c'est gênant, " +
              "demandez au partenaire un fichier plus grand."
            : "") +
          /* 🔴 SECOND AVERTISSEMENT, ET IL PORTE UN AUTRE FAIT — défaut trouvé en revue puis
             MESURÉ : une image très allongée (4000 × 96, ou son miroir 96 × 4000) ressort de
             la boîte canonique en 380 × 9 ou 2 × 96, c'est-à-dire un FILET illisible dans la
             tuile. Le redimensionnement a fait exactement ce qu'on lui demandait ; c'est le
             résultat qui est inutilisable, et rien ne le disait.
             ⚠️ Deux messages distincts et non un seul : « trop petit » et « trop étiré » sont
             deux problèmes différents, avec deux réponses différentes à demander au
             partenaire. Les fondre ferait un message qui ne dit ni l'un ni l'autre. */
          (resultat.data.filet
            ? ` ⚠️ Ce logo est très allongé (${resultat.data.largeur} × ${resultat.data.hauteur}) : ` +
              "il s'affichera comme un mince filet dans le bandeau, où il sera illisible. " +
              "Le redimensionnement a bien conservé ses proportions — c'est le format du " +
              "fichier d'origine qui ne convient pas. Demandez au partenaire une version " +
              "moins étirée, plus proche d'un rectangle."
            : ""),
      );
      router.refresh();
    } catch {
      // `exigerRoleAction()` LÈVE avant le `try` de la Server Action : la révocation immédiate
      // arrive ici, et nulle part ailleurs (leçon 6.3). Le `413` d'un fichier qui aurait
      // franchi la borne client y arrive aussi — il n'emprunte pas le retour discriminé.
      setErreur(
        "L'envoi a échoué. Deux causes possibles : le fichier est trop lourd, ou votre " +
          "session n'est plus valide — dans ce cas, rechargez la page et reconnectez-vous. " +
          "Rien n'a été enregistré.",
      );
    } finally {
      envoiEnCours.current = false;
      setEnCours(false);
    }
  }

  return (
    <div className={styles.form}>
      <ChampFichier
        id="partenaire-logo"
        label={aUnLogo ? "Remplacer le logo" : "Téléverser le logo"}
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={choisir}
        aide={
          <>
            JPEG, PNG, WebP ou AVIF, {formaterTaille(TAILLE_MAX_OCTETS)} maximum. Le fichier est{" "}
            <strong>
              automatiquement redimensionné à {LOGO_HAUTEUR} pixels de haut
            </strong>{" "}
            (au plus {LOGO_LARGEUR_MAX} de large), <strong>sans jamais être déformé</strong>, et
            converti en WebP. Les fichiers <strong>.svg</strong> ne sont pas acceptés, pour des
            raisons de sécurité — c&rsquo;est souvent le format envoyé par un partenaire :
            ouvrez-le et exportez-le en PNG.
          </>
        }
      />

      {erreur ? (
        <p className={styles.erreur} role="alert">
          {erreur}
        </p>
      ) : null}

      {bilan ? (
        <div className={styles.confirmation} role="status">
          <p>{bilan}</p>
        </div>
      ) : null}

      <div className={styles.actions}>
        {/* Jamais `disabled` — patron 5.1. Le libellé porte l'état. */}
        <Button type="button" onClick={envoyer}>
          {enCours ? "Envoi…" : aUnLogo ? "Remplacer le logo" : "Envoyer le logo"}
        </Button>

        {aUnLogo && !logoLivreAvecLeSite ? (
          <BoutonConfirmation
            libelle="Retirer le logo"
            question={`Retirer le logo de « ${nom} » ?`}
            precision={
              "Le fichier image sera DÉTRUIT sur le serveur. La fiche du partenaire, elle, " +
              "est conservée : il restera sur la page Partenaires, avec son nom à la place du " +
              "logo — mais il DISPARAÎTRA du bandeau de la page d'accueil, qui ne montre que " +
              "les partenaires ayant un logo."
            }
            onConfirmer={async () => {
              const resultat = await retirerLogoPartenaire(partenaireId);
              if (resultat.ok) router.refresh();
              return resultat.ok ? { ok: true } : { ok: false, error: resultat.error };
            }}
          />
        ) : null}
      </div>

      {logoLivreAvecLeSite ? (
        /* ⚠️ DIT PLUTÔT QUE TU : proposer « retirer » sur un fichier que le back-office ne
           peut pas détruire produirait un succès qui n'a rien produit — exactement le mode de
           défaillance que `retirerFichierSiDuVolume` existe pour empêcher côté serveur. */
        <p className={styles.avertissement} role="note">
          Ce logo fait partie des fichiers <strong>livrés avec le site</strong> : il n&rsquo;est
          pas stocké comme les logos téléversés et ne peut pas être retiré depuis cet écran.
          Vous pouvez en revanche le <strong>remplacer</strong> — le nouveau fichier prendra sa
          place, et le fichier d&rsquo;origine restera dans le site sans être utilisé.
        </p>
      ) : null}
    </div>
  );
}
