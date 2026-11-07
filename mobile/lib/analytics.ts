import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { Mixpanel } from 'mixpanel-react-native';
import { useThemeMode } from '../theme';

export type EventProperties = Record<string, string | number | boolean | null>;

// Product analytics (Mixpanel), JavaScript mode: events queue in AsyncStorage
// and are sent in batches, so nothing is lost offline. No native module.
//
// Env (mobile/.env):
//   EXPO_PUBLIC_MIXPANEL_TOKEN       project token (public, like the Supabase key)
//   EXPO_PUBLIC_MIXPANEL_SERVER_URL  only for EU-residency projects: https://api-eu.mixpanel.com
//   EXPO_PUBLIC_MIXPANEL_IN_DEV=1    send events from dev builds too (to verify the setup);
//                                    otherwise dev builds only log them to the console.
//
// Keep event names in Title Case and stable: renaming one splits its history.

const token = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;
const enabled = !!token && (!__DEV__ || process.env.EXPO_PUBLIC_MIXPANEL_IN_DEV === '1');

const mixpanel = enabled ? new Mixpanel(token!, false, false, AsyncStorage) : null;

const ready: Promise<void> = mixpanel
  ? mixpanel
      .init(
        false,
        {
          platform: Platform.OS,
          app_version: Constants.expoConfig?.version ?? 'unknown',
          theme: useThemeMode.getState().mode,
        },
        process.env.EXPO_PUBLIC_MIXPANEL_SERVER_URL,
      )
      .catch((e) => console.warn('[analytics] init failed', e))
  : Promise.resolve();

// Analytics must never break the app: every call is fire-and-forget.
function run(fn: (mp: Mixpanel) => unknown) {
  if (!mixpanel) return;
  ready.then(() => fn(mixpanel)).catch((e) => console.warn('[analytics]', e));
}

export function track(event: string, properties?: EventProperties) {
  if (__DEV__ && !mixpanel) console.log('[analytics]', event, properties ?? '');
  run((mp) => mp.track(event, properties));
}

let identifiedId: string | null = null;

// Ties events to the Supabase user id, so one member's flow can be followed
// across devices and reinstalls.
export function identify(user: { id: string; name: string | null }, isAdmin: boolean) {
  run(async (mp) => {
    if (identifiedId !== user.id) {
      await mp.identify(user.id);
      identifiedId = user.id;
    }
    mp.getPeople().set({ ...(user.name ? { $name: user.name } : {}), is_admin: isAdmin, theme: useThemeMode.getState().mode });
    mp.registerSuperProperties({ is_admin: isAdmin });
  });
}

// On sign-out: the next person on this phone starts as a new anonymous user.
export function resetIdentity() {
  identifiedId = null;
  run((mp) => mp.reset());
}

// Theme (Profile switch): kept on every event as `theme`, on the member's
// profile, and a "Theme Changed" event when it flips.
useThemeMode.subscribe((state, prev) => {
  if (state.mode === prev.mode) return;
  run((mp) => {
    mp.registerSuperProperties({ theme: state.mode });
    mp.getPeople().set('theme', state.mode);
  });
  track('Theme Changed', { theme: state.mode, from: prev.mode });
});
