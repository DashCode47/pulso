import { useEffect, useRef, type ReactNode } from 'react';
import { View, Animated, Easing, AccessibilityInfo, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../theme';

// Aro con degradado dorado→marfil que gira lento alrededor del avatar.
// Solo rotate con native driver; se queda quieto con "reducir movimiento".
export function AvatarRing({ size, children }: { size: number; children: ReactNode }) {
  const spin = useRef(new Animated.Value(0)).current;
  const stroke = 2.5;
  const outer = size + 8;
  const r = (outer - stroke) / 2;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }));
      loop.start();
    });
    return () => loop?.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        <Svg width={outer} height={outer}>
          <Defs>
            <LinearGradient id="avatarRing" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.highlight} />
              <Stop offset="0.55" stopColor={colors.highlight} stopOpacity={0.25} />
              <Stop offset="1" stopColor={colors.ink} />
            </LinearGradient>
          </Defs>
          <Circle cx={outer / 2} cy={outer / 2} r={r} stroke="url(#avatarRing)" strokeWidth={stroke} fill="none" />
        </Svg>
      </Animated.View>
      {children}
    </View>
  );
}
