import type { ComponentProps } from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';

// Montserrat en toda la app: RN no tiene fuente global, así que se importa
// Text/TextInput de aquí en vez de 'react-native'. La familia se embebe en el
// build nativo (plugin expo-font en app.json) con todos sus pesos, así que
// fontWeight sigue funcionando normal.
const font = { fontFamily: 'Montserrat' };

export function Text({ style, ...props }: ComponentProps<typeof RNText>) {
  return <RNText {...props} style={[font, style]} />;
}

export function TextInput({ style, ...props }: ComponentProps<typeof RNTextInput>) {
  return <RNTextInput {...props} style={[font, style]} />;
}
