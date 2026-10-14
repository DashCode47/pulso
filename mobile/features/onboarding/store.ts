import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const STORAGE_KEY = 'onboarding-done';

// Se muestra una sola vez por instalación, antes del login. getItem síncrono
// (igual que el tema) para decidir la ruta desde el primer frame.
export const useOnboarding = create<{ seen: boolean; finish: () => void }>((set) => ({
  seen: SecureStore.getItem(STORAGE_KEY) === '1',
  finish: () => {
    SecureStore.setItem(STORAGE_KEY, '1');
    set({ seen: true });
  },
}));
