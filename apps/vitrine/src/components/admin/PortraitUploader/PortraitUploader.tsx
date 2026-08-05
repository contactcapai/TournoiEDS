"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@repo/ui";

import { BoutonConfirmation } from "@/components/admin/BoutonConfirmation/BoutonConfirmation";
import { ChampFichier } from "@/components/admin/ChampFichier/ChampFichier";
import { PORTRAIT_COTE } from "@/lib/portraits";
import { remplacerPortraitMembre, retirerPortraitMembre } from "@/server/actions/membres";
import styles from "@/styles/admin-form.module.css";

/**
 * Téléversement, REMPLACEMENT et retrait du portrait d'un membre (Story 6.10).
 *
 * Patron `LogoUploader` (6.5), repris parce que le besoin est le même : **une personne change
 * de photo**, et son entrée — prénom, rôle, rang, publication — doit lui survivre. Obliger à
 * supprimer puis recréer ferait perdre tout le reste pour changer un fichier. C'est le
 * raisonnement exact que `PhotoForm` (6.4) refuse pour une photo de soirée, qui elle « ne se
 * met pas à jour ».
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE QUI DIFFÈRE DU LOGO, ET CE N'EST PAS COSMÉTIQUE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * ① **RETIRER UN PORTRAIT NE CASSE RIEN À L'ÉCRAN.** Retirer un logo faisait sortir le
 *    partenaire du bandeau de l'accueil — une conséquence qu'il fallait annoncer. Ici la carte
 *    reste, **à la même place et à la même taille** : elle rend simplement la silhouette. Le
 *    texte de confirmation le dit, parce que c'est rassurant et non évident.
 * ② **IL N'Y A PAS DE CAS « LIVRÉ AVEC LE SITE ».** Aucun portrait ne vit dans `public/`
 *    (`lib/portraits.ts`), donc pas de prop `logoLivreAvecLeSite`, pas de branche, pas
 *    d'avertissement. L'ajouter « par symétrie » ferait croire à un cas qui n'existe pas.
 * ③ **LE FICHIER EST UNE DONNÉE PERSONNELLE.** La confirmation de retrait dit « DÉTRUIT », au
 *    présent et sans euphémisme : c'est ce que quelqu'un qui demande le retrait de sa photo a
 *    le droit d'obtenir.
 */

/**
 * ⚠️ 8 Mo — entre la borne des logos (5 Mo) et celle de la galerie (10 Mo), et l'écart est
 * voulu : un portrait sort souvent d'un téléphone, donc plus lourd qu'un fichier de marque,
 * mais il n'a pas besoin de la latitude d'une photo de soirée que R15 veut en haute définition.
 * ⚠️ **Strictement inférieure à la borne serveur** (12 Mo, `next.config.ts`) : le multipart
 * transporte plus que l'octet du fichier, et sans marge un fichier accepté ici repartirait en
 * `413` — un refus qui tombe AVANT le corps de l'action, donc sans message écrit par nous.
 */
const TAILLE_MAX_OCTETS = 8 * 1024 * 1024;

