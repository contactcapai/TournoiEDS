import { useState } from 'react';
import { registerPlayer } from '../../services/api';
import type { RegisterPlayerInput } from '../../types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  discordPseudo?: string;
  riotPseudo?: string;
  email?: string;
}

function validate(data: RegisterPlayerInput): FieldErrors {
  const errors: FieldErrors = {};
  if (!data.discordPseudo.trim()) {
    errors.discordPseudo = 'Le pseudo Discord est requis';
  }
  if (!data.riotPseudo.trim()) {
    errors.riotPseudo = 'Le pseudo Riot est requis';
  }
  if (!data.email.trim()) {
    errors.email = "L'email est requis";
  } else if (!EMAIL_REGEX.test(data.email)) {
    errors.email = "Le format de l'email est invalide";
  }
  return errors;
}

export default function InscriptionForm() {
  const [discordPseudo, setDiscordPseudo] = useState('');
  const [riotPseudo, setRiotPseudo] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const data: RegisterPlayerInput = { discordPseudo, riotPseudo, email };
    const fieldErrors = validate(data);

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setGlobalError('');
    setLoading(true);

    try {
      const result = await registerPlayer(data);

      if ('error' in result) {
        if (result.error.code === 'DUPLICATE_DISCORD_PSEUDO') {
          setErrors({ discordPseudo: result.error.message });
        } else {
          setGlobalError(result.error.message);
        }
      } else {
        setSuccess(true);
      }
    } catch {
      setGlobalError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-eds-cyan/30 bg-eds-dark p-8 text-center">
        <p className="font-heading text-2xl text-eds-cyan">Inscription confirmée !</p>
        <p className="mt-2 font-body text-eds-light/80">
          Ton inscription au tournoi est bien enregistrée. À bientôt sur le champ de bataille !
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-md space-y-5" noValidate>
      {/* Pseudo Discord */}
      <div>
        <label htmlFor="discordPseudo" className="mb-1 block font-body text-sm font-medium text-eds-white">
          Pseudo Discord
        </label>
        <input
          id="discordPseudo"
          type="text"
          value={discordPseudo}
          onChange={(e) => setDiscordPseudo(e.target.value)}
          disabled={loading}
          className="w-full rounded border border-eds-gray/40 bg-eds-dark px-4 py-2 font-body text-eds-white placeholder-eds-gray/60 outline-none transition-colors focus:border-eds-cyan"
          placeholder="Ex : MonPseudo#1234"
        />
        {errors.discordPseudo && (
          <p className="mt-1 font-body text-sm text-red-400">{errors.discordPseudo}</p>
        )}
      </div>

      {/* Pseudo Riot */}
      <div>
        <label htmlFor="riotPseudo" className="mb-1 block font-body text-sm font-medium text-eds-white">
          Pseudo Riot
        </label>
        <input
          id="riotPseudo"
          type="text"
          value={riotPseudo}
          onChange={(e) => setRiotPseudo(e.target.value)}
          disabled={loading}
          className="w-full rounded border border-eds-gray/40 bg-eds-dark px-4 py-2 font-body text-eds-white placeholder-eds-gray/60 outline-none transition-colors focus:border-eds-cyan"
          placeholder="Ex : Joueur#EUW"
        />
        {errors.riotPseudo && (
          <p className="mt-1 font-body text-sm text-red-400">{errors.riotPseudo}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="mb-1 block font-body text-sm font-medium text-eds-white">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className="w-full rounded border border-eds-gray/40 bg-eds-dark px-4 py-2 font-body text-eds-white placeholder-eds-gray/60 outline-none transition-colors focus:border-eds-cyan"
          placeholder="Ex : joueur@email.com"
        />
        {errors.email && (
          <p className="mt-1 font-body text-sm text-red-400">{errors.email}</p>
        )}
      </div>

      {/* Erreur globale */}
      {globalError && (
        <p className="rounded border border-red-400/30 bg-red-400/10 px-4 py-2 font-body text-sm text-red-400">
          {globalError}
        </p>
      )}

      {/* CTA */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-eds-cyan px-6 py-3 font-heading text-xl text-eds-dark transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Inscription en cours...' : "S'inscrire"}
      </button>
    </form>
  );
}
