import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { loginAdmin } from '../services/api';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await loginAdmin({ username, password });

      if ('error' in result) {
        setError(result.error.message);
      } else {
        login(result.data.token);
        navigate('/admin', { replace: true });
      }
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-eds-dark">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 px-4" noValidate>
        <h1 className="text-center font-heading text-3xl text-eds-cyan">
          Backoffice Admin
        </h1>

        <div>
          <label htmlFor="username" className="mb-1 block font-body text-sm font-medium text-eds-white">
            Identifiant
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            className="w-full rounded border border-eds-gray/40 bg-eds-dark px-4 py-2 font-body text-eds-white placeholder-eds-gray/60 outline-none transition-colors focus:border-eds-cyan"
            placeholder="admin"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block font-body text-sm font-medium text-eds-white">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="w-full rounded border border-eds-gray/40 bg-eds-dark px-4 py-2 font-body text-eds-white placeholder-eds-gray/60 outline-none transition-colors focus:border-eds-cyan"
            placeholder="Mot de passe"
          />
        </div>

        {error && (
          <p className="rounded border border-red-400/30 bg-red-400/10 px-4 py-2 font-body text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-eds-cyan px-6 py-3 font-heading text-xl text-eds-dark transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Connexion...' : 'Connexion'}
        </button>
      </form>
    </div>
  );
}
