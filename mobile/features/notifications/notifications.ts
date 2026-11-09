import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

// expo-notifications throws on *import* in Expo Go on Android (SDK 53+ dropped
// remote push there), so only load it when it can work. null = unavailable.
export const Notifications: typeof import('expo-notifications') | null =
  Platform.OS === 'android' && isRunningInExpoGo() ? null : require('expo-notifications');
