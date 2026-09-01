"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PhotoFrame } from "@repo/ui";
import type { GalleryPhoto } from "@/server/db/queries/photos";
import styles from "./Scrapbook.module.css";

/**
 * Galerie scrapbook + lightbox (Story 4.3, FR15, UX-DR13).
 *
 * Transcription de `.scrap` de la maquette (CSS l.166-172, markup l.415-420) : tirages de
 * 300px en `flex-wrap`, inclinés en alternance, redressés au survol.
 *
 * ══════════════════════════════════════════════════════════════════════════════════
 * 🔴 VARIANCE DÉCLARÉE — LA GRILLE EST CLIENTE, ALORS QUE L'AC LA VOULAIT RSC.
 * ══════════════════════════════════════════════════════════════════════════════════
 * L'AC6 de la story prescrivait « la grille scrapbook reste RSC ; seule la lightbox est
 * cliente ». Ce n'est pas tenable, et la raison est structurelle : **chaque vignette EST
 * un déclencheur**. Les découper en composants clients individuels exigerait un contexte
 * React partagé pour l'index ouvert — donc un fournisseur qui est LUI-MÊME une frontière
 * cliente autour du même sous-arbre. On paierait plus de code client pour le même
 * résultat.
 *
 * La règle de `project-context.md` §5 est respectée là où elle porte : `'use client'` est
 * sur le composant qui porte **réellement** l'interactivité, et **jamais sur un parent** —
 * `Gallery` (section, tête, `motion.reveal`) et `page.tsx` restent des Server Components.
 *
 * ⚠️ Et le rendu ne perd rien : un composant client est de toute façon **rendu côté
 * serveur** au premier paint. Sans JavaScript, les vignettes et leurs images sont donc
 * présentes et lisibles — seule la lightbox ne s'ouvre pas, ce qui est le comportement
 * voulu (AC6 : une lightbox est un enrichissement, pas le seul accès à l'image).
 * ⚠️ Aucune économie de charge utile n'était possible non plus : `filename`, `alt` et
 * `caption` doivent traverser vers le client de toute façon, pour la lightbox.
 */

/**
 * 🔴 `sizes` TIENT COMPTE DU RECADRAGE, ET C'EST LE PIÈGE CENTRAL DE CE COMPOSANT.
 *
 * Le cadre impose `aspect-ratio: 4/3` + `object-fit: cover`. Une source plus LARGE que
 * 4/3 est donc rognée sur les côtés : pour remplir une boîte de 276×207, une image en
 * 922×480 (1,92:1) est d'abord mise à l'échelle sur la HAUTEUR — 398×207 — puis rognée à
 * 276. Le navigateur a donc besoin de **398px CSS de source**, pas de 276.
 *
 * Écrire `sizes="276px"` ferait choisir une variante de 276px (552 en 2×), que le
 * navigateur devrait ensuite **agrandir** pour couvrir : une vignette floue, sans qu'aucune
 * porte ne le signale — ni lint, ni build, ni Lighthouse, ni le gate visuel à l'œil nu.
 *
 * 398 = 276 × (922 / 640), où 640 est la largeur utile après recadrage 4/3 d'une source de
 * 480px de haut. Mesuré sur le fichier réel, pas déduit.
 * ⇒ en 2× le navigateur demande ≥ 796px ; la source en fait 922. Ça passe, avec 126px de
 * marge. ⚠️ **Pas en 3×**, qui en exigerait 1194 : limite déclarée de la photo actuelle,
 * elle disparaîtra avec les originaux haute définition (dette R15).
 *
 * ⚠️ Valeur unique et non responsive : le cadre est borné à 300px à toutes les largeurs
 * (`max-width: 100%` le rétrécit en mobile, jamais l'inverse). 398px est donc un plafond
 * correct partout — légèrement généreux sur petit écran, ce qui erre du bon côté.
 */
const TAILLE_VIGNETTE = "398px";

/** La lightbox affiche l'image en `contain` : elle a besoin de la plus grande variante. */
const TAILLE_LIGHTBOX = "(max-width: 880px) 92vw, 80vw";

