import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Screen } from '../../components/Screen';
import { authStyles as styles } from './styles';

// Contenedor de sign-in / sign-up: evita que el teclado tape los inputs y el
// botón. KeyboardAvoidingView encoge el área visible y el ScrollView permite
// desplazarse hasta el CTA; con el teclado cerrado el formulario queda
// centrado (flexGrow + justifyContent en el contenido).
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <Screen edges={['top', 'bottom']} style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
