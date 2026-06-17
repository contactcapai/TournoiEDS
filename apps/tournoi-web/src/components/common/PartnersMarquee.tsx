// Charge automatiquement tous les logos PNG deposes dans frontend/src/assets/partners/
// — aucune mise a jour de code necessaire quand Brice ajoute/retire un logo.
const modules = import.meta.glob('../../assets/partners/*.{png,jpg,jpeg,webp,svg}', {
  eager: true,
  import: 'default',
});

interface Partner {
  name: string;
  logoUrl: string;
}

const partners: Partner[] = Object.entries(modules)
  .map(([path, url]) => {
    const filename = path.split('/').pop() ?? '';
    const rawName = filename.replace(/\.[^.]+$/, '');
    const name = rawName.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Partenaire';
    return { name, logoUrl: url as string };
  })
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
