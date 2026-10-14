import { useState } from 'react';
import { Pressable, ActivityIndicator } from 'react-native';
import { Text } from '../../components/Text';
import { Link } from 'expo-router';
import { useAuth } from '../../features/auth/useAuth';
import { AuthScreen } from '../../features/auth/AuthScreen';
import { AuthField } from '../../features/auth/AuthField';
import { authStyles as styles } from '../../features/auth/styles';
import { EnvelopeIcon, LockIcon, UserIcon } from '../../components/icons';

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
    <AuthScreen>
      <AuthField
        icon={UserIcon}
        placeholder="Correo electrónico"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <AuthField icon={LockIcon} secure placeholder="Contraseña" value={password} onChangeText={setPassword} />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? <ActivityIndicator color="#111" /> : <Text style={styles.buttonText}>Ingresar</Text>}
      </Pressable>
      <Link href="/(auth)/sign-up" style={styles.link}>
        <Text style={styles.linkText}>
          ¿No tienes cuenta? <Text style={styles.linkStrong}>Regístrate</Text>
        </Text>
      </Link>
    </AuthScreen>
  );
}
