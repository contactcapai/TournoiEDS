import styles from "@/styles/admin-form.module.css";

/**
 * Champ de texte du back-office : libellé, saisie contrôlée, compteur de caractères et
 * message d'erreur (Story 6.3).
 *
 * 🔴 C'EST UN CHAMP, PAS UN FORMULAIRE. Il ne connaît ni Zod, ni les Server Actions, ni
 * l'état de soumission — la story interdit explicitement d'écrire un « formulaire d'admin
 * générique » pour six surfaces qui n'existent pas encore. Il est extrait parce qu'il est
 * payé **neuf fois dès cette story** (cinq champs dans `EventForm`, quatre dans
 * `BarForm`), pas par anticipation. Leçon de R9 : *toujours COMPTER*.
 *
 * 🔴 LE COMPTEUR EST LA MOITIÉ VISIBLE DE LA DETTE R26. Sa borne vient du schéma Zod
 * partagé, jamais d'un littéral recopié ici — et elle n'est PAS un `maxlength`, qui
 * bloquerait la frappe en silence. R26 reprochait précisément qu'« un bénévole peut
 * écrire un texte dont la fin ne sera jamais lue par personne, sans le savoir » : on le
 * laisse dépasser, et on le lui DIT.
 *
 * ⚠️ Pas de `ref` : le focus au premier champ en erreur passe par `document.getElementById`
 * côté formulaire. Faire remonter neuf refs à travers un composant partagé aurait coûté
 * plus de plomberie que la garde ne vaut, pour un résultat identique à l'écran.
 */
export interface ChampTexteProps {
  id: string;
  name: string;
  label: string;
  valeur: string;
  onChange: (valeur: string) => void;
  /** Borne du schéma Zod. Affiche le compteur ; ne bloque jamais la frappe. */
  max?: number;
  /** Rend un `<textarea>` plutôt qu'un `<input>`. */
  multiligne?: boolean;
  type?: "text" | "datetime-local";
  /** Une phrase sous le champ : ce que la personne doit y mettre. */
  aide?: string;
  erreur?: string;
  autoComplete?: string;
}

export function ChampTexte({
  id,
  name,
  label,
  valeur,
  onChange,
  max,
  multiligne = false,
  type = "text",
  aide,
  erreur,
  autoComplete,
}: ChampTexteProps) {
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
  // `aria-describedby` accepte plusieurs identifiants : l'aide ET l'erreur sont annoncées,
  // dans cet ordre. N'en garder qu'une ferait disparaître la consigne au moment précis où
  // la personne en a besoin.
  const decritPar = [aide ? idAide : null, erreur ? idErreur : null].filter(Boolean).join(" ");

  const commun = {
    id,
    name,
    value: valeur,
    onChange: (evenement: { target: { value: string } }) => onChange(evenement.target.value),
    "aria-invalid": erreur ? ("true" as const) : undefined,
    "aria-describedby": decritPar || undefined,
    autoComplete,
  };

  // ⚠️ On compte la valeur ROGNÉE, pas la valeur brute — trouvé en revue (Blind Hunter).
  // Zod borne après `.trim()` : compter les espaces de tête et de queue affichait « 82 / 80 »
  // sur un texte que le serveur allait accepter. Faux avertissement, jamais faux négatif —
  // mais un compteur qui crie à tort est un compteur qu'on cesse de lire.
  const longueur = valeur.trim().length;
  const depasse = max !== undefined && longueur > max;

  return (
    <div className={styles.champ}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>

      {multiligne ? (
        <textarea className={styles.zone} rows={5} {...commun} />
      ) : (
        <input className={styles.saisie} type={type} {...commun} />
      )}

      {(aide || max !== undefined) && (
        <p className={styles.sousChamp}>
          {aide ? <span id={idAide}>{aide}</span> : null}
          {max !== undefined ? (
            /* `aria-live` seulement quand la borne est franchie : annoncer chaque frappe
               rendrait le lecteur d'écran inutilisable. */
            <span className={styles.compteur} aria-live={depasse ? "polite" : "off"}>
              {longueur} / {max}
            </span>
          ) : null}
        </p>
      )}

      {erreur ? (
        <p id={idErreur} className={styles.erreur}>
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
