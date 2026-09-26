import { useState } from 'react';
import { TextInput, Text, Pressable, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../features/auth/useAuth';
import { Screen } from '../../components/Screen';
import { Wordmark } from '../../components/Wordmark';
import { authStyles as styles } from '../../features/auth/styles';
import { colors } from '../../theme';

export default function SignUp() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignUp() {
    setError(null);
    setSubmitting(true);
    const { error, requiresEmailConfirmation } = await signUp(email, password, name);
    setSubmitting(false);
    if (error) return setError(error.message);
    if (requiresEmailConfirmation) setConfirmationSent(true);
  }

  if (confirmationSent) {
    return (
      <Screen edges={['top', 'bottom']} style={styles.container}>
        <Text style={styles.title}>Revisa tu correo</Text>
        <Text style={styles.body}>
          Te enviamos un enlace de confirmación a {email}. Ábrelo y después vuelve para iniciar sesión.
        </Text>
        <Link href="/(auth)/sign-in" style={styles.link}>
          <Text style={styles.linkStrong}>Ir a iniciar sesión</Text>
        </Link>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} style={styles.container}>
      <Wordmark />
      <Text style={styles.subtitle}>Crea tu cuenta</Text>
      <TextInput
        style={styles.input}
        placeholder="Nombre"
        placeholderTextColor={colors.inkMuted}
        keyboardAppearance="dark"
        value={name}
        onChangeText={setName}
      />
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
        onPress={handleSignUp}
        disabled={submitting}
      >
        {submitting ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.buttonText}>Crear cuenta</Text>}
      </Pressable>
      <Link href="/(auth)/sign-in" style={styles.link}>
        <Text style={styles.linkText}>
          ¿Ya tienes cuenta? <Text style={styles.linkStrong}>Entra</Text>
        </Text>
      </Link>
    </Screen>
  );
}
