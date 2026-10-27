import { createContext } from 'react';
import type { User, Farm } from '../types';

export interface AuthContextType {
  user: User | null;
  farm: Farm | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
