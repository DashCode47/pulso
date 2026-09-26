import { useState } from 'react';
import { TextInput, Text, Pressable, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../features/auth/useAuth';
import { Screen } from '../../components/Screen';
import { Wordmark } from '../../components/Wordmark';
import { authStyles as styles } from '../../features/auth/styles';
import { colors } from '../../theme';

export default function SignIn() {
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
        keyboardAppearance="dark"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor={colors.inkMuted}
        keyboardAppearance="dark"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
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