function formaterTaille(octets: number): string {
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

export interface PortraitUploaderProps {
  membreId: string;
  /** Prénom du membre — sert le nom accessible des boutons et la confirmation. */
  prenom: string;
  /** `true` si un portrait est déjà en place : le vocabulaire de l'écran change. */
  aUnPortrait: boolean;
}

export function PortraitUploader({ membreId, prenom, aUnPortrait }: PortraitUploaderProps) {
  const router = useRouter();

  const [fichier, setFichier] = useState<File | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [bilan, setBilan] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  /**
   * 🔴 GARDE DE RÉ-ENTRÉE — MÊME RAISON QU'EN 6.4 ET 6.5.
   *
   * Le bouton n'est jamais `disabled` (patron 5.1). Sans garde, un second clic pendant l'envoi
   * rappellerait `envoyer()` avec le même `File` : **deux normalisations, deux fichiers
   * distincts sur le volume**, et la seconde mise à jour écraserait `portrait` en laissant le
   * premier fichier orphelin — que l'unicité de `member_portrait_unique` ne peut pas voir,
   * puisque les deux noms diffèrent.
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
          `${formaterTaille(TAILLE_MAX_OCTETS)}. Il n'a pas été envoyé — réexportez la photo ` +
          "en plus petit, ou choisissez-en une autre.",
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
      const resultat = await remplacerPortraitMembre(membreId, donnees);

      if (!resultat.ok) {
        setErreur(resultat.error);
        return;
      }

      setFichier(null);
      setBilan(
        // 🔴 ON DIT LES DIMENSIONS RÉELLEMENT ÉCRITES, pas celles demandées : c'est la seule
        // façon que « redimensionné automatiquement » soit vérifiable par la personne qui
        // vient de cliquer.
        `Portrait enregistré, redimensionné en ${resultat.data.largeur} × ${resultat.data.hauteur} pixels.` +
          (resultat.data.plusPetitQueLaBoite
            ? ` ⚠️ Le fichier d'origine faisait moins de ${PORTRAIT_COTE} pixels de côté : il n'a ` +
              "PAS été agrandi (cela ne fabriquerait aucun détail et rendrait la photo floue). " +
              "Elle apparaîtra donc moins nette que les autres. Si c'est gênant, demandez une " +
              "photo plus grande."
            : "") +
          /* 🔴 SECOND AVERTISSEMENT, ET IL PORTE UN AUTRE FAIT — leçon mesurée en 6.5 : une
             image très allongée ressort de la boîte canonique en filet, et le cadre carré
             devrait l'étirer pour la remplir. Le redimensionnement a fait exactement ce qu'on
             lui demandait ; c'est le résultat qui est inutilisable, et rien ne le disait.
             ⚠️ Deux messages distincts et non un seul : « trop petite » et « trop étirée » sont
             deux problèmes différents, avec deux réponses différentes. */
          (resultat.data.filet
            ? ` ⚠️ Cette photo est très allongée (${resultat.data.largeur} × ${resultat.data.hauteur}) : ` +
              "le cadre de la carte est carré, elle y sera donc fortement recadrée et pourra " +
              "paraître déformée. Les proportions du fichier ont bien été conservées — c'est " +
              "le cadrage d'origine qui ne convient pas. Recadrez-la plus près du carré."
            : ""),
      );
      router.refresh();
    } catch {
      // `requireAdmin()` LÈVE avant le `try` de la Server Action : la révocation immédiate
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
        id="membre-portrait"
        label={aUnPortrait ? "Remplacer le portrait" : "Téléverser un portrait"}
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={choisir}
        aide={
          <>
            JPEG, PNG, WebP ou AVIF, {formaterTaille(TAILLE_MAX_OCTETS)} maximum. Le fichier est{" "}
            <strong>
              automatiquement redimensionné dans un carré de {PORTRAIT_COTE} pixels
            </strong>
            , <strong>sans jamais être déformé</strong>, et converti en WebP. Le portrait est{" "}
            <strong>facultatif</strong> : sans lui, la carte affiche une silhouette, à la même
            place et à la même taille.
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
          {enCours ? "Envoi…" : aUnPortrait ? "Remplacer le portrait" : "Envoyer le portrait"}
        </Button>

        {aUnPortrait ? (
          <BoutonConfirmation
            libelle="Retirer le portrait"
            question={`Retirer le portrait de « ${prenom} » ?`}
            precision={
              "Le fichier image sera DÉTRUIT sur le serveur — c'est une photo de personne, " +
              "elle ne doit pas rester quelque part sans raison. La fiche du membre, elle, est " +
              "conservée : la carte restera exactement à sa place sur la page « L'asso », avec " +
              "une silhouette à la place de la photo."
            }
            onConfirmer={async () => {
              const resultat = await retirerPortraitMembre(membreId);
              if (resultat.ok) router.refresh();
              return resultat.ok ? { ok: true } : { ok: false, error: resultat.error };
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
