import styles from "@/styles/admin-form.module.css";

/**
 * Champ de sélection de fichier du back-office (extrait par la Story 6.5).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════
 * 🔴 EXTRAIT AU 2ᵉ CONSOMMATEUR — ET LE COMPTE A ÉTÉ FAIT AVANT, PAS APRÈS
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * `PhotoUploader` (6.4) annonçait littéralement cette extraction : *« Il s'extraira quand la
 * Story 6.5 (logos) en fera le 2ᵉ consommateur — pas avant. »* ⚠️ **Une promesse ne dispense
 * pas de compter** (leçon R9 : *toujours COMPTER*), et le comptage a bien failli conclure
 * l'inverse. Ce qui l'a tranché n'est pas le JSX :
 *
 * | Ce qui est payé deux fois | Identique ? |
 * |---|---|
 * | l'ossature `champ` + `label` + `input[type=file]` + `sousChamp` | oui — mais **8 lignes** |
 * | 🔴 **le style du contrôle natif** (`.fichier` : filet pointillé, 44 px, focus or) | **oui, et c'est LUI qui tranche** |
 * | `accept` (les 4 formats servables) | oui |
 * | `multiple` | **non** — un lot de photos vs un seul logo |
 * | l'état `disabled` pendant l'envoi | **non** — la galerie a une boucle à protéger, pas ici |
 * | le texte d'aide | **non** — le refus du SVG doit proposer une sortie côté logos |
 *
 * 🔴 SANS L'EXTRACTION, C'EST LE **CSS** QUI DIVERGERAIT, ET EN SILENCE. Le JSX dupliqué se
 * voit dans un diff ; deux `.fichier` dans deux `*.module.css` différents, non. Quelqu'un qui
 * ajusterait le filet ou la cible tactile d'un côté laisserait l'autre derrière, et **aucune
 * porte ne le dirait** — `gate` ne couvre pas `/admin`, et Lighthouse n'audite que les pages
 * publiques. C'est la famille de `pieges/dette-invisible.md`, exactement l'argument qui a fait
 * extraire `visiblementVide` au 2ᵉ consommateur plutôt qu'au 3ᵉ.
 *
 * ⇒ Le style part donc dans `styles/admin-form.module.css` (le vocabulaire de formulaire
 * partagé), et ce composant n'est que l'ossature qui le consomme.
 *
 * 🔴 API MINIMALE, ET LES DEUX PROPS OPTIONNELLES SONT **PAYÉES**, pas anticipées : `multiple`
 * par `PhotoUploader`, `disabled` par lui aussi. Aucune 3ᵉ prop « au cas où » — c'est ce que
 * le commentaire de `SectionHead` interdit nommément.
 *
 * ⚠️ ON NE REMPLACE PAS LE CONTRÔLE NATIF par un faux bouton : il porte l'accessibilité
 * clavier, l'annonce du lecteur d'écran et le glisser-déposer du système — trois choses qu'un
 * `<div>` stylé redemanderait de réécrire, moins bien.
 */
export interface ChampFichierProps {
  id: string;
  label: string;
  /**
   * ⚠️ `accept` est un CONFORT DE SÉLECTION, jamais une garde : il filtre la boîte de dialogue
   * du système et rien d'autre. Le vrai contrôle est côté serveur, sur le CONTENU (`sharp`),
   * et il refuse un exécutable renommé `.jpg`.
   */
  accept: string;
  /** Une phrase sous le champ : formats acceptés, poids, et ce que le serveur refusera. */
  aide: React.ReactNode;
  /** Plusieurs fichiers d'un coup. Payé par `PhotoUploader` (un lot), pas par les logos. */
  multiple?: boolean;
  /**
   * ⚠️ Payé UNIQUEMENT par `PhotoUploader`, et ce n'est pas une entorse au patron 5.1
   * (« jamais de bouton grisé pendant une latence ») : là-bas, changer la sélection pendant
   * l'envoi remplace le tableau sur lequel la boucle itère, et **l'avancement se fige à
   * l'écran pendant que les écritures continuent**. Le patron interdit de griser une ACTION
   * qu'on peut refaire ; il ne demande pas de laisser ouvrir une course invisible.
   */
  disabled?: boolean;
  onChange: (fichiers: FileList | null) => void;
}

export function ChampFichier({
  id,
  label,
  accept,
  aide,
  multiple = false,
  disabled = false,
  onChange,
}: ChampFichierProps) {
  const idAide = `${id}-aide`;

  return (
    <div className={styles.champ}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.fichier}
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={disabled}
        aria-describedby={idAide}
        onChange={(evenement) => onChange(evenement.target.files)}
      />
      <p className={styles.sousChamp}>
        <span id={idAide}>{aide}</span>
      </p>
    </div>
  );
}
