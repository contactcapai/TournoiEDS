import type { Metadata } from "next";
import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import { ASSOCIATION, HEBERGEUR } from "@/lib/legal";
import editorial from "@/styles/editorial.module.css";
import motion from "@/styles/motion.module.css";

// ══════════════════════════════════════════════════════════════════════════════════════
// MENTIONS LÉGALES (Story 12.5) — LA DETTE LA PLUS ANCIENNE DU SITE
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 LE PIED DE PAGE ANNONÇAIT CETTE PAGE DEPUIS LA STORY 1.5, AVEC UN LIEN INERTE. Le
// commentaire de `SiteFooter` le disait mot pour mot : « pages légales à rédiger (hors
// périmètre — RGPD bloquant) ». Un lien qui porte un nom et ne mène nulle part est une
// promesse non tenue, visible de toutes les pages du site — et c'est resté vrai pendant
// douze epics.
//
// 🔴 CE N'EST PAS GOOGLE QUI L'A RENDUE OBLIGATOIRE, IL L'A RENDUE VISIBLE. L'obligation
// court depuis la LCEN (art. 6 III) pour tout éditeur de site, et depuis que le site
// collecte des adresses e-mail (Story 6.11, sollicitations). La console Google Cloud a
// seulement refusé de publier l'application OAuth sans ces liens — un révélateur, pas une
// cause. ⇒ Ne pas écrire ici que ces pages existent « pour Google » : elles seraient dues
// même sans lui.
//
// ⚠️ AUCUN FAIT INVENTÉ. Tout ce qui suit vient du récépissé de déclaration de la
// préfecture de la Marne (n° W513009855, 2022-11-02) fourni par Brice, ou d'une mesure
// dans le dépôt (l'hébergeur). `lib/legal.ts` porte ces valeurs UNE fois : les deux pages
// les lisent, aucune ne les recopie.

export const metadata: Metadata = {
  title: "Mentions légales",
  description:
    "Éditeur, directeur de la publication et hébergeur du site de l'association Esport des Sacres.",
  // ⚠️ Next REMPLACE l'objet `openGraph` du parent au lieu de le fusionner : sans ces
  // trois premières lignes, la page perdrait `og:type`, `og:locale` et `og:site_name`
  // (mesuré en 2.6, à reconduire sur toute page dédiée).
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Esport des Sacres",
    title: "Mentions légales · Esport des Sacres",
    description:
      "Éditeur, directeur de la publication et hébergeur du site de l'association Esport des Sacres.",
  },
};

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 `force-dynamic` — ET ICI LA RAISON N'EST PAS CELLE DES CINQ AUTRES PAGES
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `/`, `/agenda`, `/partenaires`, `/animations` et `/l-asso` portent cette ligne parce
 * qu'ELLES lisent la base. **Cette page-ci ne lit rien** : son contenu est du texte et
 * `lib/legal.ts` est un objet constant. On peut donc croire, très raisonnablement, qu'elle
 * n'en a pas besoin.
 *
 * 🔴 C'EST SON LAYOUT QUI LIT LA BASE. Depuis la Story 6.13, `(public)/layout.tsx` lit
 * `site_setting` pour le pied de page et le chrome — donc TOUTE page de ce groupe touche la
 * base, même celle qui n'a aucune requête à elle. Sans cette ligne, Next tente un PRÉRENDU au
 * build, la connexion Drizzle s'ouvre, et `next build` échoue.
 *
 * ⚠️ ET LE DÉFAUT EST INVISIBLE EN LOCAL, PAR CONSTRUCTION : ici `.env.local` fournit
 * `DATABASE_URL`, donc la lecture réussit et la page bascule d'elle-même en dynamique. La CI
 * construit SANS AUCUN SECRET (garde-fou n°2 de la Story 1.7, structurel dans `ci.yml`) :
 * elle est le seul endroit où ça casse. ⇒ Trouvé par la CI, et par elle seule — l'exact
 * symétrique de « le rendu se regarde sur staging ».
 * ⚠️ Le commentaire de `/l-asso` décrivait ce piège mot pour mot, AVANT qu'on le refasse.
 */
export const dynamic = "force-dynamic";

