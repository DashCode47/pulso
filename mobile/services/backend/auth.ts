import { backend } from './client';
import { secureStorage } from './secureStorage';

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
};

function toAppUser(user: { id: string; email: string; profile: { name?: string } | null }): AppUser {
  return { id: user.id, email: user.email, name: user.profile?.name ?? null };
}

export async function signUp(params: { email: string; password: string; name: string }) {
  const { data, error } = await backend.auth.signUp(params);
  if (data?.refreshToken) await secureStorage.setRefreshToken(data.refreshToken);
  return {
    user: data?.user ? toAppUser(data.user) : null,
    requireEmailVerification: data?.requireEmailVerification ?? false,
    error,
  };
}

export async function verifyEmail(params: { email: string; otp: string }) {
  const { data, error } = await backend.auth.verifyEmail(params);
  if (data?.refreshToken) await secureStorage.setRefreshToken(data.refreshToken);
  return { user: data?.user ? toAppUser(data.user) : null, error };
}

export async function signInWithPassword(params: { email: string; password: string }) {
  const { data, error } = await backend.auth.signInWithPassword(params);
  if (data?.refreshToken) await secureStorage.setRefreshToken(data.refreshToken);
  return { user: data?.user ? toAppUser(data.user) : null, error };
}

export async function signOut() {
  const { error } = await backend.auth.signOut();
  await secureStorage.clearRefreshToken();
  return { error };
}

// Called once on app launch. There's no browser session to read on cold
// start (see client.ts), so this is the only way the app knows whether the
// user is still signed in.
export async function restoreSession(): Promise<AppUser | null> {
  const refreshToken = await secureStorage.getRefreshToken();
  if (!refreshToken) return null;

  const { data, error } = await backend.auth.refreshSession({ refreshToken });
  if (error || !data) {
    await secureStorage.clearRefreshToken();
    return null;
  }
  return toAppUser(data.user);
}
