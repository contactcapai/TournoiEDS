import { useState, type ReactNode } from 'react';
import { AuthContext } from './auth-context';

const TOKEN_KEY = 'auth_token';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored && !isTokenExpired(stored)) {
      return stored;
    }
    if (stored) {
      localStorage.removeItem(TOKEN_KEY);
    }
    return null;
  });

  const login = (newToken: string) => {
    // Garde anti-token-expire. Remplace l'ancien useEffect qui appelait setToken
    // de maniere synchrone (react-hooks/set-state-in-effect). Comportement equivalent :
    // l'initialiseur de useState filtre deja les tokens expires au montage, et `login`
    // est le seul autre point qui pose un token -> valider ici couvre exactement les
    // memes cas, sans cascade de rendus.
    if (isTokenExpired(newToken)) {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      return;
    }
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
