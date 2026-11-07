import { Logo } from './Logo';
import { colors } from '../theme';

// Logo de las pantallas de auth: sigue el tema (palabra en tinta, pulso dorado).
export function Wordmark() {
  return <Logo width={220} color={colors.ink} accent={colors.highlight} style={{ alignSelf: 'center' }} />;
}
