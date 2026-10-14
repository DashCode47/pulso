import type { ReactNode } from 'react';
import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Screen } from '../../components/Screen';
import { authStyles as styles } from './styles';

// Layout de sign-in/sign-up: la foto (ya trae el logo PULSO) a pantalla
// completa y el form debajo del logo.
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <Screen edges={['bottom']} style={styles.screen}>
      <Image source={require('../../assets/auth-bg.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" />
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <View style={styles.spacer} />
        {children}
      </KeyboardAvoidingView>
    </Screen>
  );
}
