import { AppState } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';

// React Native has no window focus: tie React Query's "focused" state to the
// app being in the foreground, so polling (refetchInterval) pauses in the
// background and stale queries refetch when the user comes back.
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
  return () => sub.remove();
});

export const queryClient = new QueryClient();
