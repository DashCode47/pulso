import { View, Text, StyleSheet } from 'react-native';
import { PulseLine } from './PulseLine';
import { colors, themed } from '../theme';

// Logo de Pulso en código (nítido a cualquier tamaño): palabra en itálica
// gruesa + la línea de pulso, que se dibuja una vez al montar.
export function Wordmark() {
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel="Pulso">
      <Text style={styles.text}>PULSO</Text>
      <View style={styles.line}>
        <PulseLine mode="once" width={72} height={44} strokeWidth={2.5} duration={1200} />
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', alignSelf: 'center' },
  text: { fontSize: 52, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1, color: colors.ink, includeFontPadding: false },
  // Alinea la línea base del pulso con la base de las letras.
  line: { marginLeft: 2, marginBottom: -4 },
}));
