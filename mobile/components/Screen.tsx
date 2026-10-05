import { SafeAreaView, type SafeAreaViewProps } from 'react-native-safe-area-context';
import { useThemeMode } from '../theme';

// Every screen root should use this instead of a plain View/ScrollView
// wrapper, otherwise content renders under the status bar. Tab screens keep
// the default edges=['top'] since the tab bar already handles the bottom
// inset; pass edges explicitly to override (e.g. auth screens with no tab bar).
// key={mode}: al cambiar de tema la pantalla se remonta y repinta con la nueva paleta.
export function Screen({ edges = ['top'], style, ...props }: SafeAreaViewProps) {
  const mode = useThemeMode((s) => s.mode);
  return <SafeAreaView key={mode} edges={edges} style={[{ flex: 1 }, style]} {...props} />;
}