/**
 * 🔴 D'OÙ VIENNENT LES IMAGES — PROP AJOUTÉE PAR LA STORY 6.4, ET ELLE A UN 2ᵉ CONSOMMATEUR.
 *
 * La route publique `/medias/[filename]` filtre sur `is_published` et rend **404** sinon,
 * volontairement (l'absence et le refus doivent être indiscernables). L'écran d'aperçu du
 * back-office, lui, existe précisément pour regarder les photos **avant** de les publier :
 * sans cette prop, il afficherait des cadres cassés exactement sur celles qu'on veut voir.
 *
 * ⚠️ CE N'EST PAS UNE PROP « AU CAS OÙ » : elle est payée par `/admin/galerie/apercu`, qui
 * lit la route `/admin/medias` (distincte, gardée par `lireCompte()`, servie en `no-store`).
 * Le défaut reste la route publique, donc la home ne change pas d'un caractère.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 UN SEUL BOOLÉEN, ET NON UN PRÉFIXE LIBRE — PARCE QUE DEUX FAITS VOYAGENT ENSEMBLE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * La première version prenait un `prefixeMedia?: string`. Elle était **cassée**, et c'est le
 * gate visuel de Brice qui l'a vu : **aucune vignette d'administration ne s'affichait**.
 *
 * MESURÉ, et les deux `400` de l'optimiseur ne disent pas la même chose :
 *   · chemin hors `localPatterns` → *« "url" parameter is not allowed »* ;
 *   · `/admin/medias/…`          → *« The requested resource isn't a valid image. »*
 * Le motif était donc bien accepté. Ce qui échoue, c'est la récupération : **l'optimiseur
 * d'images de Next fait sa requête DEPUIS LE SERVEUR, sans le cookie de session**. Il reçoit
 * le `307 → /connexion` de la garde, pas une image. ⇒ **Aucune ressource protégée par une
 * session ne peut, par construction, passer par `/_next/image`.**
 *
 * ⚠️ ET C'EST TANT MIEUX POUR UNE AUTRE RAISON : une variante optimisée serait écrite dans le
 * cache d'images de Next (`.next/cache/images`). Optimiser un BROUILLON y déposerait une photo
 * que personne n'a décidé de rendre publique.
 *
 * ⇒ `sourceAdmin` porte donc les **deux** conséquences à la fois — d'où vient l'image ET le
 * fait qu'elle ne doit pas être optimisée. Un préfixe libre + un `unoptimized` séparé
 * laisserait poser l'un sans l'autre, c'est-à-dire re-fabriquer exactement ce défaut.
 */
const PREFIXE_PUBLIC = "/medias";
const PREFIXE_ADMIN = "/admin/medias";

export interface ScrapbookProps {
  /** Photos publiées, déjà triées par la requête. Peut être vide — voir l'état É7. */
  photos: GalleryPhoto[];
  /**
   * Rendu dans le back-office : les images viennent de `/admin/medias` (brouillons compris)
   * et **ne passent pas par l'optimiseur**. Voir le bloc ci-dessus — les deux vont ensemble.
   */
  sourceAdmin?: boolean;
}

/**
 * Légendes de contexte de l'état vide (É7), **verbatim de la maquette** (l.416-419).
 * ⚠️ Ce sont les libellés du placeholder de la maquette, pas du contenu inventé : ils
 * décrivent les occasions que l'asso photographie réellement.
 */
const PLACEHOLDERS = ["Game in Reims", "Soirée jeudi", "Tournoi", "L'équipe"] as const;

