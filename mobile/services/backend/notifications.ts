import { backend } from './client';

// RLS ("update own profile") already scopes this to the caller's own row --
// no RPC needed.
export async function registerPushToken(token: string) {
  const {
    data: { user },
  } = await backend.auth.getUser();
  if (!user) return { error: null };
  const { error } = await backend.from('profiles').update({ expo_push_token: token }).eq('id', user.id);
  return { error };
}
