import { backend } from './client';
import { currentUserId } from './auth';

// RLS ("update own profile") already scopes this to the caller's own row --
// no RPC needed.
export async function registerPushToken(token: string) {
  const userId = await currentUserId();
  if (!userId) return { error: null };
  const { error } = await backend.from('profiles').update({ expo_push_token: token }).eq('id', userId);
  return { error };
}
