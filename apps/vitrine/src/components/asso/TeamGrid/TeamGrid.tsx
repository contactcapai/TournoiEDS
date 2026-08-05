import Image from "next/image";

import { sourcePortrait } from "@/lib/portraits";
import { cleanText } from "@/lib/text";
import type { MemberEntry } from "@/server/db/queries/members";
import styles from "./TeamGrid.module.css";

/**
 * L'équipe nominative, rendue sous la prose de la section « Une équipe de bénévoles » de
 * `/l-asso` (Story 6.10, FR35 → FR9).
 *
 * Server Component pur : aucune interactivité, donc aucun `'use client'`. Il ne requête PAS —
 * la page appelle `getPublishedMembers()` puis distribue en props (patron AC1 de la 3.2).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 LE CADRE DE PORTRAIT EST **TOUJOURS** RENDU — ARBITRAGE DE BRICE DU 2026-08-05
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * *« Il faut un placeholder pour le portrait : s'il n'y a pas de photo c'est juste un cadre
 * avec une silhouette ; s'il y a la photo on l'affiche. »*
 *
 * ⚠️ CET ARBITRAGE REMPLACE CELUI QUI AVAIT ÉTÉ ÉCRIT AU CADRAGE (« ni cadre vide, ni
 * silhouette générique »), et il a raison : la doctrine **UX-DR10** — *ne jamais rendre un
 * placeholder à la place d'une donnée absente* — ne s'applique pas ici. Elle protège contre le
 * fait d'**inventer une donnée** ; une silhouette n'invente rien, elle occupe une **place**.
 * Or une carte de membre a une **géométrie**, et une grille dont certaines cartes portent une
 * image et d'autres rien serait irrégulière — le défaut se verrait immédiatement sur une
 * équipe **mixte**, qui est le cas le plus probable.
 *
 * ⇒ Conséquence directe et vérifiable : **ajouter un portrait ne déplace rien**. Le cadre
 * occupait déjà exactement la même boîte.
 *
 * 🔴 LA SILHOUETTE EST DÉCORATIVE (`aria-hidden`), ET LA PHOTO EST EN `alt=""`.
 * Le prénom et le rôle sont rendus **en texte, immédiatement à côté**. Un `alt="Portrait de
 * Marie"` ferait annoncer « Portrait de Marie, Marie, présidente » à un lecteur d'écran. Les
 * deux sont donc décoratifs au sens WCAG. ⚠️ **Ce n'est PAS le cas de la galerie**, où la
 * photo *est* le contenu et porte un `alt` rédigé (Story 6.4) — deux cas, deux traitements.
 *
 * ⚠️ SVG INLINE ET NON UNE PRIMITIVE `@repo/ui` : la silhouette n'a qu'**un seul**
 * implémenteur. L'aperçu du back-office monte ce composant-ci, il en est donc un 2ᵉ
 * **appelant**, pas un 2ᵉ **implémenteur** (raisonnement de R27, fermée en 6.5). Extraction le
 * jour où un second implémenteur apparaît, avec le compte écrit.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 IL SE REND `null` QUAND AUCUN MEMBRE N'EST PUBLIÉ — C'EST LE CAS NOMINAL AU MERGE
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * La liste des membres n'existe dans aucune source du projet (dette **R16**) : elle arrivera
 * par la saisie. La page doit donc rester **exactement** celle d'aujourd'hui tant que la table
 * est vide — le `<h2>` « Une équipe de bénévoles » et ses deux paragraphes. **Jamais** une
 * grille vide, **jamais** un « Aucun membre », **jamais** un titre orphelin (NFR8, doctrine
 * `PartnerWall` de la 4.2).
 *
 * ⚠️ ET LA PROSE RESTE MÊME UNE FOIS LA GRILLE PEUPLÉE : elle explique le **fonctionnement**
 * (bénévolat, pas de temps plein, choix de formats). Les prénoms ne le disent pas.
 *
 * 🔴 AUCUN DÉCOMPTE N'EST RENDU (FR16). Ni « 12 bénévoles », ni un compteur dérivé de
 * `membres.length`. La page dit en toutes lettres, depuis la Story 2.6, qu'il n'y a *« pas de
 * compteur de membres ni de statistiques d'audience sur ce site »* : en rendre un ici
 * contredirait un texte publié, sur la page même qui le porte.
 */

