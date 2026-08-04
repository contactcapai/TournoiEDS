"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";

import { sourceLogo } from "@/lib/logos";
import styles from "./PartnerMarquee.module.css";

// Bandeau de logos partenaires (Story 4.1) — home uniquement.
//
// 🔴 SEUL CE COMPOSANT EST CLIENT (project-context.md §5). `ProofBand`, qui l'enveloppe,
// reste un Server Component : la frontière est posée sur le composant qui porte
// RÉELLEMENT l'interactivité, jamais sur un parent. Patron SiteHeader / MobileMenu.
// Il ne requête pas la base — les tuiles arrivent en props depuis `page.tsx`.
//
// ═══════════════ POURQUOI CE MONTAGE, ET PAS UN MARQUEE ORDINAIRE ═══════════════
//
// 🔴 ① L'ÉTAT SERVI EST UN MUR ENVELOPPÉ, L'ANIMATION N'ARRIVE QU'APRÈS HYDRATATION.
// WCAG 2.2.2 exige qu'un contenu qui bouge seul plus de 5 s puisse être ARRÊTÉ. Un
// bandeau animé par le seul CSS tournerait donc sans JavaScript, avec un bouton de pause
// qui, lui, en a besoin — non conforme, et de la pire manière : invisible à toutes nos
// portes. Ici l'animation et sa commande apparaissent ENSEMBLE, au montage. Sans JS,
// rien ne bouge et rien n'est inatteignable : la conformité ne dépend pas de
// l'hydratation, elle est vraie par construction.
//
// 🔴 ② ON N'ANIME QUE CE QUI DÉBORDE. Si la largeur naturelle des tuiles tient dans le
// cadre, le bandeau reste un mur statique et le bouton de pause N'EST PAS RENDU (rien ne
// bouge ⇒ rien à arrêter ⇒ une commande de plus serait une commande morte — défaut réel
// attrapé par `gate:carousel` en Story 3.3). Avec les 4 logos d'aujourd'hui, cela veut
// dire STATIQUE en desktop et DÉFILANT en mobile : deux régimes sur la même page. Ce
// n'est pas un défaut, c'est la règle qui s'applique.
//
// 🔴 ③ SOUS `prefers-reduced-motion: reduce`, ON REPASSE EN MUR — et pas seulement
// `animation: none`. Couper l'animation en laissant la piste sur une ligne laisserait
// tous les logos au-delà de la première largeur d'écran ROGNÉS et INATTEIGNABLES (le
// cadre est en `overflow: clip`, donc non défilable) : à 320px la piste fait ~682px pour
// ~268px de place, plus de la moitié des logos disparaîtrait. Ce serait une PERTE DE
// CONTENU, pas une neutralisation (patron UX-DR29, Story 2.1).
//
// 🔴 ④ LES TUILES NE SONT PAS DES LIENS. Une piste rognée et en mouvement ferait
// atterrir le focus clavier sur une tuile hors champ, que rien ne pourrait ramener —
// échec WCAG 2.4.7 / 2.4.11. Le SEUL élément focalisable du bandeau est le bouton de
// pause. Les tuiles cliquables d'UX-DR12 sont livrées sur `/partenaires` (Story 4.2),
// où la page ne bouge pas.
//
// ⚠️ Aucune de ces quatre propriétés n'est vue par `lint`, `typecheck`, `build`,
// Lighthouse (qui n'audite PAS 2.2.2) ni la porte `gate` (dont la sonde de débordement
// ne retient que les éléments à `textContent` non vide — donc aveugle à une piste
// d'`<img>`). C'est la configuration exacte de la dette R19. D'où `gate:marquee`.

export interface PartnerMarqueeTile {
  id: string;
  name: string;
  /** Chemin du logo. Non nul par construction : la requête filtre `logo IS NOT NULL`. */
  logo: string;
}

export interface PartnerMarqueeProps {
  tiles: PartnerMarqueeTile[];
  /** Nom accessible de la liste de logos. */
  label: string;
  /**
   * 🔴 RENDU DANS LE BACK-OFFICE (Story 6.5) — LES DEUX FAITS VOYAGENT ENSEMBLE.
   *
   * Les logos viennent de `/admin/medias/logos/` (partenaires non publiés compris) **et** ne
   * passent pas par l'optimiseur. Un préfixe libre + un `unoptimized` séparé laisserait poser
   * l'un sans l'autre — c'est-à-dire refabriquer le défaut de la 6.4, où AUCUNE vignette ne
   * s'affichait parce que `/_next/image` requête depuis le serveur, sans cookie de session.
   * Le raisonnement complet vit dans `lib/logos.ts`.
   *
   * ⚠️ Défaut `false` : la home ne change pas d'un caractère.
   */
  sourceAdmin?: boolean;
}

