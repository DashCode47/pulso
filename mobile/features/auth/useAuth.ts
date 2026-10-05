import { useEffect } from 'react';
import * as backendAuth from '../../services/backend';
import { useAuthStore } from './store';
import { queryClient } from '../../lib/queryClient';
import { registerForPushNotifications } from '../notifications/registerForPush';

// Runs once from the root layout to hydrate session state on app launch,
// then keeps it in sync (token refresh, sign-out from another tab/device).
export function useSessionHydration() {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setIsAdmin = useAuthStore((s) => s.setIsAdmin);

  useEffect(() => {
    let cancelled = false;

    async function syncAdmin(user: Awaited<ReturnType<typeof backendAuth.restoreSession>>) {
      const admin = user ? await backendAuth.isAdmin() : false;
      if (!cancelled) setIsAdmin(admin);
    }

    backendAuth.restoreSession().then(async (user) => {
      if (cancelled) return;
      setUser(user);
      await syncAdmin(user);
      if (!cancelled) setLoading(false);
      if (user) registerForPushNotifications();
    });

    const unsubscribe = backendAuth.onAuthStateChange((user) => {
      if (cancelled) return;
      setUser(user);
      syncAdmin(user);
      if (user) registerForPushNotifications();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setUser, setLoading, setIsAdmin]);
}

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const setUser = useAuthStore((s) => s.setUser);
  const setIsAdmin = useAuthStore((s) => s.setIsAdmin);

  return {
    user,
    loading,
    isAdmin,
    async signIn(email: string, password: string) {
      const { user, error } = await backendAuth.signInWithPassword({ email, password });
      if (user) {
        setUser(user);
        setIsAdmin(await backendAuth.isAdmin());
      }
      return { error };
    },
    async signUp(email: string, password: string, name: string) {
      const { user, error } = await backendAuth.signUp({ email, password, name });
      if (user) {
        setUser(user);
        setIsAdmin(await backendAuth.isAdmin());
      }
      // No session without an error means "Confirm email" is still on in the Supabase dashboard.
      return { error: error ?? (user ? null : new Error('No se pudo iniciar sesión tras el registro.')) };
    },
    async signOut() {
      await backendAuth.signOut();
      setUser(null);
      setIsAdmin(false);
      // Per-user caches (avatar, membership, history) must not leak to the next login.
      queryClient.clear();
    },
  };
}
