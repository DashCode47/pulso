import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushToken } from '../../services/backend';

// Best-effort: a denied permission, missing EAS project, or unsupported
// simulator should never block using the app.
export async function registerForPushNotifications() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    const finalStatus =
      existingStatus === 'granted' ? existingStatus : (await Notifications.requestPermissionsAsync()).status;
    if (finalStatus !== 'granted') return;

    // ponytail: no-ops until `eas init` links a project (extra.eas.projectId
    // in app.json) -- getExpoPushTokenAsync needs it to mint a real token.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerPushToken(token);
  } catch {
    // Ignore -- see comment above.
  }
}
