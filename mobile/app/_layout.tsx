import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { queryClient } from '../lib/queryClient';
import { useAuthStore } from '../features/auth/store';
import { useSessionHydration } from '../features/auth/useAuth';

function RootNavigator() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
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
      <RootNavigator />
    </QueryClientProvider>
  );
}
