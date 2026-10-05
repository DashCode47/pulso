import { useState } from 'react';
import { TextInput, Text, Pressable, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../features/auth/useAuth';
import { Screen } from '../../components/Screen';
import { Wordmark } from '../../components/Wordmark';
import { PasswordInput } from '../../features/auth/PasswordInput';
import { authStyles as styles } from '../../features/auth/styles';
import { colors, useThemeMode } from '../../theme';

export default function SignIn() {
  const mode = useThemeMode((s) => s.mode);
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) setError(error.message);
  }

  return (
    <Screen edges={['top', 'bottom']} style={styles.container}>
      <Wordmark />
      <Text style={styles.subtitle}>Entra a tu cuenta</Text>
      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        placeholderTextColor={colors.inkMuted}
        keyboardAppearance={mode}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <PasswordInput placeholder="Contraseña" value={password} onChangeText={setPassword} />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.buttonText}>Entrar</Text>}
      </Pressable>
      <Link href="/(auth)/sign-up" style={styles.link}>
        <Text style={styles.linkText}>
          ¿No tienes cuenta? <Text style={styles.linkStrong}>Regístrate</Text>
        </Text>
      </Link>
    </Screen>
  );
}
