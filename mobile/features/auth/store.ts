import { create } from 'zustand';
import type { AppUser } from '../../services/backend';

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  setUser: (user: AppUser | null) => void;
  setLoading: (loading: boolean) => void;
  setIsAdmin: (isAdmin: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  isAdmin: false,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setIsAdmin: (isAdmin) => set({ isAdmin }),
}));
