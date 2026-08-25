import type { Metadata } from "next";
import Link from "next/link";

import { Gallery } from "@/components/gallery/Gallery/Gallery";
import { HOME_PHOTO_COUNT } from "@/lib/galerie";
import { exigerRolePage } from "@/server/auth/guard";
import { getPhotosForAdmin } from "@/server/db/queries/photos";
import styles from "@/styles/admin-page.module.css";
import propre from "../galerie.module.css";

// ══════════════════════════════════════════════════════════════════════════════════════
// PRÉVISUALISATION DE LA GALERIE (Story 6.4, FR25 — 2ᵉ consommateur du mécanisme)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 C'EST LE COMPOSANT PUBLIC RÉEL, PAS UNE MAQUETTE DE L'ÉCRAN. `Gallery` — et le
// `Scrapbook` qu'il monte — sont importés depuis `components/gallery/`, les MÊMES modules que
// rend `/` (Story 4.3), avec leurs garde-fous : cadres « tirage », inclinaison alternée,
// lightbox, état vide É7. Une reproduction « fidèle » écrite ici divergerait au premier
// changement du rendu public, et mentirait exactement au moment où on lui demande de dire la
// vérité.
//
// 🔴 CETTE ROUTE REND DES PHOTOS NON PUBLIÉES — c'est une FUITE DE DONNÉES si elle est
// atteignable sans session. D'où la garde en PREMIÈRE INSTRUCTION (une garde de `layout`
// n'arrête pas le rendu de la page enfant : défaut mesuré en Story 6.1). `gate:galerie` en
// fait sa garde n°1, et vérifie le HTML SERVI, pas le code de statut.
//
// 🔴 ET LES IMAGES VIENNENT DE `/admin/medias`, PAS DE `/medias`. La route publique filtre
// sur `is_published` et rend 404 sinon, volontairement : un aperçu naïf afficherait des
// CADRES CASSÉS exactement sur les photos qu'on veut regarder avant de publier. C'est la
// prop `sourceAdmin` de `Scrapbook`, et elle a ce seul consommateur — ce qui est
// précisément pourquoi elle existe.
// ⚠️ Elle emporte AUSSI le fait que ces images ne passent PAS par `/_next/image` : un
// optimiseur requête depuis le serveur, sans cookie, donc ne peut pas lire une route gardée
// (mesuré au gate visuel de la 6.4 — aucune vignette ne s'affichait).
//
// ⚠️ Le fond du plateau est `--navy-deep`, celui du `body` sur lequel la galerie de l'accueil
// est réellement posée. Ce n'est pas décoratif : le contraste d'un texte dépend de son fond
// EFFECTIF, et prévisualiser sur un autre fond montrerait un rendu qui n'existe nulle part
// (leçon 4.2 — un fond effectif n'est pas un token).

