import Link from "next/link";
import { redirect } from "next/navigation";

import { lireCompte } from "@/server/auth/guard";
import { sectionsPour } from "../_sections";
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
  // ⚠️ AUCUN RÔLE EXIGÉ : le tableau de bord doit rester atteignable par un compte qui n'en
  // porte aucun — c'est le seul endroit qui peut lui DIRE pourquoi il ne voit rien.
  const compte = await lireCompte();
  if (compte === null) redirect("/admin/login");

  const sections = sectionsPour(compte.roles);

  return (
    <>
      <h1 className={styles.titre}>Back-office</h1>
      <p className={styles.chapo}>
        Bonjour {compte.nom ?? "et bienvenue"}. C&rsquo;est ici que se gère tout ce qui vit
        sur le site, sans passer par un développeur.
      </p>

      {sections.length === 0 ? (
        /* ══════════════════════════════════════════════════════════════════════════════
           🔴 ÉTAT VIDE RÉÉCRIT PAR LA STORY 8.1 — IL NE PARLE PLUS DE LA MÊME CHOSE
           ══════════════════════════════════════════════════════════════════════════════
           Il disait « les sections arrivent une par une », ce qui était vrai au merge de la
           6.1 quand le registre était vide. Le registre en compte neuf : cette phrase serait
           désormais FAUSSE, et vue par la seule personne à qui elle serait servie — un
           compte connecté SANS AUCUN RÔLE. C'est le motif « une phrase devenue fausse en
           silence » déjà payé en 10.9.
           ⚠️ Il dit ce qui s'est passé ET quoi faire. Un écran vide qui n'explique rien se
           lit comme une panne, et la personne réessaie au lieu de demander un accès. */
        <div className={styles.vide}>
          <p className={styles.videTitre}>Votre compte n&rsquo;ouvre aucune section.</p>
          <p className={styles.videTexte}>
            Vous êtes bien connecté — c&rsquo;est l&rsquo;essentiel, et c&rsquo;est ce qui
            permet qu&rsquo;on vous attribue un accès. Demandez à un responsable de
            l&rsquo;association d&rsquo;ouvrir les droits dont vous avez besoin&nbsp;: il le
            fait depuis le back-office, et cela prend effet immédiatement.
          </p>
        </div>
      ) : (
        <ul className={styles.grille}>
          {sections.map((section) => (
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
