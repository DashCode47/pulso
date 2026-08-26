import { backend } from './client';
import type { User } from '@supabase/supabase-js';

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
};

function toAppUser(user: User): AppUser {
  return { id: user.id, email: user.email ?? '', name: user.user_metadata?.full_name ?? null };
}

export async function signUp(params: { email: string; password: string; name: string }) {
  const { data, error } = await backend.auth.signUp({
    email: params.email,
    password: params.password,
    options: { data: { full_name: params.name } },
  });
  return {
    user: data?.user ? toAppUser(data.user) : null,
    // Supabase issues no session yet when email confirmation is required --
    // the user must click the link in their inbox before they can sign in.
    requiresEmailConfirmation: !!data?.user && !data.session,
    error,
  };
}

export async function signInWithPassword(params: { email: string; password: string }) {
  const { data, error } = await backend.auth.signInWithPassword(params);
  return { user: data?.user ? toAppUser(data.user) : null, error };
}

export async function signOut() {
  const { error } = await backend.auth.signOut();
  return { error };
}

// supabase-js reads the persisted session from LargeSecureStore
// automatically (see client.ts) -- this just surfaces it as an AppUser.
export async function restoreSession(): Promise<AppUser | null> {
  const { data } = await backend.auth.getSession();
  return data.session?.user ? toAppUser(data.session.user) : null;
}

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await backend.rpc('is_admin');
  return !error && data === true;
}

export function onAuthStateChange(callback: (user: AppUser | null) => void) {
  const { data } = backend.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ? toAppUser(session.user) : null);
  });
  return () => data.subscription.unsubscribe();
}
