import Link from "next/link";
import { redirect } from "next/navigation";

import { lireAdmin } from "@/server/auth/guard";
import { SECTIONS_ADMIN } from "../_sections";
import styles from "./page.module.css";

// Tableau de bord du back-office (Story 6.1).
//
// Server Component pur : aucune interactivité, donc aucun 'use client'.
//
// 🔴 CETTE PAGE PORTE SA PROPRE GARDE, ET CE N'EST PAS UNE REDONDANCE — DÉFAUT MESURÉ.
// Une garde placée dans un `layout` N'EMPÊCHE PAS la `page` enfant de s'exécuter : Next rend
// l'arbre de segments EN PARALLÈLE, et le `redirect()` du layout n'arrête pas un rendu déjà
// commencé ailleurs. Mesuré le 2026-08-02 en débranchant volontairement le matcher du proxy :
// la réponse était bien un `307 → /admin/login`, **et son corps contenait tout le tableau de
// bord** sérialisé dans la charge RSC (`"children":"Back-office"`, « Les sections arrivent
// une par une… »), le marqueur `NEXT_REDIRECT` n'arrivant qu'à la fin. Le contenu avait donc
// déjà quitté le serveur.
//
// ⚠️ PATRON POUR LES STORIES 6.3 → 6.13 : **chaque page d'administration appelle la garde
// elle-même**, en première instruction. Le layout garde le chrome ; il ne protège pas les
// pages. C'est exactement ce que la documentation Next dit de faire (vérifier dans la couche
// d'accès aux données plutôt que de s'en remettre à un point de passage unique).
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const admin = await lireAdmin();
  if (admin === null) redirect("/admin/login");

  return (
    <>
      <h1 className={styles.titre}>Back-office</h1>
      <p className={styles.chapo}>
        Bonjour {admin?.nom ?? "et bienvenue"}. C&rsquo;est ici que se gère tout ce qui vit
        sur le site, sans passer par un développeur.
      </p>

      {SECTIONS_ADMIN.length === 0 ? (
        /* 🔴 ÉTAT VIDE ASSUMÉ, ET IL DIT CE QUI ARRIVE.
           Le registre `SECTIONS_ADMIN` est volontairement vide au merge de la Story 6.1 :
           aucune section n'a encore d'écran, et le shell ne doit promettre AUCUNE porte
           sans pièce (le défaut s'était produit deux fois — voir `_sections.ts`).
           ⚠️ Un état vide qui dirait « aucune section » se lirait comme une panne. Celui-ci
           annonce la suite, comme les états vides de la home (3.2) et d'/agenda (3.3). */
        <div className={styles.vide}>
          <p className={styles.videTitre}>Les sections arrivent une par une.</p>
          <p className={styles.videTexte}>
            L&rsquo;accès et la connexion sont en place. L&rsquo;agenda, la galerie, les
            partenaires, les ateliers, les membres, les sollicitations et les réglages
            s&rsquo;ajouteront ici au fil des prochaines livraisons — chacune apparaîtra
            d&rsquo;elle-même dans le menu dès qu&rsquo;elle existera.
          </p>
        </div>
      ) : (
        <ul className={styles.grille}>
          {SECTIONS_ADMIN.map((section) => (
            <li key={section.href}>
              <Link className={styles.carte} href={section.href}>
                <span className={styles.carteTitre}>{section.libelle}</span>
                <span className={styles.carteTexte}>{section.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
