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
export function MenuAdmin({ sections }: { sections: readonly SectionAdmin[] }) {
  const chemin = usePathname();
  const [deplie, setDeplie] = useState(false);

  // Un menu vide ne se rend pas : c'est le cas d'un compte sans rôle, à qui le tableau de
  // bord explique la situation. Un <nav> vide ressemblerait à une panne.
  if (sections.length === 0) return null;

  const groupes = grouperParFamille(sections);
  const titrer = famillesUtiles(groupes);
  const courante = sectionCourante(chemin, sections);

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
        {courante !== null && !deplie && (
          <span className={styles.basculeCourante}> — {courante.libelle}</span>
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
        aria-label="Sections du back-office"
      >
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
