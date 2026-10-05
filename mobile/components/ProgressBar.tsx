import { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { colors, themed } from '../theme';

interface Props {
  progress: number; // 0..1
  delay?: number;
}

export function ProgressBar({ progress, delay = 0 }: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const fill = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // scaleX (no width) para poder usar native driver.
    Animated.timing(fill, { toValue: clamped, duration: 900, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [clamped]);

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { transform: [{ scaleX: fill }] }]} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: '100%', width: '100%', backgroundColor: colors.accent, borderRadius: 3, transformOrigin: 'left' },
}));
