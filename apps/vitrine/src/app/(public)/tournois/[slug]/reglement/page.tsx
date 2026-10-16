import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionHead } from "@/components/common/SectionHead/SectionHead";
import { Wrap } from "@/components/common/Wrap/Wrap";
import { blocsDuReglement } from "@/lib/reglement";
import { getReglementPublic } from "@/server/db/queries/reglements";
import editorial from "@/styles/editorial.module.css";
import styles from "./page.module.css";

// Le règlement d'un tournoi publié, à sa propre adresse — celle que l'article 12 du modèle
// TFT désigne comme « version de référence ». Pas de règlement ⇒ 404, jamais une page vide.

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const reglement = await getReglementPublic(slug);
  if (!reglement) return { title: "Règlement introuvable" };
  return {
    title: `Règlement — ${reglement.name}`,
    description: `Le règlement officiel du tournoi ${reglement.name} (${reglement.game}), organisé par Esport des Sacres.`,
  };
}

export default async function ReglementPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const reglement = await getReglementPublic(slug);
  if (!reglement) notFound();

  return (
    <>
      <section className={editorial.head} aria-labelledby="reglement-title">
        <Wrap>
          <SectionHead
            headingLevel={1}
            titleId="reglement-title"
            eyebrow="Règlement officiel"
            title={reglement.name}
          />
          <p className={styles.retour}>
            <Link className={styles.lien} href={`/tournois/${reglement.slug}`}>
              Retour à la page du tournoi
            </Link>
          </p>
        </Wrap>
      </section>

      <section className={editorial.section}>
        <Wrap>
          <div className={`${editorial.prose} ${styles.texte}`}>
            {blocsDuReglement(reglement.rules).map((bloc, i) =>
              bloc.type === "titre" ? (
                <h2 key={i} className={styles.article}>
                  {bloc.texte}
                </h2>
              ) : bloc.type === "sousTitre" ? (
                <h3 key={i} className={styles.sousArticle}>
                  {bloc.texte}
                </h3>
              ) : bloc.type === "liste" ? (
                <ul key={i} className={styles.liste}>
                  {bloc.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p key={i}>{bloc.texte}</p>
              ),
            )}
          </div>
        </Wrap>
      </section>
    </>
  );
}
