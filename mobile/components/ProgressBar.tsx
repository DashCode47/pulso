import { View, StyleSheet } from 'react-native';

interface Props {
  progress: number; // 0..1
}

export function ProgressBar({ progress }: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: '#e5e5e5', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#111', borderRadius: 4 },
});
