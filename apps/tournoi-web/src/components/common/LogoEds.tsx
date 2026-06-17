import logoEds from '../../assets/logo-eds.webp';

interface LogoEdsProps {
  className?: string;
}

export default function LogoEds({ className = '' }: LogoEdsProps) {
  return (
    <img
      src={logoEds}
      alt="Logo Esport des Sacres"
      aria-label="Logo Esport des Sacres"
      className={className}
      draggable={false}
      width={280}
      height={112}
    />
  );
}
