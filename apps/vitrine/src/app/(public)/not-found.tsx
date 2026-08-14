import { Button } from "@repo/ui";

import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import editorial from "@/styles/editorial.module.css";
import styles from "./not-found.module.css";

// ══════════════════════════════════════════════════════════════════════════════════════
// LA 404 DU GROUPE PUBLIC (Story 9.3) — ELLE NAÎT AVEC LA PREMIÈRE PAGE QUI PEUT EN LEVER UNE
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 ELLE EXISTE PARCE QU'UNE MESURE L'A DEMANDÉE, PAS PAR PRINCIPE. Relevé le 2026-08-14
// sur staging (`curl https://staging.esportdessacres.fr/page-qui-nexiste-pas`) : la 404 par
// défaut de Next répond bien 404, mais son HTML ne contient **ni skip-link, ni `<header>`,
// ni `<footer>`, ni `<main id="content">` — zéro occurrence de chacun. Elle sort du chrome
// du groupe `(public)`, qui est monté par son `layout.tsx`.
//   · Jusqu'ici c'était sans conséquence : les six pages publiques sont des routes
//     STATIQUES, aucune ne pouvait lever de `notFound()`, et **tous** les `notFound()` du
//     dépôt vivaient sous `/admin/` (vérifié par l'inverse : `grep -rn "notFound()" src/ |
//     grep -v "src/app/admin/"` ne rendait rien), où une page nue est acceptable pour un
//     bénévole connecté.
//   · Ça cesse de l'être avec `/tournois/[slug]` : un slug se partage (MATELY, flyer,
//     description de stream, favori), et quelqu'un qui suit un lien périmé tombait sur la
//     page nue de Next — un texte anglais, aucune sortie —, sur le site d'une association
//     dont le livrable est justement qu'on trouve les rendez-vous sans demander à personne.
//
// ══════════════════════════════════════════════════════════════════════════════════════
// 🔴 CE QU'ELLE N'OBTIENT **PAS**, ET C'EST MESURÉ DEUX FOIS — À NE PAS RE-TENTER
// ══════════════════════════════════════════════════════════════════════════════════════
//
// **Le layout du groupe `(public)` n'est PAS monté sur un `not-found`.** Cette page rend donc
// son texte et ses deux boutons, mais **sans** le header, le footer, le skip-link ni le
// `<main id="content">`.
// 🔬 Mesuré sur staging le 2026-08-14, sur le HTML SERVI, dans les DEUX emplacements possibles :
//   · `app/(public)/not-found.tsx`            → `<header` 0 · `<footer` 0 · `Nous solliciter` 0
//   · `app/(public)/tournois/[slug]/not-found.tsx` → identique, aux mêmes trois zéros.
// Une page publique NORMALE servie au même instant rendait, elle, 1 · 1 · 1. Ce n'est donc pas
// un problème de placement du fichier — c'est le comportement du framework.
// ⚠️ **Le témoin naïf mentait** : `grep -c "skip-link"` renvoyait 1 sur la 404, ce qui a
// d'abord ressemblé à un succès. La chaîne venait de la **feuille de style** (`.skip-link{…}`),
// pas du markup. C'est `pieges/faux-succes.md` : vérifier le BON témoin, ici un marqueur qui
// n'existe que dans le HTML (`Nous solliciter`, un libellé de navigation).
//
// ⇒ **CE QUI RATTRAPE LE CUL-DE-SAC N'EST DONC PAS LE CHROME, CE SONT LES DEUX SORTIES
// EXPLICITES DE CETTE PAGE.** Elles sont le livrable, pas une décoration : sans elles, un
// visiteur arrivé par un lien périmé n'aurait aucun moyen d'atteindre le site. Ne pas les
// retirer en croyant que le header prendra le relais.
// ⚠️ **NE PAS "RÉPARER" EN RECOPIANT LE LAYOUT ICI** (skip-link + `<SiteHeader>` + `<main>` +
// `<SiteFooter>`) : ce serait une **seconde définition** du chrome du site, qui divergerait du
// vrai layout au premier changement — exactement la duplication que la Story 5.5 a passé une
// story entière à supprimer (primitive `ExternalIcon`, deux copies du header et du footer).
// Le gain visé ne vaut pas ce prix, et il est déjà obtenu autrement.
//
// ⚠️ CE QU'ELLE COUVRE, ET CE QU'ELLE NE COUVRE PAS : un `not-found.tsx` attrape les
// `notFound()` levés dans SON sous-arbre. Une URL qui ne correspond à AUCUN segment
// (`/nimportequoi`) ne traverse pas le groupe `(public)` et continue de rendre la 404 globale
// de Next. Ce n'est pas un oubli — la couvrir demanderait un `app/not-found.tsx` racine,
// c'est-à-dire une décision sur des URL qui ne sont pas les nôtres. La story qui en aura
// besoin la prendra.
//
// 🔴 AUCUN `metadata` ICI : Next ne permet pas d'en exporter depuis un `not-found.tsx`. Sur la
// fiche, le `<title>` servi est donc celui que rend `generateMetadata` pour un slug inconnu —
// « Tournoi introuvable », écrit exprès pour ce cas. Le dire évite qu'on cherche pourquoi
// l'export manque.

export default function NotFoundPublic() {
  return (
    <section className={editorial.head} aria-labelledby="nf-title">
      <Wrap>
        <SectionHead
          headingLevel={1}
          titleId="nf-title"
          eyebrow="Page introuvable"
          title="On a perdu le fil"
        />

        {/* ⚠️ ELLE DIT CE QUI SE PASSE ET QUOI FAIRE, jamais « erreur 404 » seule — même
            doctrine que les états vides depuis la 3.2, rendue non négociable par la leçon
            4.2 : un écran qui ne dit rien ressemble autant à une panne qu'à un vide normal.
            🔴 ET ELLE NE MENT PAS SUR LA CAUSE : un tournoi dépublié, un lien périmé et une
            faute de frappe rendent tous les trois cette page, et l'on ne peut pas les
            distinguer — dire « ce tournoi a été annulé » serait une affirmation que la donnée
            ne tient pas (famille R48). */}
        <p className={styles.texte}>
          Cette page n&rsquo;existe pas, ou plus. Un lien a pu changer depuis qu&rsquo;il a
          été partagé — le programme à jour est dans l&rsquo;agenda, et les tournois ont leur
          page.
        </p>

        <div className={styles.actions}>
          <Button href="/agenda">Voir l&rsquo;agenda</Button>
          <Button variant="outline" href="/tournois">
            Les tournois
          </Button>
        </div>
      </Wrap>
    </section>
  );
}
