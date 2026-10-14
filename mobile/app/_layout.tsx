import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { queryClient } from '../lib/queryClient';
import { useAuthStore } from '../features/auth/store';
import { useSessionHydration } from '../features/auth/useAuth';
import { colors, useThemeMode } from '../theme';
import { DialogHost } from '../components/Dialog';

// Sin DSN (dev local) el SDK queda deshabilitado.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !__DEV__,
});

// Module-level, once per process: controls how a push is presented while
// the app is in the foreground (otherwise it's silently swallowed).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function RootNavigator() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  // Mínimo de 2 s en el splash para que se alcance a ver, aunque la sesión cargue antes.
  const [minElapsed, setMinElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 2000);
    return () => clearTimeout(t);
  }, []);

  if (loading || !minElapsed) {
    return (
      <Image source={require('../assets/splash.jpg')} style={{ flex: 1, backgroundColor: '#000' }} contentFit="cover" />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="news/[id]" options={{ animation: 'fade_from_bottom' }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
        {/* Después de (auth): al cerrar sesión se cae en sign-in, no aquí. Solo
            se entra desde index la primera vez. */}
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default Sentry.wrap(RootLayout);

function RootLayout() {
  useSessionHydration();
  // Suscrito al tema: re-renderiza navegación, status bar y splash al cambiarlo.
  const mode = useThemeMode((s) => s.mode);
  // Pinta fondos de escenas, tab bar y transiciones con la paleta de la app
  // (sin flash blanco al navegar).
  const navTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      primary: colors.accent,
      background: colors.bg,
      card: colors.bg,
      text: colors.ink,
      border: colors.border,
      notification: colors.danger,
    },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={navTheme}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <RootNavigator />
        <DialogHost />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
