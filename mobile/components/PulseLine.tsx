import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

// Trazo de ECG (onda P, complejo QRS, onda T) en una grilla de 100x32, como la
// línea del logo. La x siempre avanza, así que barrer en horizontal = trazar.
const POINTS = [
  [0, 20], [30, 20], [34, 16], [38, 20], [44, 20], [47, 24], [52, 2],
  [57, 30], [61, 20], [68, 20], [73, 14], [78, 20], [100, 20],
];

interface Props {
  width?: number;
  height?: number;
  color?: string;
  // Color sólido de lo que hay detrás (hex #RRGGBB): la animación es una
  // máscara de ese color que se desliza sobre la línea.
  bg?: string;
  strokeWidth?: number;
  // loop: monitor continuo. once: dibuja la línea una vez y la deja fija.
  mode?: 'loop' | 'once';
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

// La línea es un SVG estático; lo único que se anima es el translateX de la
// máscara, con el native driver: corre en el hilo de UI, cero trabajo de JS por
// frame (mismo costo que un ActivityIndicator), aunque JS esté ocupado cargando.
export function PulseLine({
  width = 64,
  height = 24,
  color = colors.ink,
  bg = colors.bg,
  strokeWidth = 2,
  mode = 'loop',
  duration = 1400,
  style,
}: Props) {
  // loop: largo de la estela. once: borde suave del barrido.
  const tail = width * (mode === 'loop' ? 0.6 : 0.15);
  const from = -(width + tail);
  const tx = useRef(new Animated.Value(from)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    tx.setValue(from);
    const timing = Animated.timing(tx, {
      toValue: 0,
      duration,
      easing: mode === 'once' ? Easing.out(Easing.cubic) : Easing.linear,
      useNativeDriver: true,
    });
    const anim = mode === 'loop' ? Animated.loop(timing) : timing;
    anim.start();
    return () => anim.stop();
  }, [reduceMotion, mode, duration, from, tx]);

  // Inset de medio trazo para que los picos no se corten en los bordes.
  const pad = strokeWidth / 2;
  const d = `M${POINTS.map(([x, y]) => `${pad + (x / 100) * (width - strokeWidth)} ${pad + (y / 32) * (height - strokeWidth)}`).join(' L')}`;
  const stroke = { d, stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

  // Máscara de ancho 2*width + tail. loop: opaca, estela que se aclara hasta la
  // cabeza, corte seco y opaca de nuevo. once: transparente, borde suave, opaca.
  const clear = `${bg}00`;
  const mask =
    mode === 'loop'
      ? `linear-gradient(90deg, ${bg} ${width}px, ${clear} ${width + tail}px, ${bg} ${width + tail}px)`
      : `linear-gradient(90deg, ${clear} ${width}px, ${bg} ${width + tail}px)`;

  return (
    <View
      style={[{ width, height, overflow: 'hidden' }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height}>
        <Path {...stroke} />
      </Svg>
      {!reduceMotion && (
        <>
          <Animated.View
            style={[
              styles.mask,
              { width: width * 2 + tail, experimental_backgroundImage: mask, transform: [{ translateX: tx }] },
            ]}
          />
          {mode === 'loop' && (
            // Línea tenue por encima de la máscara: el "papel" del monitor.
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
              <Path {...stroke} opacity={0.12} />
            </Svg>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mask: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
