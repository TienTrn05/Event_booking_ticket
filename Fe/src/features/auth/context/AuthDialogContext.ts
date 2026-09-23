import { createContext, useContext } from 'react';

export type AuthIntent = 'login' | 'register' | 'tickets' | 'organizer' | 'checkout';

export const AuthDialogContext = createContext<{
  openAuth: (intent: AuthIntent) => void;
} | null>(null);

export function useAuthDialog() {
  const context = useContext(AuthDialogContext);
  if (!context) throw new Error('useAuthDialog must be used inside AuthDialogProvider');
  return context;
}
