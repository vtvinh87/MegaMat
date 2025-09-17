
import { createContext, useContext } from 'react';
import { User } from '../types';

export interface AuthContextType {
  currentUser: User | null;
  login: (username: string, password?: string) => Promise<User | null>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AppProvider');
  }
  return context;
};
