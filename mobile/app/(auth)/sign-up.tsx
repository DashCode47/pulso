import { useState } from 'react';
import { View, TextInput, Text, Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../features/auth/useAuth';
import { Screen } from '../../components/Screen';

export default function SignUp() {
  const { signUp, verifyEmail } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignUp() {
    setError(null);
    setSubmitting(true);
    const { error, requireEmailVerification } = await signUp(email, password, name);
    setSubmitting(false);
    if (error) return setError(error.message);
    if (requireEmailVerification) setAwaitingCode(true);
  }

  async function handleVerify() {
    setError(null);
    setSubmitting(true);
    const { error } = await verifyEmail(email, otp);
    setSubmitting(false);
    if (error) setError(error.message);
  }

  if (awaitingCode) {
    return (
      <Screen edges={['top', 'bottom']} style={styles.container}>
        <Text style={styles.title}>Revisa tu correo</Text>
        <Text>Te enviamos un código a {email}.</Text>
        <TextInput
          style={styles.input}
          placeholder="Código de 6 dígitos"
          keyboardType="number-pad"
          value={otp}
          onChangeText={setOtp}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={styles.button} onPress={handleVerify} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? 'Verificando...' : 'Verificar'}</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} style={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>
      <TextInput style={styles.input} placeholder="Nombre" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={handleSignUp} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Creando...' : 'Crear cuenta'}</Text>
      </Pressable>
      <Link href="/(auth)/sign-in" style={styles.link}>
        <Text>¿Ya tienes cuenta? Entra</Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#111', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c00' },
  link: { marginTop: 16, alignSelf: 'center' },
});
