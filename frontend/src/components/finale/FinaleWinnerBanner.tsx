import { motion } from 'framer-motion';
import type { PlayerRanking } from '../../types';

interface FinaleWinnerBannerProps {
  winner: PlayerRanking;
}

export default function FinaleWinnerBanner({ winner }: FinaleWinnerBannerProps) {
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="mb-8 rounded-xl border-2 border-eds-gold bg-eds-gold/10 py-8 px-6 text-center motion-safe:animate-heroGlow"
    >
      <div className="text-6xl md:text-8xl" aria-hidden="true">
        🏆
      </div>
      <h1 className="mt-4 font-heading text-5xl md:text-7xl text-eds-gold">
        {winner.discordPseudo}
      </h1>
      <p className="mt-2 font-body text-xl text-eds-light">
        Vainqueur EDS — {winner.totalScore} pts cumules finale
      </p>
    </motion.div>
  );
}
