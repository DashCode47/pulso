import { useState } from 'react';
import { Pressable, ActivityIndicator, Linking } from 'react-native';
import { LEGAL_LINKS } from '../../lib/legal';
import { Text, TextInput } from '../../components/Text';
import { Link } from 'expo-router';
import { useAuth } from '../../features/auth/useAuth';
import { Screen } from '../../components/Screen';
import { Wordmark } from '../../components/Wordmark';
import { PasswordInput } from '../../features/auth/PasswordInput';
import { authStyles as styles } from '../../features/auth/styles';
import { colors, useThemeMode } from '../../theme';

export default function SignUp() {
  const mode = useThemeMode((s) => s.mode);
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignUp() {
    if (!name.trim()) return setError('Escribe tu nombre.');
    if (password !== confirmPassword) return setError('Las contraseñas no coinciden.');
    setError(null);
    setSubmitting(true);
    const { error } = await signUp(email.trim(), password, name.trim());
    setSubmitting(false);
    if (error) setError(error.message);
    // On success the auth store flips and the root Stack.Protected routes to (tabs).
  }

  return (
    <Screen edges={['top', 'bottom']} style={styles.container}>
      <Wordmark />
      <Text style={styles.subtitle}>Crea tu cuenta</Text>
      <TextInput
        style={styles.input}
        placeholder="Nombre"
        placeholderTextColor={colors.inkMuted}
        keyboardAppearance={mode}
        value={name}
        onChangeText={setName}
      />
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
      <PasswordInput placeholder="Confirmar contraseña" value={confirmPassword} onChangeText={setConfirmPassword} />
      {error && <Text style={styles.error}>{error}</Text>}
      <Text style={[styles.linkText, { textAlign: 'center' }]}>
        Al crear tu cuenta aceptas los{' '}
        <Text style={styles.linkStrong} onPress={() => Linking.openURL(LEGAL_LINKS.terms)}>Términos</Text> y la{' '}
        <Text style={styles.linkStrong} onPress={() => Linking.openURL(LEGAL_LINKS.privacy)}>Política de privacidad</Text>.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        onPress={handleSignUp}
        disabled={submitting}
      >
        {submitting ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.buttonText}>Crear cuenta</Text>}
      </Pressable>
      <Link href="/(auth)/sign-in" style={styles.link}>
        <Text style={styles.linkText}>
          ¿Ya tienes cuenta? <Text style={styles.linkStrong}>Entra</Text>
        </Text>
      </Link>
    </Screen>
  );
}