export default function MentionsLegalesPage() {
  return (
    <>
      {/* ① Tête de page. Seul <h1> du document ; le <main id="content"> vient du layout. */}
      <section className={editorial.head} aria-labelledby="mentions-title">
        <Wrap>
          <SectionHead
            headingLevel={1}
            titleId="mentions-title"
            eyebrow="Informations légales"
            title="Mentions légales"
            intro="Qui édite ce site, qui en est responsable, et où il est hébergé."
          />
        </Wrap>
      </section>

      {/* ② L'éditeur */}
      <section
        className={`${editorial.section} ${motion.reveal}`}
        aria-labelledby="editeur-title"
      >
        <Wrap>
          <h2 id="editeur-title" className={editorial.title}>
            Éditeur du site
          </h2>
          <div className={editorial.prose}>
            <p>
              <strong>{ASSOCIATION.nom}</strong>, association déclarée régie par la loi du
              1<sup>er</sup> juillet 1901, enregistrée sous le numéro{" "}
              <strong>{ASSOCIATION.rna}</strong> auprès de la sous-préfecture de Reims
              (récépissé de déclaration du {ASSOCIATION.dateDeclaration}).
            </p>
            <p>
              Siège social&nbsp;: {ASSOCIATION.adresse}, {ASSOCIATION.codePostal}{" "}
              {ASSOCIATION.ville}.
            </p>
            <p>
              Contact&nbsp;:{" "}
              <a href={`mailto:${ASSOCIATION.email}`}>{ASSOCIATION.email}</a>
            </p>
          </div>
        </Wrap>
      </section>

      {/* ③ Le directeur de la publication */}
      <section
        className={`${editorial.section} ${motion.reveal}`}
        aria-labelledby="publication-title"
      >
        <Wrap>
          <h2 id="publication-title" className={editorial.title}>
            Directeur de la publication
          </h2>
          <div className={editorial.prose}>
            <p>{ASSOCIATION.directeurPublication}</p>
          </div>
        </Wrap>
      </section>

      {/* ④ L'hébergeur */}
      <section
        className={`${editorial.section} ${motion.reveal}`}
        aria-labelledby="hebergeur-title"
      >
        <Wrap>
          <h2 id="hebergeur-title" className={editorial.title}>
            Hébergement
          </h2>
          <div className={editorial.prose}>
            <p>
              Le site est hébergé sur un serveur privé virtuel fourni par{" "}
              <strong>{HEBERGEUR.nom}</strong>, {HEBERGEUR.adresse}.
            </p>
            <p>
              Site de l&rsquo;hébergeur&nbsp;:{" "}
              <a href={HEBERGEUR.site} target="_blank" rel="noopener noreferrer">
                {HEBERGEUR.siteAffiche}
              </a>
            </p>
          </div>
        </Wrap>
      </section>

      {/* ⑤ Propriété intellectuelle. ⚠️ On ne revendique QUE ce qui nous appartient : les
          logos des partenaires et les visuels de jeux ne sont pas à nous, et l'écrire
          serait faux. */}
      <section
        className={`${editorial.section} ${motion.reveal}`}
        aria-labelledby="propriete-title"
      >
        <Wrap>
          <h2 id="propriete-title" className={editorial.title}>
            Propriété intellectuelle
          </h2>
          <div className={editorial.prose}>
            <p>
              Les textes, le logo et les photographies publiés sur ce site sont la
              propriété de l&rsquo;association, sauf mention contraire. Les logos des
              partenaires et les marques ou visuels liés aux jeux vidéo cités restent la
              propriété de leurs titulaires respectifs et sont utilisés à titre
              d&rsquo;illustration.
            </p>
            <p>
              Une photographie vous représente et vous souhaitez son retrait&nbsp;?
              Écrivez-nous&nbsp;: nous la retirons, sans avoir à en discuter le motif.
            </p>
          </div>
        </Wrap>
      </section>

      {/* ⑥ Renvoi vers la confidentialité — les deux pages sont sœurs, et l'une répond aux
          questions que l'autre soulève. */}
      <section
        className={`${editorial.section} ${motion.reveal}`}
        aria-labelledby="donnees-title"
      >
        <Wrap>
          <h2 id="donnees-title" className={editorial.title}>
            Données personnelles
          </h2>
          <div className={editorial.prose}>
            <p>
              Ce que le site collecte, pourquoi, combien de temps, et comment exercer vos
              droits&nbsp;: tout est détaillé sur la page{" "}
              <a href="/confidentialite">Confidentialité</a>.
            </p>
          </div>
        </Wrap>
      </section>
    </>
  );
}
