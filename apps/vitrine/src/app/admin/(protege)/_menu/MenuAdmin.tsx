"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  LIBELLE_FAMILLE,
  type SectionAdmin,
  famillesUtiles,
  grouperParFamille,
  sectionCourante,
} from "../../_sections";
import { IconeSection } from "./IconeSection";
import styles from "./MenuAdmin.module.css";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * LA NAVIGATION DU BACK-OFFICE (Story 13.2)
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 SEUL COMPOSANT CLIENT DU CHROME, et pour deux raisons qui l'exigent : `usePathname()`
 * (marquer l'entrée courante) et l'état replié/déplié sous 880 px. Le layout qui le monte
 * reste un RSC — c'est lui qui lit la session et filtre par rôle. Même montage que
 * `MenuTournoi`, écrit pour la même raison en 10.9.
 *
 * ⚠️ LES SECTIONS ARRIVENT EN PROPS, DÉJÀ FILTRÉES PAR RÔLE. Ce composant ne décide d'aucun
 * accès : il ne sait même pas ce qu'est un rôle. Masquer un lien n'a jamais protégé quoi que
 * ce soit — ce qui protège est le proxy et la garde de chaque page.
 *
 * 🔴 TROIS DÉFAUTS MESURÉS que ce composant existe pour corriger :
 *   ① le menu ne marquait PAS l'entrée courante (ni `aria-current`, ni classe, ni
 *      `usePathname`) — le layout est un RSC, il ne connaît pas la route ;
 *   ② huit entrées à plat, ajoutées une par une, aucune ne connaissant les autres ;
 *   ③ la phrase de chaque section n'existait QUE sur le tableau de bord.
 */
const TABLEAU_DE_BORD = "/admin";

