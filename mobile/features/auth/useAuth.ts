import { useEffect } from 'react';
import * as backendAuth from '../../services/backend';
import { useAuthStore } from './store';

// Runs once from the root layout to hydrate session state on app launch,
// then keeps it in sync (token refresh, sign-out from another tab/device).
export function useSessionHydration() {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    let cancelled = false;
    backendAuth.restoreSession().then((user) => {
      if (!cancelled) {
        setUser(user);
        setLoading(false);
      }
    });

    const unsubscribe = backendAuth.onAuthStateChange((user) => {
      if (!cancelled) setUser(user);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setUser, setLoading]);
}

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const setUser = useAuthStore((s) => s.setUser);

  return {
    user,
    loading,
    async signIn(email: string, password: string) {
      const { user, error } = await backendAuth.signInWithPassword({ email, password });
      if (user) setUser(user);
      return { error };
    },
    async signUp(email: string, password: string, name: string) {
      const { user, requiresEmailConfirmation, error } = await backendAuth.signUp({ email, password, name });
      if (user && !requiresEmailConfirmation) setUser(user);
      return { error, requiresEmailConfirmation };
    },
    async signOut() {
      await backendAuth.signOut();
      setUser(null);
    },
  };
}
