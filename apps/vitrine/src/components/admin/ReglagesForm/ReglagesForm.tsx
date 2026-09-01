"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@repo/ui";

import { ChampTexte } from "@/components/admin/ChampTexte/ChampTexte";
import {
  CHAMPS_URL,
  EMAIL_MAX,
  URL_MAX,
  siteSettingInputSchema,
} from "@/lib/schemas/site-setting";
import { enregistrerReglages } from "@/server/actions/reglages";
import styles from "@/styles/admin-form.module.css";

/**
 * Les six réglages du site (Story 6.13, FR38).
 *
 * Reprend LITTÉRALEMENT le patron de saisie posé par `EventForm` (6.3) et repayé par
 * `PhotoForm`, `PartenaireForm`, `AtelierForm` et `MembreForm` :
 *   · tous les champs CONTRÔLÉS — React 19 réinitialise les champs non contrôlés d'un
 *     `<form action={fn}>` après résolution de l'action, succès COMME échec (défaut réel de la
 *     Story 5.1). Ne pas « simplifier » en repassant en non contrôlé ;
 *   · validation CLIENT avec le MÊME schéma Zod que le serveur, pour que le focus au premier
 *     champ en erreur n'attende pas un aller-retour réseau — le serveur re-valide quand même ;
 *   · focus au premier champ en erreur dans l'ordre VISUEL ;
 *   · bouton JAMAIS `disabled` pendant l'attente (patron 5.1) : le libellé porte l'état.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 CE FORMULAIRE A LE PLUS GRAND RAYON DE DÉGÂTS DU BACK-OFFICE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * Les six autres surfaces écrivent des lignes qu'on publie une par une, avec un aperçu avant
 * publication. Celle-ci **n'a pas de brouillon** : ce qui est enregistré est en ligne au
 * rechargement suivant, dans le **header et le footer des 5 pages**. D'où deux choix :
 *
 *   · l'avertissement est **AU-DESSUS** du bouton et dit ce qui va se passer, pas ce qui
 *     s'est passé ;
 *   · **chaque champ vide le DIT** (`AideVide` ci-dessous) — c'est le seul rappel de la dette
 *     **R29** qui survivra au go-live, et la dette **R15** documente exactement ce qu'on perd
 *     quand un placeholder disparaît sans rien laisser derrière lui.
 *
 * 🔴 **IL N'Y A PAS D'APERÇU, ET C'EST DÉLIBÉRÉ** : le rendu de ces valeurs, c'est **le site
 * lui-même**, immédiatement, sur n'importe quelle page. Un écran d'aperçu serait une SECONDE
 * implémentation du header et du footer — donc une divergence garantie. Les six autres sections
 * ont un `apercu/` parce que leur rendu vit sur une page qu'on ne peut pas voir sans publier.
 */

/** Ordre VISUEL des champs — c'est lui qui décide où va le focus. */
const ORDRE_CHAMPS = [...CHAMPS_URL.map((c) => c.cle), "contactEmail"] as const;

type EtatForm = {
  statut: "vierge" | "succes" | "erreur";
  error?: string;
  fieldErrors?: Record<string, string>;
};

const ETAT_INITIAL: EtatForm = { statut: "vierge" };

export interface ReglagesFormProps {
  /**
   * Les valeurs en base, **`null` compris** — d'où `lireReglagesPourSaisie` et non
   * `lireReglages` : cet écran a besoin de savoir qu'une colonne est VIDE, là où le rendu n'a
   * besoin que de savoir qu'elle est « absente ».
   */
  reglages: {
    discordUrl: string | null;
    instagramUrl: string | null;
    xUrl: string | null;
    linkedinUrl: string | null;
    helloassoUrl: string | null;
    contactEmail: string;
    /** Les trois photos du site, ou `null` — Story 7.3. */
    heroPhotoId: string | null;
    quotePhotoId: string | null;
    ogPhotoId: string | null;
  };