export function MenuAdmin({ sections }: { sections: readonly SectionAdmin[] }) {
  const chemin = usePathname();
  const [deplie, setDeplie] = useState(false);

  const groupes = grouperParFamille(sections);
  const titrer = famillesUtiles(groupes);
  const courante = sectionCourante(chemin, sections);

  // 🔴 ÉGALITÉ STRICTE, JAMAIS `cheminCouvertPar` — ET C'EST LE PIÈGE DE CETTE ENTRÉE.
  // `/admin` est le préfixe des ONZE autres écrans : la règle « la plus longue l'emporte »
  // qui départage les sections ne s'applique pas ici, il n'y a rien à départager. Un test de
  // préfixe marquerait le tableau de bord actif sur tout le back-office, en même temps que
  // la vraie section — deux entrées surlignées, dont une fausse.
  const surTableauDeBord = chemin === TABLEAU_DE_BORD;

  // Ce que le bouton de repli annonce sous 880 px. ⚠️ `courante` ne connaît que les SECTIONS :
  // sans cette ligne, le bouton dirait « Menu » tout court sur le tableau de bord, c'est-à-dire
  // le seul écran où l'on ne saurait pas où l'on est.
  const libelleCourant = surTableauDeBord ? "Tableau de bord" : (courante?.libelle ?? null);

  return (
    <div className={styles.bloc}>
      {/* ⚠️ VISIBLE SOUS 880 px SEULEMENT (CSS). Au-dessus, le menu est toujours déployé et
          ce bouton n'aurait rien à commander. */}
      <button
        type="button"
        className={styles.bascule}
        aria-expanded={deplie}
        aria-controls="menu-admin"
        onClick={() => setDeplie((valeur) => !valeur)}
      >
        {/* Le MOT dit l'état — une icône seule ne dit rien à un lecteur d'écran, et
            `aria-expanded` seul ne dit rien à l'œil. */}
        {deplie ? "Fermer le menu" : "Menu"}
        {libelleCourant !== null && !deplie && (
          <span className={styles.basculeCourante}> — {libelleCourant}</span>
        )}
      </button>

      {/* 🔴 SANS CE <noscript>, LE MENU SERAIT INJOIGNABLE SOUS 880 px QUAND JS EST ABSENT.
          Le repli est un état React : non hydraté, le panneau resterait fermé et le bouton
          inerte. La règle ci-dessous le rouvre — on préfère un menu trop long à un menu
          inatteignable. */}
      <noscript>
        <style>{`#menu-admin { display: block !important; }`}</style>
      </noscript>

      <nav
        id="menu-admin"
        className={styles.nav}
        data-deplie={deplie ? "oui" : "non"}
        aria-label="Navigation du back-office"
      >
        {/* ══════════════════════════════════════════════════════════════════════════════
            LE RETOUR AU TABLEAU DE BORD — DÉFAUT VU PAR BRICE LE 2026-08-25
            ══════════════════════════════════════════════════════════════════════════════
            Le chrome ne contenait QUE les neuf liens de sections : rien ne ramenait à
            `/admin`, et le bloc logo + « Back-office » était un <div>. On y revenait en
            tapant l'URL. Le défaut est ancien — il ne se sentait pas tant que le tableau de
            bord n'était qu'un annuaire redondant avec ce menu. La 13.3 lui a donné un
            contenu qu'on ne trouve nulle part ailleurs, et l'a rendu coûteux du même coup.

            🔴 HORS DES FAMILLES, ET CE N'EST PAS COSMÉTIQUE : `/admin` n'est PAS une section.
            Il vit dans `CHEMINS_CONNECTE` (ouvert à tout compte connecté, sans rôle), il n'a
            ni rôle, ni aperçu, ni brouillon. Le ranger sous « Publication » ou « Gestion »
            en ferait une destination de plus parmi ses subordonnées. Même raisonnement que
            le bloc du compte, volontairement séparé en bas de colonne.

            ⚠️ IL SE REND MÊME QUAND `sections` EST VIDE. C'était l'ancien cas de sortie
            anticipée du composant : un compte sans rôle n'avait AUCUN menu — donc, depuis
            `/admin/refus`, aucun moyen de revenir à l'écran qui lui explique sa situation.
            Le seul lien qu'il peut suivre est justement celui-ci. */}
        <ul className={styles.liste}>
          <li className={styles.accueil}>
            <Link
              className={
                surTableauDeBord ? `${styles.lien} ${styles.lienActif}` : styles.lien
              }
              href={TABLEAU_DE_BORD}
              aria-current={surTableauDeBord ? "page" : undefined}
              onClick={() => setDeplie(false)}
            >
              <IconeSection nom="tableau-de-bord" />
              <span className={styles.libelle}>Tableau de bord</span>
            </Link>
            {/* ⚠️ Une phrase VRAIE POUR TOUT LE MONDE. « où en sont l'agenda et la galerie »
                serait faux pour un administrateur de tournoi, qui n'ouvre ni l'un ni l'autre —
                et une phrase fausse en silence est le défaut que ce projet paie le plus. */}
            {surTableauDeBord && (
              <p className={styles.description}>
                Ce qui attend une réponse, avant toute liste.
              </p>
            )}
          </li>
        </ul>

        {groupes.map((groupe) => (
          <div className={styles.groupe} key={groupe.famille}>
            {/* ⚠️ Le titre disparaît quand il ne reste qu'UNE famille : il n'y a alors plus
                rien à distinguer, et trois lignes de chrome pour un lien seraient du bruit.
                La règle vit dans `_sections.ts`, où elle est testée. */}
            {titrer && (
              <p className={styles.groupeTitre} id={`famille-${groupe.famille}`}>
                {LIBELLE_FAMILLE[groupe.famille]}
              </p>
            )}
            <ul
              className={styles.liste}
              {...(titrer ? { "aria-labelledby": `famille-${groupe.famille}` } : {})}
            >
              {groupe.sections.map((section) => {
                const active = courante?.href === section.href;
                return (
                  <li key={section.href}>
                    <Link
                      className={active ? `${styles.lien} ${styles.lienActif}` : styles.lien}
                      href={section.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setDeplie(false)}
                    >
                      <IconeSection nom={section.icone} />
                      <span className={styles.libelle}>{section.libelle}</span>
                    </Link>
                    {/* ③ LA PHRASE, SOUS L'ENTRÉE ACTIVE SEULEMENT. La rendre partout ferait
                        neuf paragraphes dans une barre de navigation ; ne la rendre nulle
                        part est l'état d'avant, où le menu ne portait que neuf mots. */}
                    {active && <p className={styles.description}>{section.description}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
