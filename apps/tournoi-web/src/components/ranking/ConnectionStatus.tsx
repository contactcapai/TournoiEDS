interface ConnectionStatusProps {
  isConnected: boolean;
}

export default function ConnectionStatus({ isConnected }: ConnectionStatusProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-eds-gray/30 bg-eds-dark/60 px-3 py-1 font-body text-xs"
    >
      <span
        aria-hidden="true"
        className={`inline-block h-2 w-2 rounded-full ${
          isConnected
            ? 'bg-eds-cyan motion-safe:animate-[pulseConnected_1.8s_ease-in-out_infinite]'
            : 'bg-eds-gold'
        }`}
      />
      <span className={isConnected ? 'text-eds-cyan' : 'text-eds-gold'}>
        {isConnected ? 'En direct' : 'Reconnexion…'}
      </span>
    </span>
  );
}
