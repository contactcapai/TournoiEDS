// Charge automatiquement tous les logos PNG deposes dans frontend/src/assets/partners/
// — aucune mise a jour de code necessaire quand Brice ajoute/retire un logo.
const modules = import.meta.glob('../../assets/partners/*.{png,jpg,jpeg,webp,svg}', {
  eager: true,
  import: 'default',
});

/**
 * 🔴 NOM RÉEL DU PARTENAIRE PAR NOM DE FICHIER (posé par la Story 4.1 de la vitrine).
 *
 * Avant cette table, le nom annoncé aux lecteurs d'écran était DÉRIVÉ DU NOM DE
 * FICHIER. En production, les quatre partenaires étaient donc annoncés « Fichier 3 »,
 * « LOGO V3 BLANC (1) », « logo clavicule (1) » et « logotype orange » — soit zéro
 * information utile sur quatre. Un logo dit QUI soutient l'association : c'est
 * exactement ce que le texte alternatif doit porter.
 *
 * ⚠️ L'ATTRIBUTION A ÉTÉ ÉTABLIE PAR L'IMAGE, PAS PAR LE NOM DE FICHIER. Deux de ces
 * logos sont blancs sur fond transparent, donc invisibles sur fond clair : il a fallu
 * les composer sur le navy de la charte pour les identifier. Ne JAMAIS réattribuer une
 * entrée d'après son nom de fichier — c'est précisément ce que ce correctif défait.
 *
 * ⚠️ Cette app est « à moderniser dans un second temps » (project-context.md §1) : la
 * Story 4.1 n'y touche QUE ces textes alternatifs. Son défilement ne s'arrête toujours
 * qu'au SURVOL (`[@media(hover:hover)]:group-hover:` plus bas) — ni au doigt, ni au
 * clavier, ce qui est un manquement à WCAG 2.2.2. C'est un vrai défaut, connu, et sa
 * correction est un autre chantier : le corriger ici en aurait fait un chantier déguisé.
 * La vitrine, elle, a un bouton de pause réel (`components/proof/PartnerMarquee/`).
 */
const NOMS_PAR_FICHIER: Record<string, string> = {
  'logo clavicule (1).webp': 'Shop for Geek Reims',
  // ⚠️ « LDLC Cormontreuil » et NON « LDLC Reims Cormontreuil », qui est ce que le
  // logo affiche. Quatre sources du projet écrivent la première forme (la maquette,
  // `positionnement-refonte-site-v2.md` §5, le brief de refonte, et l'AC de la story) ;
  // c'est aussi le nom stocké en base par la vitrine. Deux surfaces publiques qui
  // nomment différemment le même partenaire, c'est une incohérence visible.
  'Fichier 3.webp': 'LDLC Cormontreuil',
  'logotype-orange.webp': 'Forgeblast',
  'LOGO-V3-BLANC (1).webp': "L'Antre de Reims",
};

interface Partner {
  name: string;
  logoUrl: string;
}

const partners: Partner[] = Object.entries(modules)
  .map(([path, url]) => {
    const filename = path.split('/').pop() ?? '';
    // 🔴 REPLI VOLONTAIRE SUR L'ANCIEN COMPORTEMENT pour un fichier NON LISTÉ.
    // Tout l'intérêt de ce composant est que déposer un logo dans le dossier suffise :
    // exiger une entrée dans la table ci-dessus ferait DISPARAÎTRE du carrousel tout
    // nouveau logo, en silence. Un nom dérivé est médiocre ; une absence est pire.
    // Un nom dérivé qui apparaît dans le rendu est d'ailleurs le signal visible qu'il
    // reste une ligne à ajouter ici.
    const rawName = filename.replace(/\.[^.]+$/, '');
    const derive = rawName.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Partenaire';
    return { name: NOMS_PAR_FICHIER[filename] ?? derive, logoUrl: url as string };
  })
  // Tri par nom RÉEL désormais, et non plus par nom de fichier : l'ordre affiché change
  // donc (Forgeblast et LDLC permutent). C'est la conséquence directe et assumée du
  // correctif — trier des logos par le nom de leur fichier n'avait aucun sens visible.
  .sort((a, b) => a.name.localeCompare(b.name));

export default function PartnersMarquee() {
  if (partners.length === 0) return null;

  const loop = [...partners, ...partners];

  return (
    <div className="w-full max-w-md">
      <p className="mb-2 text-center font-heading text-xs uppercase tracking-[0.2em] text-eds-cyan/80 md:text-sm">
        Nos partenaires
      </p>
      <div
        className="group relative overflow-hidden rounded-lg border border-eds-gray/20 bg-eds-dark/40 py-3"
        aria-label="Partenaires du tournoi"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-eds-dark to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-eds-dark to-transparent"
        />
        <ul className="flex w-max items-center gap-10 motion-safe:animate-[marqueeScroll_22s_linear_infinite] [@media(hover:hover)]:group-hover:[animation-play-state:paused]">
          {loop.map((p, idx) => (
            <li
              key={`${p.name}-${idx}`}
              className="shrink-0"
              aria-hidden={idx >= partners.length ? 'true' : undefined}
            >
              <img
                src={p.logoUrl}
                alt={idx >= partners.length ? '' : p.name}
                className="h-10 w-auto max-w-[140px] object-contain opacity-90 transition-opacity hover:opacity-100 md:h-12"
                loading="lazy"
                draggable={false}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
