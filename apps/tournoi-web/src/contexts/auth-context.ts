import { createContext } from 'react';

export interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

// Contexte isole du Provider (fichier sans composant) pour satisfaire
// react-refresh/only-export-components (Fast Refresh).
export const AuthContext = createContext<AuthContextType | null>(null);
