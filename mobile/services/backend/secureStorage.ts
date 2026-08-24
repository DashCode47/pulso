import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'pulso_refresh_token';

export const secureStorage = {
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),
  clearRefreshToken: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
};
