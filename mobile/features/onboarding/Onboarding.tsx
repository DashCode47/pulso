import { useRef, useState } from 'react';
import { View, ScrollView, Pressable, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Screen } from '../../components/Screen';
import { Text } from '../../components/Text';
import { Wordmark } from '../../components/Wordmark';
import { ArrowUpRightIcon } from '../../components/icons';
import { colors, radius, spacing, themed } from '../../theme';

const KEY = 'onboarding-done';
export const isOnboarded = () => SecureStore.getItem(KEY) === '1';

// ponytail: solo texto mientras se eligen las fotos; cuando lleguen, agregar
// `image` a cada slide y un <Image> (expo-image) encima del texto.
const SLIDES = [
  { title: 'Seguir cuando\nno puedes más', accent: 'Es lo que te hace diferente', sub: 'de los demás' },
  { title: 'Reserva tu bici\nen segundos', accent: 'Elige tu clase y tu lugar', sub: 'desde la app' },
  { title: 'Cada clase\ncuenta', accent: 'Suma XP y sube en el ranking', sub: 'mira tu progreso' },
];

// Carrusel de bienvenida: solo se muestra en el primer arranque.
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const finish = () => {
    SecureStore.setItem(KEY, '1');
    onDone();
  };
  const next = () => (last ? finish() : scroll.current?.scrollTo({ x: (index + 1) * width }));
  // Rango [anterior, actual, siguiente] de cada slide, para interpolar con el scroll.
  const around = (i: number) => [(i - 1) * width, i * width, (i + 1) * width];

  return (
    <Screen edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={finish} disabled={last} hitSlop={12} style={{ opacity: last ? 0 : 1 }} accessibilityRole="button">
          <Text style={styles.skip}>Saltar</Text>
        </Pressable>
      </View>

      {/* useNativeDriver false: el ancho de los dots no corre en el driver nativo (pantalla de una sola vez). */}
      <Animated.ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
          listener: (e: { nativeEvent: { contentOffset: { x: number } } }) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / width)),
        })}
      >
        {SLIDES.map((s, i) => (
          <Animated.View
            key={s.title}
            style={[
              styles.slide,
              {
                width,
                opacity: scrollX.interpolate({ inputRange: around(i), outputRange: [0, 1, 0], extrapolate: 'clamp' }),
                transform: [{ translateX: scrollX.interpolate({ inputRange: around(i), outputRange: [48, 0, -48], extrapolate: 'clamp' }) }],
              },
            ]}
          >
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.accent}>{s.accent}</Text>
            <Text style={styles.sub}>{s.sub}</Text>
          </Animated.View>
        ))}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <Animated.View
              key={s.title}
              style={[
                styles.dot,
                {
                  width: scrollX.interpolate({ inputRange: around(i), outputRange: [8, 28, 8], extrapolate: 'clamp' }),
                  backgroundColor: scrollX.interpolate({
                    inputRange: around(i),
                    outputRange: [`rgba(${colors.inkRgb},0.25)`, colors.highlight, `rgba(${colors.inkRgb},0.25)`],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            />
          ))}
        </View>
        <Wordmark />
        <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={next} accessibilityRole="button">
          <Text style={styles.buttonText}>{last ? 'Comenzar' : 'Siguiente'}</Text>
          <ArrowUpRightIcon size={18} weight="bold" color={colors.onAccent} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = themed(() => StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 28, paddingTop: spacing.sm, minHeight: 40 },
  skip: { fontSize: 14, fontWeight: '600', color: colors.inkMuted, letterSpacing: 0.4 },
  slide: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.8, color: colors.ink, textAlign: 'center' },
  accent: { fontSize: 17, fontWeight: '600', color: colors.highlight, textAlign: 'center', marginTop: spacing.xxl },
  sub: { fontSize: 17, fontWeight: '500', color: colors.inkSoft, textAlign: 'center', marginTop: spacing.xs },
  footer: { alignItems: 'center', paddingHorizontal: 32, paddingBottom: spacing.xxl, gap: 36 },
  dots: { flexDirection: 'row', gap: spacing.sm },
  dot: { height: 8, borderRadius: 4 },
  button: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  buttonText: { color: colors.onAccent, fontSize: 16, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
}));