export const metadata: Metadata = {
  title: "Aperçu de la galerie",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Borne EXPLICITE de la lecture — la même que l'écran de liste, et pour la même raison :
 * jamais de lecture non bornée, sinon le temps de rendu dépend du volume téléversé.
 * ⚠️ Elle n'est PAS la borne d'affichage : on lit large pour pouvoir dire ce qui entre dans
 * les 8 **et** ce qui en sort, puis on coupe en mémoire.
 */
const PHOTOS_MAX = 200;

export default async function ApercuGaleriePage() {
  await exigerRolePage("admin_site");

  // 🔴 BROUILLONS INCLUS, ET C'EST LA RAISON D'ÊTRE DE CET ÉCRAN. `getPublishedPhotos` (que
  // lit la home) filtrerait sur `is_published` : l'aperçu ne montrerait alors rien de ce
  // qu'on vient préparer.
  //
  // 🔴 MAIS ON LIT LARGE PUIS ON COUPE EN MÉMOIRE — DÉFAUT RÉEL TROUVÉ EN REVUE.
  // La première version faisait `getPhotosForAdmin(HOME_PHOTO_COUNT)`, c'est-à-dire un
  // `LIMIT 8` **en SQL, tous statuts confondus**. Conséquence mesurable : avec 3 brouillons
  // en tête d'ordre et 10 photos publiées derrière, l'aperçu montrait 3 brouillons + 5
  // publiées et **omettait purement et simplement** les 3 photos publiées de rang 9, 10 et
  // 11 — qui, elles, sont bel et bien sur l'accueil aujourd'hui. L'écran promettait
  // « telle qu'elle apparaîtra sur l'accueil » et disait faux.
  // ⚠️ L'écran voisin `/admin/galerie` faisait DÉJÀ la bonne chose (lire large, filtrer et
  // couper en mémoire) : c'est ce qui prouve que c'était un défaut et non un arbitrage.
  const toutes = await getPhotosForAdmin(PHOTOS_MAX);

  // Ce qui est RENDU : les 8 premières de l'ordre, brouillons compris. C'est la réponse à la
  // question que le bénévole se pose ici — « à quoi ressemblera l'accueil si je publie ça ? ».
  const apercu = toutes.slice(0, HOME_PHOTO_COUNT);
  const brouillons = apercu.filter((photo) => !photo.isPublished).length;

  // Ce que l'accueil montre AUJOURD'HUI, c'est-à-dire sans rien publier de plus.
  const surAccueilAujourdHui = toutes
    .filter((photo) => photo.isPublished)
    .slice(0, HOME_PHOTO_COUNT);

  // 🔴 LE FAIT QUE PERSONNE NE DEVINERAIT : publier un brouillon placé haut dans l'ordre
  // ÉVINCE une photo publiée de l'accueil. L'écran le nomme, avec le compte.
  const dansApercu = new Set(apercu.map((photo) => photo.id));
  const evincees = surAccueilAujourdHui.filter((photo) => !dansApercu.has(photo.id)).length;

  return (
    <>
      <h1 className={styles.titre}>Aperçu de la galerie</h1>
      {/* ⚠️ FORMULATION EXACTE, ET C'EST LE CORRECTIF DE FOND : cet écran ne montre pas
          l'accueil d'aujourd'hui, il montre l'accueil **si tout ce qui suit était publié**.
          Les deux coïncident quand il n'y a aucun brouillon, et la mention ci-dessous dit
          laquelle des deux on regarde. */}
      <p className={styles.chapo}>
        Voici la galerie « La vie de l&rsquo;asso » telle qu&rsquo;elle apparaîtrait sur
        l&rsquo;accueil <strong>si tout ce qui suit était publié</strong> — les{" "}
        {HOME_PHOTO_COUNT} premières photos de votre ordre.
      </p>

      <div className={styles.barreActions}>
        <Link className={styles.lien} href="/admin/galerie">
          Retour à la galerie
        </Link>
        <Link className={styles.lien} href="/admin/galerie/nouveau">
          Téléverser des photos
        </Link>
      </div>

      {/* 🔴 LA BORNE EST DITE, PAS TUE. L'aperçu inclut les brouillons pour qu'on voie le
          rendu final ; sur le site, seules les photos PUBLIÉES comptent dans les 8. Un écran
          muet là-dessus se ferait lire comme exhaustif — corollaire de
          `pieges/garde-nominale.md` appliqué à un écran plutôt qu'à une porte. */}
      <p className={styles.mention} role="note">
        {brouillons > 0 ? (
          <>
            Cet aperçu inclut <strong>{brouillons} brouillon{brouillons > 1 ? "s" : ""}</strong>,
            pour que vous voyiez le rendu avant de publier. Sur le site public, seules les
            photos <strong>publiées</strong> comptent dans les {HOME_PHOTO_COUNT}.
          </>
        ) : (
          <>
            Toutes les photos ci-dessous sont publiées : c&rsquo;est exactement ce que voit un
            visiteur de l&rsquo;accueil aujourd&rsquo;hui.
          </>
        )}
      </p>

      {/* 🔴 LA CONSÉQUENCE QUE PERSONNE NE DEVINE, ET QUE LA PREMIÈRE VERSION DE CET ÉCRAN
          CACHAIT PUREMENT ET SIMPLEMENT : l'accueil ne montre que 8 photos. Publier un
          brouillon placé haut dans l'ordre en ÉVINCE donc une, qui disparaît de la page la
          plus vue du site. Le dire ici est le seul endroit où l'information arrive AVANT la
          décision. */}
      {evincees > 0 ? (
        <p className={styles.mention} role="note">
          ⚠️ En publiant {brouillons > 1 ? "ces brouillons" : "ce brouillon"},{" "}
          <strong>
            {evincees} photo{evincees > 1 ? "s" : ""} actuellement sur l&rsquo;accueil
          </strong>{" "}
          en {evincees > 1 ? "sortiraient" : "sortirait"} — elle{evincees > 1 ? "s" : ""} rest
          {evincees > 1 ? "eraient" : "erait"} publiée{evincees > 1 ? "s" : ""}, mais au-delà de
          la {HOME_PHOTO_COUNT}
          <sup>e</sup> place. Descendez un brouillon dans la liste pour l&rsquo;éviter.
        </p>
      ) : null}

      <div className={propre.plateau}>
        <Gallery photos={apercu} sourceAdmin />
      </div>
    </>
  );
}
