import { StyleSheet } from 'react-native';
import { radius } from '../../theme';

// Compartido por sign-in y sign-up (fuera de app/ para que expo-router no lo
// tome como ruta). Sin themed(): la foto de fondo es oscura en ambos temas,
// así que el login siempre va con texto claro y el dorado del logo.
export const GOLD = '#A69248';
export const PLACEHOLDER = 'rgba(255,255,255,0.75)';

export const authStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, paddingHorizontal: 32, gap: 14 },
  // ponytail: empuja el form justo bajo el logo de la foto (~50% del alto);
  // shrink para que ceda espacio cuando abre el teclado.
  spacer: { height: '50%', flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 26, alignItems: 'center' },
  input: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 18,
    fontSize: 17,
    color: '#fff',
  },
  inputWithIcon: { paddingRight: 18 + 28 },
  eye: { position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' },
  button: {
    alignSelf: 'center',
    minWidth: 200,
    alignItems: 'center',
    backgroundColor: GOLD,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 28,
    marginTop: 20,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  buttonText: { color: '#111', fontSize: 16, fontWeight: '700', letterSpacing: 4, textTransform: 'uppercase' },
  error: { color: '#FF7A70', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  link: { alignSelf: 'center', marginTop: 4 },
  linkText: { color: PLACEHOLDER, fontSize: 13 },
  linkStrong: { color: '#fff', fontWeight: '700' },
});
