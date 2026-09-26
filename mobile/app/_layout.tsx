import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, ThemeProvider, DarkTheme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { queryClient } from '../lib/queryClient';
import { useAuthStore } from '../features/auth/store';
import { useSessionHydration } from '../features/auth/useAuth';
import { colors } from '../theme';
import { PulseLine } from '../components/PulseLine';
import { DialogHost } from '../components/Dialog';

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

// Pinta fondos de escenas, tab bar y transiciones con la paleta de la app
// (sin flash blanco al navegar).
const navTheme = {
  ...DarkTheme,
  colors: {
    primary: colors.accent,
    background: colors.bg,
    card: colors.bg,
    text: colors.ink,
    border: colors.border,
    notification: colors.danger,
  },
};

function RootNavigator() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <PulseLine width={120} height={40} />
      </View>
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
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useSessionHydration();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />
        <RootNavigator />
        <DialogHost />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