/**
 * Vitesse de défilement, en pixels par seconde.
 *
 * 🔴 C'est la VITESSE qui est constante, pas la durée : la durée est calculée à partir de
 * la largeur réellement mesurée (voir `mesurer`). Une durée fixe ferait accélérer le
 * bandeau à chaque logo ajouté — avec les 7 fichiers manquants, il finirait par défiler
 * presque trois fois plus vite sans que personne n'ait rien changé.
 *
 * 40 px/s : assez lent pour qu'un logo reste lisible en passant (une tuile de 160px met
 * 4 s à traverser), assez vivant pour qu'on voie que le réseau tourne. Pas de token de
 * durée d'animation : décision reconduite de la Story 2.10 (un seul consommateur).
 */
const VITESSE_PX_PAR_S = 40;

export function PartnerMarquee({ tiles, label, sourceAdmin = false }: PartnerMarqueeProps) {
  const cadre = useRef<HTMLDivElement>(null);
  const piste = useRef<HTMLUListElement>(null);
  /**
   * 🔴 `false` AU PREMIER RENDU CLIENT COMME AU RENDU SERVEUR — c'est ce qui rend le
   * montage sûr : aucune discordance d'hydratation, et l'état servi est bien le mur.
   */
  const [defile, setDefile] = useState(false);
  const [duree, setDuree] = useState(0);
  const [enPause, setEnPause] = useState(false);

  /**
   * Largeur qu'occuperait UNE copie des tuiles sur UNE SEULE LIGNE.
   *
   * 🔴 CETTE MESURE NE PASSE PAS PAR `cadre.scrollWidth`, ET C'EST LE PIÈGE CENTRAL DU
   * PROJET : le cadre est en `overflow: clip`, ce qui EMPÊCHE la zone défilable de
   * croître — `scrollWidth` y reste donc égal à `clientWidth` même quand la piste
   * déborde largement (prouvé le 2026-07-29 par `gate:selftest` sur un bloc de 3000px
   * dans un viewport de 800px : 800/800). Les « 21/21 ✅ » des Stories 2.8 et 2.10 ne
   * mesuraient rien pour cette raison.
   *
   * 🔴 ELLE NE PEUT PAS NON PLUS SE CONTENTER DE SOMMER LES BOÎTES RENDUES : dans le
   * régime MUR les tuiles GRANDISSENT (`flex: 1 1 150px` → jusqu'à 210px, la maquette),
   * si bien que leur largeur rendue vaut jusqu'à 40 % de plus que leur largeur naturelle.
   * Un premier jet a sommé les boîtes rendues et a dû, pour rester juste, figer les
   * tuiles à une largeur commune — ce que Garde-fou H interdit explicitement, et qui
   * rendait le mur desktop maigre. C'était l'instrument qui déformait le rendu.
   *
   * 🔴 ON APPLIQUE DONC LA CLASSE `piste_defile` LE TEMPS D'UNE LECTURE, puis on la
   * retire. Pas un bricolage de styles inline : c'est exactement la géométrie que la
   * piste AURA, définie une seule fois dans la feuille de style.
   *
   * ⚠️ POURQUOI DES STYLES INLINE `nowrap` + `max-content` NE SUFFISENT PAS — mesuré,
   * pas déduit. Un premier jet faisait cela et lisait **2px par tuile** au lieu de
   * 150px. Cause : dans un conteneur de taille indéfinie (`max-content`), un item
   * `flex-shrink: 1` contribue sa taille de CONTENU, pas sa base — et le contenu d'une
   * tuile est vide, le logo étant en `position: absolute`. Il ne restait que les
   * bordures. La largeur naturelle sortait à 50px au lieu de 642px, le bandeau
   * concluait « ça tient » à TOUTES les largeurs, et LE BOUTON DE PAUSE DISPARAISSAIT
   * EN MOBILE — une régression d'accessibilité née d'une erreur de mesure.
   * `.piste_defile .tuile` pose `flex: 0 0 150px` (shrink NUL), ce qui rend la
   * contribution égale à la base. C'est ce qui rend la lecture juste.
   *
   * ⚠️ Mutation puis restauration dans le MÊME tour synchrone : le navigateur ne peint
   * jamais l'état intermédiaire, et React ne re-rend pas entre les deux. Ne pas y
   * insérer d'`await`.
   */
  const mesurerLargeurNaturelle = useCallback(
    (rail: HTMLUListElement) => {
      // Si on est DÉJÀ en piste, ne pas retirer la classe en sortant.
      const dejaPiste = rail.classList.contains(styles.piste_defile!);
      if (!dejaPiste) rail.classList.add(styles.piste_defile!);

      // Les `tiles.length` premiers enfants = la copie qui porte les vrais `alt`. En
      // régime piste il y en a le double dans le DOM ; on ne mesure qu'UNE copie.
      const uneCopie = Array.from(rail.children).slice(0, tiles.length);
      // La gouttière est lue dans le style calculé et non recopiée du CSS — une valeur
      // en double divergerait au premier ajustement (patron `PastCarousel`).
      const gouttiere = Number.parseFloat(getComputedStyle(rail).columnGap) || 0;
      const naturelle =
        uneCopie.reduce((somme, el) => somme + el.getBoundingClientRect().width, 0) +
        gouttiere * Math.max(0, uneCopie.length - 1);

      if (!dejaPiste) rail.classList.remove(styles.piste_defile!);
      return naturelle;
    },
    [tiles.length],
  );

  /** Décide du régime, PAR LA MESURE. */
  const mesurer = useCallback(() => {
    const boite = cadre.current;
    const rail = piste.current;
    if (!boite || !rail || tiles.length === 0) return;

    // 🔴 `reduce` COUPE LE RÉGIME PISTE, il ne se contente pas de figer l'animation.
    // Relu à chaque mesure : l'écouteur ci-dessous rejoue `mesurer` quand la préférence
    // système change en cours de session, donc sans rechargement.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDefile(false);
      return;
    }

    const naturelle = mesurerLargeurNaturelle(rail);
    // 1px de tolérance : les navigateurs rendent des largeurs sub-pixel, et une piste
    // à 0,3px du bord ferait basculer le régime d'un redimensionnement à l'autre.
    setDefile(naturelle > boite.clientWidth + 1);
    setDuree(naturelle / VITESSE_PX_PAR_S);
  }, [mesurerLargeurNaturelle, tiles.length]);

  /**
   * Callback de ref plutôt qu'un `useEffect`, pour les deux raisons établies par
   * `PastCarousel` (Story 3.3) : la mesure a besoin du nœud au moment exact où il
   * existe, et la règle `react-hooks/set-state-in-effect` refuse — à juste titre — un
   * `setState` dans un effet pour ce qui est une LECTURE DU DOM.
   */
  const attacherCadre = useCallback(
    (node: HTMLDivElement | null) => {
      cadre.current = node;
      if (!node) return;
      mesurer();
      // La place disponible dépend du viewport : le régime doit être ré-évalué au
      // redimensionnement (AC5). C'est le seuil que le gate visuel doit franchir.
      window.addEventListener("resize", mesurer);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
      reduce.addEventListener("change", mesurer);
      return () => {
        window.removeEventListener("resize", mesurer);
        reduce.removeEventListener("change", mesurer);
        cadre.current = null;
      };
    },
    [mesurer],
  );

  const rendreTuile = (tile: PartnerMarqueeTile, copie: boolean) => (
    <li
      key={`${copie ? "copie" : "vrai"}-${tile.id}`}
      className={styles.tuile}
      // 🔴 La copie de bouclage est retirée du fil d'accessibilité : sans ça un lecteur
      // d'écran annoncerait les 4 partenaires DEUX FOIS, ce qui laisserait croire à
      // huit soutiens. `aria-hidden` sur le <li> ET `alt=""` sur l'image : le second
      // seul laisserait un élément de liste vide dans l'arbre.
      {...(copie ? { "aria-hidden": true as const } : {})}
    >
      {/* Ce <span> porte la respiration de 10px de la maquette. Il n'est PAS un nœud
          décoratif : `fill` fait poser à next/image des styles EN INLINE qu'aucune
          classe CSS ne peut surcharger, et un `padding` sur la tuile ne réduirait pas
          la boîte de l'image (l'`inset` d'un absolu se résout sur la boîte de PADDING
          de son ancêtre positionné). Raisonnement complet dans le .module.css. */}
      <span className={styles.zone}>
        <Image
          src={sourceLogo(tile.logo, sourceAdmin)}
          // Le nom du partenaire est le texte alternatif utile (EXPERIENCE.md l.181) :
          // un logo dit QUI soutient l'asso, pas à quoi il ressemble. Pas de « logo de »
          // en préfixe — un lecteur d'écran annonce déjà « image ».
          alt={copie ? "" : tile.name}
          // 🔴 `fill` ET NON des dimensions intrinsèques, et c'est la raison de fond :
          // `partner` NE STOCKE PAS les dimensions du logo, et la Story 6.5 fera
          // téléverser des fichiers de tailles quelconques par des bénévoles. Un
          // montage qui a besoin de connaître les dimensions à l'avance se casserait à
          // ce moment-là ; celui-ci non. La place reste réservée (zéro CLS, NFR2) parce
          // que c'est la TUILE qui la réserve — pas l'image.
          fill
          // `object-fit: contain` (dans le .module.css) et JAMAIS `cover` : `cover`
          // recadrerait un logo, c'est-à-dire mutilerait une marque tierce.
          className={styles.image}
          // La tuile fait 160px de large à toutes les largeurs de viewport (largeur
          // fixe, cf. CSS) : `sizes` est donc constant, pas responsive.
          sizes="160px"
          loading="lazy"
          // 🔴 `unoptimized`, ET LE MOTIF A CHANGÉ À LA STORY 6.5 — L'ANCIEN ÉTAIT PÉRIMÉ.
          // Il disait « sharp est présent et NON DÉCLARÉ, lever la dette appartient à la
          // 4.3 » : `apps/vitrine/package.json` porte `"sharp": "^0.34.5"` depuis cette
          // story-là, et R15 déclare ce volet CLOS. Deux raisons ACTUELLES, et elles
          // tiennent toutes les deux :
          //   ① les logos téléversés sont DÉJÀ normalisés à la taille canonique par le
          //      serveur (96 px de haut, `server/medias/normaliserLogo`) : il n'y a plus
          //      rien à optimiser, et `/_next/image` ne ferait que re-encoder un fichier
          //      déjà minimal ;
          //   ② en `sourceAdmin`, l'image vient d'une route GARDÉE — et l'optimiseur
          //      requête depuis le serveur, SANS cookie de session : il reçoit le `307`
          //      de la garde, pas une image (mesuré au gate visuel de la 6.4).
          // ⚠️ Corollaire : aucune entrée `/medias/logos/**` ni `/admin/medias/**` dans
          // `images.localPatterns` — une autorisation que rien ne consomme est une
          // « porte sans pièce ».
          unoptimized
        />
      </span>
    </li>
  );

  return (
    <div className={styles.bandeau}>
      {/* Le bouton est AU-DESSUS du cadre dans le DOM : au clavier on rencontre la
          commande avant le contenu qu'elle gouverne — même ordre qu'en 3.3. */}
      {defile ? (
        <div className={styles.commandes}>
          <button
            type="button"
            className={styles.pause}
            onClick={() => setEnPause((p) => !p)}
            // 🔴 `aria-pressed` AVEC UN NOM ACCESSIBLE STABLE, et c'est volontaire :
            // l'APG demande de ne PAS changer le libellé d'un bouton bascule, sous
            // peine d'annoncer deux informations contradictoires. « Mettre en pause…,
            // bouton bascule, activé » se lit correctement : la pause EST active.
            // Seule l'icône change, pour le lecteur voyant.
            aria-pressed={enPause}
            aria-label="Mettre en pause le défilement des logos"
          >
            {enPause ? (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M8 5l11 7-11 7z" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" />
              </svg>
            )}
          </button>
        </div>
      ) : null}

      {/* 🔴 `overflow: clip` sur ce cadre, JAMAIS `hidden` : `hidden` en ferait un
          conteneur de défilement, la famille de défauts la plus coûteuse du projet
          (header non sticky + apparitions au scroll figées, mesurés en Story 2.8).
          Le rognage est ici VOLONTAIRE et il n'y a rien à atteindre derrière : la piste
          ne défile que dans le régime où elle boucle, et sa 2ᵉ copie est décorative. */}
      <div ref={attacherCadre} className={styles.cadre}>
        <ul
          ref={piste}
          className={[styles.piste, defile ? styles.piste_defile : "", enPause ? styles.piste_pause : ""]
            .filter(Boolean)
            .join(" ")}
          aria-label={label}
          // Durée calculée depuis la largeur MESURÉE (voir VITESSE_PX_PAR_S), donc
          // inline : aucune feuille de style ne peut connaître cette valeur.
          {...(defile ? { style: { animationDuration: `${duree.toFixed(1)}s` } } : {})}
        >
          {tiles.map((tile) => rendreTuile(tile, false))}
          {/* La 2ᵉ copie n'existe QUE dans le régime piste : elle sert le bouclage
              sans couture. En mur elle ne servirait à rien et doublerait la hauteur. */}
          {defile ? tiles.map((tile) => rendreTuile(tile, true)) : null}
        </ul>
      </div>
    </div>
  );
}