export interface TeamGridProps {
  /** Les membres publiés, déjà triés par la requête. */
  membres: readonly MemberEntry[];
  /**
   * `true` uniquement dans l'aperçu du back-office : les portraits sont alors servis par la
   * route **gardée**, et rendus `unoptimized`.
   *
   * 🔴 UN SEUL BOOLÉEN, JAMAIS UN PRÉFIXE LIBRE — leçon ③ de la Story 6.4 : une prop
   * `prefixeMedia?: string` laissait poser le préfixe **sans** `unoptimized`, c'est-à-dire
   * refabriquer le défaut qu'elle existait pour corriger. Ici les deux faits sortent de cette
   * seule prop, et l'appelant ne peut pas les dissocier.
   */
  sourceAdmin?: boolean;
}

export function TeamGrid({ membres, sourceAdmin = false }: TeamGridProps) {
  if (membres.length === 0) return null;

  return (
    /* `<ul>`/`<li>` et non des `<div>` : c'est une liste d'éléments équivalents, elle doit
       être annoncée comme telle. La grille est portée par le `<ul>`, ce qui ne coûte AUCUN
       nœud supplémentaire.
       ⚠️ `list-style: none` exige le `role="list"` explicite : Safari retire la sémantique de
       liste dans ce cas (bug WebKit connu), et sans lui VoiceOver n'annoncerait plus « liste de
       N éléments ». Même traitement que `WorkshopCatalog`. */
    <ul className={styles.grille} role="list">
      {membres.map((membre) => {
        // `cleanText` : filet du RENDU contre une écriture qui contournerait Zod et les
        // `CHECK` (`UPDATE` direct, restauration de sauvegarde). Le prénom et le rôle sont
        // obligatoires en base ; ceci garantit qu'aucune carte ne rend un fragment vide si
        // cette garantie était un jour contournée.
        const prenom = cleanText(membre.firstName);
        const role = cleanText(membre.role);
        if (prenom === null || role === null) return null;

        return (
          <li key={membre.id} className={styles.carte}>
            {/* ── Le cadre, TOUJOURS rendu ────────────────────────────────────────────── */}
            <span className={styles.cadre}>
              {membre.portrait !== null ? (
                <Image
                  src={sourcePortrait(membre.portrait, sourceAdmin)}
                  alt=""
                  fill
                  /* La carte fait au plus 300px de large (voir `.grille`), et l'image y est
                     carrée. 150px couvre l'affichage réel ; le 2× est servi par le fichier
                     normalisé à 320. */
                  sizes="150px"
                  className={styles.photo}
                  /* 🔴 `unoptimized` DANS L'APERÇU D'ADMIN : `/_next/image` requête depuis le
                     serveur, SANS cookie de session — il reçoit le `307` de la garde, pas une
                     image (mesuré au gate visuel de la 6.4). Côté public, l'optimiseur est bien
                     utilisé : `images.localPatterns` autorise `/medias/**`, qui couvre déjà
                     `/medias/portraits/**` — rien à y ajouter. */
                  unoptimized={sourceAdmin}
                />
              ) : (
                <Silhouette />
              )}
            </span>

            <p className={styles.prenom}>{prenom}</p>
            <p className={styles.role}>{role}</p>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * La silhouette du cadre sans photo.
 *
 * ⚠️ `aria-hidden` et `focusable="false"` : purement décorative. `focusable="false"` n'est pas
 * décoratif non plus — sans lui, Internet Explorer et certains lecteurs d'écran plaçaient un
 * arrêt de tabulation sur un SVG. La convention du projet le pose sur tous les décoratifs.
 *
 * ⚠️ `currentColor` et non une couleur en dur : le tracé suit la couleur du cadre, elle-même
 * posée par un token dans le CSS. Tokens-only (project-context §5) — aucun hex de charte ici.
 *
 * Tracé volontairement minimal (un disque pour la tête, un arc pour les épaules) : c'est un
 * repère de place, pas une illustration.
 */
function Silhouette() {
  return (
    <svg
      className={styles.silhouette}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      <circle cx="32" cy="24" r="11" />
      <path d="M11 58a21 21 0 0 1 42 0Z" />
    </svg>
  );
}
