import { createClient } from '@insforge/sdk';

// isServerMode is the only client mode that returns a body-based refreshToken
// (client_type=mobile flow) instead of relying on an httpOnly browser cookie,
// which React Native has no equivalent of. It's marked @deprecated upstream
// in favor of SSR helpers that only apply to Next.js -- there is no
// non-deprecated native/mobile path yet (reported to InsForge, feedback id
// 98fbb858-ac36-4e0f-9a25-d737990d5a1a). This is the one file that would
// need to change if that's replaced.
export const backend = createClient({
  baseUrl: process.env.EXPO_PUBLIC_INSFORGE_URL,
  anonKey: process.env.EXPO_PUBLIC_INSFORGE_ANON_KEY,
  isServerMode: true,
});