export function Scrapbook({ photos, sourceAdmin = false }: ScrapbookProps) {
  // Les deux faits sont dérivés du MÊME booléen : impossible de poser l'un sans l'autre.
  const prefixeMedia = sourceAdmin ? PREFIXE_ADMIN : PREFIXE_PUBLIC;
  // `null` = fermée. Sinon : index de la photo affichée.
  const [ouverte, setOuverte] = useState<number | null>(null);
  const declencheurs = useRef<(HTMLButtonElement | null)[]>([]);
  const dialogue = useRef<HTMLDivElement | null>(null);
  const fermeture = useRef<HTMLButtonElement | null>(null);
  const titreId = useId();

  const fermer = useCallback(() => setOuverte(null), []);

  /**
   * 🔴 LE FOCUS EST RESTITUÉ À LA VIGNETTE (UX-DR23, `EXPERIENCE.md` l.195). Sans cela la
   * fermeture renvoie le focus en tête de document, et l'utilisateur au clavier doit
   * re-parcourir toute la page pour revenir où il était.
   *
   * 🔴 PRÉCISION QUI N'EST PAS UN DÉTAIL, ET QUE `gate:lightbox` A FAIT TRANCHER :
   * c'est la vignette de la photo **DERNIÈRE AFFICHÉE**, pas celle qui a ouvert le
   * dialogue. Ouvrir la 1ʳᵉ photo, naviguer jusqu'à la 3ᵉ, puis fermer ramène donc sur
   * la 3ᵉ vignette.
   *
   * L'ARIA APG demande de rendre le focus « à l'élément qui a invoqué le dialogue », avec
   * une exception explicite quand le dialogue a changé le contexte. La navigation EST ce
   * changement : rendre le focus à la 1ʳᵉ vignette après avoir parcouru la galerie
   * désynchroniserait la position au clavier de ce que la personne vient de regarder, et
   * l'obligerait à re-naviguer pour se retrouver. Sans navigation, `ouverte` n'a pas
   * bougé et le comportement redevient exactement celui de l'APG.
   *
   * ⚠️ C'est ce que fait `indexPrecedent`, qui suit `ouverte` à CHAQUE changement et non
   * seulement à l'ouverture. Ne pas le « corriger » en mémorisant l'index d'ouverture :
   * ce serait défaire une décision, pas réparer un défaut.
   */
  const indexPrecedent = useRef<number | null>(null);
  useEffect(() => {
    if (ouverte === null && indexPrecedent.current !== null) {
      declencheurs.current[indexPrecedent.current]?.focus();
    }
    indexPrecedent.current = ouverte;
  }, [ouverte]);

  // À l'ouverture, le focus entre dans la boîte de dialogue (sur la fermeture, la
  // commande la plus sûre). Sans cela le focus resterait sur la vignette, DERRIÈRE
  // l'overlay : l'anneau de focus serait invisible et Tab sortirait immédiatement.
  useEffect(() => {
    if (ouverte !== null) fermeture.current?.focus();
  }, [ouverte]);

  const naviguer = useCallback(
    (pas: number) => {
      setOuverte((actuel) => {
        if (actuel === null || photos.length === 0) return actuel;
        // Modulo positif : on boucle dans les deux sens plutôt que de buter aux
        // extrémités. Une lightbox de 1 photo renvoie donc toujours sur elle-même —
        // les commandes sont alors masquées (voir le rendu), pas laissées mortes
        // (défaut réel attrapé par `gate:carousel` en Story 3.3).
        return (actuel + pas + photos.length) % photos.length;
      });
    },
    [photos.length],
  );

  /**
   * 🔴 PIÈGE DE FOCUS — la lightbox est un dialogue modal : tant qu'elle est ouverte, Tab
   * ne doit pas emmener derrière l'overlay (le reste de la page est inerte visuellement
   * mais pas pour le clavier). On boucle donc explicitement entre les éléments
   * focalisables du dialogue.
   *
   * ⚠️ La liste est recalculée à CHAQUE frappe et non mémorisée : les commandes
   * précédent/suivant n'existent pas quand il n'y a qu'une photo, donc une liste figée à
   * l'ouverture deviendrait fausse. C'est aussi ce qui la rend juste si un futur bouton
   * s'ajoute au dialogue.
   */
  const surTouche = useCallback(
    (evenement: React.KeyboardEvent<HTMLDivElement>) => {
      if (evenement.key === "Escape") {
        evenement.preventDefault();
        fermer();
        return;
      }
      if (evenement.key === "ArrowRight") {
        evenement.preventDefault();
        naviguer(1);
        return;
      }
      if (evenement.key === "ArrowLeft") {
        evenement.preventDefault();
        naviguer(-1);
        return;
      }
      if (evenement.key !== "Tab") return;

      const focalisables = dialogue.current?.querySelectorAll<HTMLElement>("button");
      if (!focalisables || focalisables.length === 0) return;
      const premier = focalisables[0]!;
      const dernier = focalisables[focalisables.length - 1]!;
      const actif = document.activeElement;

      if (evenement.shiftKey && actif === premier) {
        evenement.preventDefault();
        dernier.focus();
      } else if (!evenement.shiftKey && actif === dernier) {
        evenement.preventDefault();
        premier.focus();
      }
    },
    [fermer, naviguer],
  );

  // ⚠️ ÉTAT VIDE (É7, UX-DR20) : placeholders maîtrisés, JAMAIS une grille cassée ni un
  // trou. C'est littéralement l'état de la maquette, dont les quatre cadres portent ces
  // mêmes légendes de contexte. Aucune interactivité ici : rien à ouvrir.
  // 🔴 Différence assumée avec `ProofBand`, qui se rend `null` quand il n'a aucun logo :
  // un bloc de PREUVE sans preuve est un aveu, une galerie qui RACONTE peut dire « ça
  // arrive ». Et É7 nomme explicitement ce cas pour la galerie.
  if (photos.length === 0) {
    return (
      <ul className={styles.grille} aria-label="Photos à venir">
        {PLACEHOLDERS.map((legende) => (
          <li key={legende} className={styles.vignette}>
            <PhotoFrame caption={legende} />
          </li>
        ))}
      </ul>
    );
  }

  const active = ouverte === null ? null : photos[ouverte];

  return (
    <>
      <ul className={styles.grille}>
        {photos.map((photo, index) => (
          <li key={photo.id} className={styles.vignette}>
            {/* 🔴 UN <button>, ET JAMAIS UN <div onClick> NI UN <a href="#">.
                Un `href="#"` ferait un scroll-to-top et annoncerait une navigation qui
                n'a pas lieu — c'est la dette R2, déjà consignée sur ce projet.
                Le <button> est focalisable, actionnable à Entrée ET à Espace, et annoncé
                comme commande : rien de tout cela ne s'obtient avec un <div>. */}
            <button
              type="button"
              ref={(element) => {
                declencheurs.current[index] = element;
              }}
              className={styles.declencheur}
              onClick={() => setOuverte(index)}
              /* 🔴 LE NOM ACCESSIBLE COMMENCE PAR LE TEXTE VISIBLE — WCAG 2.5.3
                 (« Label in Name »), et c'est un DÉFAUT RÉEL trouvé par la mesure.
                 Une 1ʳᵉ version rendait `Agrandir la photo : <alt>`. Lighthouse
                 affichait **100/100** et pourtant l'audit `label-content-name-mismatch`
                 était en ÉCHEC : le seul texte VISIBLE du bouton est la légende du
                 cadre (« Entre deux games »), et elle n'apparaissait nulle part dans le
                 nom accessible. Conséquence concrète : une personne pilotant à la voix
                 qui prononce ce qu'elle LIT n'active pas le bouton.
                 ⚠️ Le score de 100 ne dit rien ici — cet audit n'est pas pondéré. C'est
                 la LISTE DES AUDITS EN ÉCHEC qu'il faut lire, pas la note
                 (`pieges/dette-invisible.md`).
                 Sans légende il n'y a aucun texte visible, donc aucune correspondance à
                 tenir : on décrit alors la photo, sinon le bouton n'aurait pas de nom. */
              aria-label={
                photo.caption
                  ? `${photo.caption} — agrandir la photo`
                  : `Agrandir la photo : ${photo.alt}`
              }
            >
              <PhotoFrame caption={photo.caption ?? undefined}>
                <Image
                  src={`${prefixeMedia}/${photo.filename}`}
                  alt=""
                  fill
                  sizes={TAILLE_VIGNETTE}
                  loading="lazy"
                  unoptimized={sourceAdmin}
                />
              </PhotoFrame>
            </button>
          </li>
        ))}
      </ul>

      {active ? (
        <div
          className={styles.overlay}
          // Clic HORS ZONE : on ne ferme que si la cible est l'overlay lui-même, pas un
          // de ses enfants — sinon un clic sur la photo fermerait la lightbox.
          onClick={(evenement) => {
            if (evenement.target === evenement.currentTarget) fermer();
          }}
          onKeyDown={surTouche}
          ref={dialogue}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titreId}
        >
          <div className={styles.boite}>
            <button
              type="button"
              ref={fermeture}
              className={styles.fermer}
              onClick={fermer}
              aria-label="Fermer la photo"
            >
              <span aria-hidden="true">×</span>
            </button>

            <div className={styles.media}>
              <Image
                src={`${prefixeMedia}/${active.filename}`}
                alt={active.alt}
                fill
                sizes={TAILLE_LIGHTBOX}
                className={styles.image}
                priority
                unoptimized={sourceAdmin}
              />
            </div>

            {/* Le titre accessible du dialogue. Toujours rendu (le `aria-labelledby` le
                référence), mais visuellement remplacé par la légende quand elle existe —
                une photo sans légende ne doit pas laisser le dialogue sans nom. */}
            <p id={titreId} className={active.caption ? styles.legende : "sr-only"}>
              {active.caption ?? active.alt}
            </p>

            {/* ⚠️ COMMANDES MASQUÉES À UNE SEULE PHOTO, pas laissées inertes : deux
                flèches qui ne mènent nulle part sont exactement le défaut que
                `gate:carousel` a trouvé en Story 3.3 (« deux flèches MORTES à une seule
                vignette »). Et c'est l'état RÉEL d'aujourd'hui — une photo en base. */}
            {photos.length > 1 ? (
              <div className={styles.commandes}>
                <button
                  type="button"
                  className={styles.nav}
                  onClick={() => naviguer(-1)}
                  aria-label="Photo précédente"
                >
                  <span aria-hidden="true">←</span>
                </button>
                <span className={styles.compteur}>
                  {ouverte! + 1} / {photos.length}
                </span>
                <button
                  type="button"
                  className={styles.nav}
                  onClick={() => naviguer(1)}
                  aria-label="Photo suivante"
                >
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
