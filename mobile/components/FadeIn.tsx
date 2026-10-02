import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

interface Props {
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

// Entrada con fade + slide-up. Solo opacity/transform con native driver: corre
// en el hilo de UI, sin re-renders de JS.
export function FadeIn({ delay = 0, style, children }: Props) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  // Respeta la opacidad que traiga el estilo (p.ej. logros bloqueados al 0.45).
  const baseOpacity = StyleSheet.flatten(style)?.opacity ?? 1;
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0, Number(baseOpacity)] });
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