  /**
   * Les photos parmi lesquelles choisir celle de l'accueil (Story 7.3).
   *
   * 🔴 SEULEMENT LES PHOTOS PUBLIÉES, ET C'EST UNE GARDE. La route `/medias/[filename]`
   * ne sert QUE les médias publiés — mesuré le 2026-09-01, un brouillon y rend **404**.
   * Proposer un brouillon ici laisserait choisir une photo qui ne s'afficherait pas, et
   * l'écran de réglages annoncerait un choix enregistré pendant que l'accueil rendrait un
   * cadre vide. ⇒ Ce qu'on ne peut pas afficher ne se propose pas.
   */
  photos: readonly { id: string; alt: string }[];
}

/**
 * La mention affichée sous un champ d'URL **vide**.
 *
 * ⚠️ Elle est **DÉRIVÉE DE LA VALEUR SAISIE**, jamais écrite en dur : elle apparaît et disparaît
 * toute seule, et elle sera vraie tant que le champ le sera. Même patron que l'avertissement
 * SMTP de la Story 6.11, qui MESURE l'environnement au lieu d'affirmer « les e-mails ne partent
 * pas » — une phrase en dur est vraie aujourd'hui et fausse demain, et rien ne la corrigera.
 */
function aideDuChamp(base: string, valeur: string): string {
  return valeur.trim() === ""
    ? `${base} Tant que ce champ est vide, le lien n'apparaît nulle part sur le site — ni dans le pied de page, ni dans le menu.`
    : base;
}

