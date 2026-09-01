import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { CHEMIN_CONNEXION } from "@/lib/auth/chemins";
import styles from "../page.module.css";

// ══════════════════════════════════════════════════════════════════════════════════════
// « REGARDEZ VOTRE BOÎTE MAIL » (Story 8.1, PR ②)
// ══════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 ROUTE OUVERTE SANS SESSION, ET IL LE FAUT : par définition, celui qui la voit vient de
// demander un lien et n'est PAS encore connecté. La renvoyer vers la connexion au moment
// précis où le lien vient de partir ferait croire à un échec — la personne en redemanderait
// un, et le premier deviendrait caduc.
// 🔴 DEPUIS LA 12.4, ELLE L'EST PAR CONSTRUCTION ET NON PLUS PAR EXEMPTION : elle vit en
// `/connexion/verifier`, hors du matcher du proxy (`/admin/:path*`). Elle figurait avant dans
// `CHEMINS_OUVERTS` (`server/auth/sections.ts`), qui ne contient plus que les deux chemins
// HÉRITÉS, le temps que leur redirection serve.
//
// ⚠️ ELLE NE RÉPÈTE PAS L'ADRESSE SAISIE, et ce n'est pas un oubli d'ergonomie : Auth.js ne
// la transmet pas ici, et la reprendre d'un paramètre d'URL ferait afficher à cette page
// n'importe quelle adresse qu'on lui passerait. Un écran de connexion qui affiche sous
// dictée est le montage de base d'un hameçonnage.

export const metadata: Metadata = {
  title: "Lien envoyé",
  robots: { index: false, follow: false },
};

export default function VerifierPage() {
  return (
    <main className={styles.ecran} id="content">
      <div className={styles.carte}>
        <Image
          src="/logo-eds-blanc.png"
          alt="Esport des Sacres"
          width={56}
          height={56}
          className={styles.logo}
          priority
        />

        <h1 className={styles.titre}>Lien envoyé</h1>
        <p className={styles.chapo}>
          Regardez votre boîte mail&nbsp;: le lien de connexion vient de partir. Il ne
          fonctionne qu&rsquo;une fois.
        </p>

        {/* 🔴 LE DOSSIER INDÉSIRABLES EST DIT ICI, PAS APRÈS COUP. L'envoi part d'une adresse
            Gmail vers des boîtes qui ne la connaissent pas : le classement en indésirable est
            le cas ORDINAIRE, pas l'incident. Ne pas le dire ferait conclure à une panne, et
            redemander un lien — ce qui invalide celui qui vient d'arriver. */}
        <p className={styles.aide}>
          Rien au bout de deux minutes&nbsp;? Regardez dans les indésirables&nbsp;: le
          message part de <strong>esportdessacres@gmail.com</strong>, une adresse que votre
          messagerie ne connaît peut-être pas encore.
        </p>

        <p className={styles.aide}>
          <Link href={CHEMIN_CONNEXION}>Revenir à la page de connexion</Link>
        </p>
      </div>
    </main>
  );
}
