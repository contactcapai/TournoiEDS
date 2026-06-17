export default function AnimatedSideDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 right-0 -z-10 hidden overflow-hidden motion-reduce:hidden lg:block"
    >
      <svg
        className="absolute inset-y-0 left-0 h-full w-24 opacity-30"
        viewBox="0 0 100 1000"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="lineGradCyanL" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#80E2ED" stopOpacity="0" />
            <stop offset="50%" stopColor="#80E2ED" stopOpacity="1" />
            <stop offset="100%" stopColor="#80E2ED" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineGradGoldL" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DAB265" stopOpacity="0" />
            <stop offset="50%" stopColor="#DAB265" stopOpacity="1" />
            <stop offset="100%" stopColor="#DAB265" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1="20"
          y1="-200"
          x2="20"
          y2="1200"
          stroke="url(#lineGradCyanL)"
          strokeWidth="1.5"
          className="animate-[lineDrift_10s_linear_infinite]"
        />
        <line
          x1="55"
          y1="-200"
          x2="55"
          y2="1200"
          stroke="url(#lineGradGoldL)"
          strokeWidth="1"
          className="animate-[lineDrift_14s_linear_infinite]"
          style={{ animationDelay: '-3s' }}
        />
        <line
          x1="85"
          y1="-200"
          x2="85"
          y2="1200"
          stroke="url(#lineGradCyanL)"
          strokeWidth="1"
          className="animate-[lineDrift_12s_linear_infinite]"
          style={{ animationDelay: '-6s' }}
        />
      </svg>
      <svg
        className="absolute inset-y-0 right-0 h-full w-24 opacity-30"
        viewBox="0 0 100 1000"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="lineGradCyanR" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#80E2ED" stopOpacity="0" />
            <stop offset="50%" stopColor="#80E2ED" stopOpacity="1" />
            <stop offset="100%" stopColor="#80E2ED" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineGradGoldR" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DAB265" stopOpacity="0" />
            <stop offset="50%" stopColor="#DAB265" stopOpacity="1" />
            <stop offset="100%" stopColor="#DAB265" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1="15"
          y1="-200"
          x2="15"
          y2="1200"
          stroke="url(#lineGradCyanR)"
          strokeWidth="1"
          className="animate-[lineDrift_13s_linear_infinite]"
          style={{ animationDelay: '-2s' }}
        />
        <line
          x1="45"
          y1="-200"
          x2="45"
          y2="1200"
          stroke="url(#lineGradGoldR)"
          strokeWidth="1.5"
          className="animate-[lineDrift_11s_linear_infinite]"
          style={{ animationDelay: '-5s' }}
        />
        <line
          x1="80"
          y1="-200"
          x2="80"
          y2="1200"
          stroke="url(#lineGradCyanR)"
          strokeWidth="1"
          className="animate-[lineDrift_9s_linear_infinite]"
          style={{ animationDelay: '-7s' }}
        />
      </svg>
    </div>
  );
}