export function ReglagesForm({ reglages, photos }: ReglagesFormProps) {
  const router = useRouter();

  const [valeurs, setValeurs] = useState({
    discordUrl: reglages.discordUrl ?? "",
    instagramUrl: reglages.instagramUrl ?? "",
    xUrl: reglages.xUrl ?? "",
    linkedinUrl: reglages.linkedinUrl ?? "",
    helloassoUrl: reglages.helloassoUrl ?? "",
    contactEmail: reglages.contactEmail,
    heroPhotoId: reglages.heroPhotoId ?? "",
    quotePhotoId: reglages.quotePhotoId ?? "",
    ogPhotoId: reglages.ogPhotoId ?? "",
  });

  const changer = (cle: keyof typeof valeurs) => (valeur: string) =>
    setValeurs((precedent) => ({ ...precedent, [cle]: valeur }));

  const [etat, soumettre, enCours] = useActionState(
    async (_precedent: EtatForm, formData: FormData): Promise<EtatForm> => {
      const analyse = siteSettingInputSchema.safeParse({
        discordUrl: formData.get("discordUrl"),
        instagramUrl: formData.get("instagramUrl"),
        xUrl: formData.get("xUrl"),
        linkedinUrl: formData.get("linkedinUrl"),
        helloassoUrl: formData.get("helloassoUrl"),
        contactEmail: formData.get("contactEmail"),
      });

      if (!analyse.success) {
        const fieldErrors: Record<string, string> = {};
        for (const souci of analyse.error.issues) {
          const clef = souci.path[0];
          if (typeof clef === "string" && !(clef in fieldErrors)) fieldErrors[clef] = souci.message;
        }
        return {
          statut: "erreur",
          error: analyse.error.issues[0]?.message ?? "Le formulaire contient une erreur.",
          fieldErrors,
        };
      }

      try {
        const resultat = await enregistrerReglages(formData);
        if (!resultat.ok) {
          return { statut: "erreur", error: resultat.error, fieldErrors: resultat.fieldErrors };
        }
        // Ne concerne que le cache ROUTEUR du navigateur : les 5 pages publiques sont
        // `force-dynamic`, il n'y a AUCUN cache de données à invalider.
        router.refresh();
        return { statut: "succes" };
      } catch {
        // 🔴 `exigerRoleAction()` s'exécute AVANT le `try` de la Server Action et **LÈVE** : une
        // session expirée ou un compte retiré de l'allowlist arrive ici, et nulle part ailleurs.
        // La saisie reste dans le DOM (champs contrôlés) : jamais perdre ce qui a été tapé.
        return {
          statut: "erreur",
          error:
            "Votre session n'est plus valide, ou le réseau a échoué. Rechargez la page et " +
            "reconnectez-vous — ce que vous avez tapé est toujours à l'écran.",
        };
      }
    },
    ETAT_INITIAL,
  );

  useEffect(() => {
    if (!etat.fieldErrors) return;
    const premier = ORDRE_CHAMPS.find((champ) => etat.fieldErrors?.[champ]);
    if (premier) document.getElementById(`reglage-${premier}`)?.focus();
  }, [etat.fieldErrors]);

  const erreurs = etat.fieldErrors ?? {};

  return (
    <form action={soumettre} className={styles.form} noValidate>
      {CHAMPS_URL.map(({ cle, libelle, aide }) => (
        <ChampTexte
          key={cle}
          id={`reglage-${cle}`}
          name={cle}
          label={`${libelle} (facultatif)`}
          valeur={valeurs[cle]}
          onChange={changer(cle)}
          max={URL_MAX}
          aide={aideDuChamp(
            `${aide} L'adresse complète, en commençant par https://`,
            valeurs[cle],
          )}
          erreur={erreurs[cle]}
        />
      ))}

      <ChampTexte
        id="reglage-contactEmail"
        name="contactEmail"
        label="E-mail de contact (obligatoire)"
        valeur={valeurs.contactEmail}
        onChange={changer("contactEmail")}
        max={EMAIL_MAX}
        aide="L'adresse affichée en pied de page, et celle qui reçoit les demandes envoyées par le formulaire du site."
        erreur={erreurs.contactEmail}
        autoComplete="off"
      />

      {/* ══════════════════════════════════════════════════════════════════════════════
          LA PHOTO DE LA PAGE D'ACCUEIL — STORY 7.3
          ══════════════════════════════════════════════════════════════════════════════
          🔴 ELLE ÉTAIT ÉCRITE EN DUR dans le code (`/photos/soiree-bar-eds-01.avif`,
          922×480, posée hors story le 2026-07-28). Le commentaire de `Hero.tsx` annonçait
          lui-même son remplaçant : « ce qui manque : une photo HD, l'optimisation Next, et
          le passage par le back-office ».

          ⚠️ UN `<select>` ET NON UNE GRILLE DE VIGNETTES : la liste des photos publiées se
          compte en dizaines, chacune porte déjà un texte alternatif qui la décrit, et une
          grille demanderait de charger autant d'images pour un choix qu'on fait deux fois
          par an. ⇒ Ce qu'on ajoute est proportionné à l'usage, pas à l'envie.
          ⚠️ Le cadrage, lui, se règle SUR LA PHOTO (galerie → point focal), pas ici : deux
          écrans pour deux questions — « laquelle » et « cadrée comment ». */}
      <div className={styles.champ}>
        <label className={styles.label} htmlFor="reglage-heroPhotoId">
          Photo de la page d&rsquo;accueil (facultatif)
        </label>
        <select
          id="reglage-heroPhotoId"
          name="heroPhotoId"
          className={styles.saisie}
          value={valeurs.heroPhotoId}
          // `changer` est taillé pour `ChampTexte`, qui remonte la VALEUR ; un <select>
          // natif remonte l'ÉVÉNEMENT. On extrait donc `target.value` ici plutôt que
          // d'élargir le helper — l'élargir aurait fait accepter les deux formes partout,
          // et une erreur d'appel serait passée sans bruit.
          onChange={(evenement) => changer("heroPhotoId")(evenement.target.value)}
        >
          <option value="">
            Aucune — garder la photo d&rsquo;origine du site
          </option>
          {photos.map((cliche) => (
            <option key={cliche.id} value={cliche.id}>
              {cliche.alt}
            </option>
          ))}
        </select>
        <p className={styles.sousChamp}>
          <span>
            Seules les photos <strong>publiées</strong> de la galerie apparaissent
            ici&nbsp;: une photo en brouillon ne s&rsquo;afficherait pas sur le site.
            Le cadrage se règle sur la photo elle-même, dans la galerie.
          </span>
        </p>
      </div>

      {/* ⚠️ MÊME MOTIF, DEUX CADRES QUI N'ONT RIEN EN COMMUN — et c'est pour ça que ce
          sont trois réglages et non un seul. Le hero est un 4/3 vertical dans une colonne
          étroite ; la bande est un bandeau panoramique sous un voile ; l'image de partage
          se choisit pour ce qu'elle DIT DE L'ASSO à quelqu'un qui ne la connaît pas. Une
          photo qui sert bien l'un dessert souvent les autres. */}
      <div className={styles.champ}>
        <label className={styles.label} htmlFor="reglage-quotePhotoId">
          Photo de la bande citation (facultatif)
        </label>
        <select
          id="reglage-quotePhotoId"
          name="quotePhotoId"
          className={styles.saisie}
          value={valeurs.quotePhotoId}
          onChange={(evenement) => changer("quotePhotoId")(evenement.target.value)}
        >
          <option value="">Aucune — garder le fond dégradé</option>
          {photos.map((cliche) => (
            <option key={cliche.id} value={cliche.id}>
              {cliche.alt}
            </option>
          ))}
        </select>
        <p className={styles.sousChamp}>
          <span>
            Elle s&rsquo;affiche en <strong>pleine largeur</strong>, sous un voile sombre
            qui garde la citation lisible. Une photo très large convient mieux qu&rsquo;un
            portrait.
          </span>
        </p>
      </div>

      <div className={styles.champ}>
        <label className={styles.label} htmlFor="reglage-ogPhotoId">
          Image de partage (facultatif)
        </label>
        <select
          id="reglage-ogPhotoId"
          name="ogPhotoId"
          className={styles.saisie}
          value={valeurs.ogPhotoId}
          onChange={(evenement) => changer("ogPhotoId")(evenement.target.value)}
        >
          <option value="">Aucune — le nom de l&rsquo;asso sur fond de charte</option>
          {photos.map((cliche) => (
            <option key={cliche.id} value={cliche.id}>
              {cliche.alt}
            </option>
          ))}
        </select>
        <p className={styles.sousChamp}>
          <span>
            C&rsquo;est l&rsquo;image qui apparaît quand un lien du site est collé dans
            <strong> Discord</strong> ou sur les réseaux. Sans photo, le nom de
            l&rsquo;association s&rsquo;affiche sur le fond de la charte&nbsp;: il y a
            toujours une image.
          </span>
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════════
          🔴 CE QUI EST EN JEU, RAPPELÉ AU POINT DE SAISIE — PAS DANS UNE DOC
          ══════════════════════════════════════════════════════════════════════════════
          Deux faits que le formulaire ne peut pas empêcher mécaniquement :
            · ces valeurs ne passent PAS par un brouillon, contrairement à tout le reste du
              back-office. Le dire avant le geste, pas après ;
            · l'e-mail de contact ne change PAS le compte qui envoie les e-mails du site.
              C'est contre-intuitif, et le taire ferait chercher une panne au mauvais endroit
              (voir `server/mail/client.ts`). */}
      <p className={styles.regle} role="note">
        <strong>Ces réglages n&rsquo;ont pas de brouillon.</strong> Dès que vous enregistrez,
        le changement est visible sur <strong>toutes les pages du site</strong> au rechargement
        suivant — c&rsquo;est la seule section du back-office dans ce cas.
        <br />
        Un champ <strong>vidé</strong> retire le lien partout, proprement : il ne reste ni
        bouton mort, ni adresse qui ne mène nulle part. C&rsquo;est le bon geste quand un compte
        est fermé.
        <br />
        ⚠️ L&rsquo;<strong>e-mail de contact</strong> est l&rsquo;adresse <em>affichée</em> et
        celle qui <em>reçoit</em> les demandes. Il ne change pas le compte depuis lequel le site{" "}
        <em>envoie</em> ses messages : celui-là est réglé une fois pour toutes côté serveur, et
        le modifier demande une intervention technique.
      </p>

      {etat.statut === "erreur" && etat.error ? (
        <p className={styles.erreur} role="alert">
          {etat.error}
        </p>
      ) : null}

      {etat.statut === "succes" ? (
        <div className={styles.confirmation} role="status">
          <p>
            Enregistré. Le site est à jour au rechargement suivant — ouvrez n&rsquo;importe
            quelle page pour le vérifier.
          </p>
        </div>
      ) : null}

      <div className={styles.actions}>
        {/* Jamais `disabled` — patron 5.1 : un bouton grisé pendant une latence réseau donne
            l'impression d'une page morte. */}
        <Button type="submit">{enCours ? "Enregistrement…" : "Enregistrer les réglages"}</Button>
        <Link className={styles.lien} href="/admin">
          Retour au tableau de bord
        </Link>
      </div>
    </form>
  );
}
