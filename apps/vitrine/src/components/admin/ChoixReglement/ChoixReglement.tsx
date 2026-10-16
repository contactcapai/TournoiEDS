"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ChampTexte } from "@/components/admin/ChampTexte/ChampTexte";
import { REGLEMENT_MAX, remplir, trousDu } from "@/lib/reglement";
import formStyles from "@/styles/admin-form.module.css";
import styles from "./ChoixReglement.module.css";

export interface ChoixReglementProps {
  modeles: readonly { id: string; name: string; body: string }[];
  valeur: string;
  onChange: (valeur: string) => void;
  /** Ce que la fiche sait déjà (nom, date, lieu…) — un champ vide ne remplit rien. */
  valeursAuto: Readonly<Record<string, string>>;
  erreur?: string;
}

/**
 * Le règlement du tournoi : on part d'un modèle, la fiche remplit ce qu'elle sait, une
 * fenêtre demande le reste, puis le texte reste modifiable à la main.
 *
 * ⚠️ Les champs de la fenêtre n'ont PAS de `name` : elle vit dans le `<form>` du tournoi, et
 * rien d'elle ne doit partir avec. Entrée y est neutralisée pour la même raison.
 */
export function ChoixReglement({ modeles, valeur, onChange, valeursAuto, erreur }: ChoixReglementProps) {
  const fenetre = useRef<HTMLDialogElement>(null);
  const [modeleId, setModeleId] = useState(modeles[0]?.id ?? "");
  const [brouillon, setBrouillon] = useState("");
  const [saisies, setSaisies] = useState<Record<string, string>>({});

  const modele = modeles.find((m) => m.id === modeleId);
  const aRemplir = trousDu(brouillon);
  const remplisSeuls = modele
    ? trousDu(modele.body).filter((trou) => !aRemplir.includes(trou))
    : [];
  const restants = trousDu(valeur);

  function ouvrir() {
    if (!modele) return;
    setBrouillon(remplir(modele.body, valeursAuto));
    setSaisies({});
    fenetre.current?.showModal();
  }

  function inserer() {
    onChange(remplir(brouillon, saisies));
    fenetre.current?.close();
  }

  return (
    <>
      {modeles.length > 0 ? (
        <div className={formStyles.champ}>
          <label className={formStyles.label} htmlFor="tournoi-modeleReglement">
            Partir d&rsquo;un modèle
          </label>
          <div className={styles.rangee}>
            <select
              id="tournoi-modeleReglement"
              className={formStyles.saisie}
              value={modeleId}
              onChange={(evenement) => setModeleId(evenement.target.value)}
            >
              {modeles.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button type="button" className={styles.bouton} onClick={ouvrir}>
              Pré-remplir
            </button>
          </div>
          <p className={formStyles.sousChamp}>
            <span>
              Le nom, le jeu, la date, le lieu, le tarif, les places et les lots sont repris de
              la fiche <strong>telle qu&rsquo;elle est saisie au moment du clic</strong> : remplissez-la
              d&rsquo;abord. Le reste vous est demandé.{" "}
              <Link className={formStyles.lien} href="/admin/tournois/reglements">
                Gérer les modèles
              </Link>
            </span>
          </p>
        </div>
      ) : (
        <p className={formStyles.regle} role="note">
          Aucun modèle de règlement.{" "}
          <Link className={formStyles.lien} href="/admin/tournois/reglements/nouveau">
            En créer un
          </Link>{" "}
          — ou écrivez le règlement directement ci-dessous.
        </p>
      )}

      <ChampTexte
        id="tournoi-rules"
        name="rules"
        label="Règlement (facultatif)"
        valeur={valeur}
        onChange={onChange}
        max={REGLEMENT_MAX}
        multiligne
        lignes={16}
        aide="Publié à l'adresse /tournois/…/reglement, avec un lien depuis la page du tournoi. « # » en début de ligne fait un article, « ## » un sous-article, « - » un élément de liste ; une ligne vide sépare les paragraphes."
        erreur={erreur}
      />
      {restants.length > 0 ? (
        <p className={formStyles.avertissement} role="note">
          Il reste à compléter : {restants.map((trou) => `{{${trou}}}`).join(", ")}. Le tournoi
          ne s&rsquo;enregistrera pas tant qu&rsquo;il en reste.
        </p>
      ) : null}

      <dialog
        ref={fenetre}
        className={styles.fenetre}
        aria-labelledby="reglement-fenetre-titre"
        onKeyDown={(evenement) => {
          if (evenement.key === "Enter" && evenement.target instanceof HTMLInputElement) {
            evenement.preventDefault();
          }
        }}
      >
        <h2 id="reglement-fenetre-titre" className={styles.titre}>
          {modele?.name ?? "Règlement"}
        </h2>

        {remplisSeuls.length > 0 ? (
          <p className={styles.aide}>Repris de la fiche : {remplisSeuls.join(", ")}.</p>
        ) : null}

        {aRemplir.length > 0 ? (
          <>
            <p className={styles.aide}>
              Les informations ci-dessous ne sont pas sur la fiche. Une case laissée vide
              restera à compléter dans le texte.
            </p>
            {aRemplir.map((trou, i) => (
              <div key={trou} className={formStyles.champ}>
                <label className={formStyles.label} htmlFor={`reglement-trou-${i}`}>
                  {trou.charAt(0).toUpperCase() + trou.slice(1)}
                </label>
                <input
                  id={`reglement-trou-${i}`}
                  className={formStyles.saisie}
                  value={saisies[trou] ?? ""}
                  onChange={(evenement) =>
                    setSaisies((precedentes) => ({ ...precedentes, [trou]: evenement.target.value }))
                  }
                />
              </div>
            ))}
          </>
        ) : (
          <p className={styles.aide}>La fiche suffit : rien d&rsquo;autre à demander.</p>
        )}

        {valeur.trim() ? (
          <p className={formStyles.avertissement} role="note">
            Le règlement déjà saisi sera <strong>remplacé</strong>.
          </p>
        ) : null}

        <div className={styles.rangee}>
          <button type="button" className={styles.bouton} onClick={inserer}>
            Insérer le règlement
          </button>
          <button
            type="button"
            className={styles.boutonDiscret}
            onClick={() => fenetre.current?.close()}
          >
            Annuler
          </button>
        </div>
      </dialog>
    </>
  );
}
