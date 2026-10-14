import { useRef, useState } from 'react';
import { View, Pressable, FlatList, StyleSheet, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { router, type Href } from 'expo-router';
import { Image, type ImageContentPosition } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../components/Screen';
import { Text } from '../components/Text';
import { PulseLine } from '../components/PulseLine';
import { FadeIn } from '../components/FadeIn';
import { useOnboarding } from '../features/onboarding/store';

// Bienvenida de marca, una sola vez por instalación. Siempre negra con dorado,
// sin importar el tema elegido.
const BLACK = '#000000';
const IVORY = '#F5F3EE';
const IVORY_SOFT = 'rgba(245,243,238,0.6)';
const IVORY_DIM = 'rgba(245,243,238,0.25)';
const GOLD = '#C9A94B';

// title en blanco; la frase en dorado (highlight) + gris (rest). focus elige qué
// parte de la foto (vertical, 2:3) queda visible al recortarla a la pantalla.
// Fotos: Pexels (1: Yuliya Mulyukina, 3: Jonathan Borba) y Unsplash
// (2: Galina Bogdanova), licencias libres para uso comercial.
const SLIDES: {
  image: ImageSourcePropType;
  focus: ImageContentPosition;
  title: string;
  highlight: string;
  rest: string;
}[] = [
  {
    image: require('../assets/onboarding-1.jpg'),
    focus: 'top',
    title: 'Seguir cuando\nno puedes más',
    highlight: 'Es lo que te hace diferente',
    rest: 'de los demás.',
  },
  {
    image: require('../assets/onboarding-2.jpg'),
    focus: 'center',
    title: 'Tu bici,\ntu lugar',
    highlight: 'Reserva tu clase en segundos.',
    rest: '¿Está llena? Únete a la lista de espera y te avisamos.',
  },
  {
    image: require('../assets/onboarding-3.jpg'),
    focus: 'top',
    title: 'Cada clase\ncuenta',
    highlight: 'Suma XP, mantén tu racha',
    rest: 'y escala en el ranking.',
  },
];

export default function Onboarding() {
  const finish = useOnboarding((s) => s.finish);
  const { width } = useWindowDimensions();
  const list = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  function go(href: Href) {
    finish();
    router.replace(href);
  }

  function next() {
    if (isLast) return go('/sign-up');
    list.current?.scrollToIndex({ index: index + 1 });
    setIndex(index + 1);
  }

  return (
    <Screen edges={['top', 'bottom']} style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.wordmark} accessible accessibilityRole="image" accessibilityLabel="Pulso">
        <Text style={styles.wordmarkText}>PULSO</Text>
        <PulseLine mode="once" width={84} height={52} color={GOLD} bg={BLACK} strokeWidth={2.5} duration={1200} style={styles.wordmarkLine} />
      </View>

      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.title}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width }}>
            {/* La foto llena el espacio que sobre (se adapta a pantallas altas y
                bajas sin empujar el texto ni el botón). */}
            <View style={styles.photoArea}>
              <Image source={item.image} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={item.focus} transition={400} />
              {/* Funde los bordes con el negro: la foto no se ve como un
                  recuadro y el texto parece salir de ella. */}
              <View style={[styles.fade, styles.fadeTop]} />
              <View style={[styles.fade, styles.fadeBottom]} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title} accessibilityRole="header">
                {item.title}
              </Text>
              <Text style={styles.sub}>
                <Text style={styles.gold}>{item.highlight}</Text> {item.rest}
              </Text>
            </View>
          </View>
        )}
      />

      <FadeIn delay={300} style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={next}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{isLast ? 'COMENZAR' : 'SIGUIENTE'}</Text>
        </Pressable>
        {/* Visible en todas: quien ya tiene cuenta sale sin recorrer las 3. */}
        <Pressable onPress={() => go('/sign-in')} hitSlop={12} accessibilityRole="button" style={styles.link}>
          <Text style={styles.linkText}>
            ¿Ya tienes cuenta? <Text style={styles.linkStrong}>Entrar</Text>
          </Text>
        </Pressable>
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: BLACK },
  wordmark: { flexDirection: 'row', alignItems: 'flex-end', alignSelf: 'center', marginTop: 12 },
  wordmarkText: { fontSize: 46, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1, color: IVORY, includeFontPadding: false },
  wordmarkLine: { marginLeft: -2, marginBottom: -8 },
  photoArea: { flex: 1, marginBottom: 8 },
  fade: { position: 'absolute', left: 0, right: 0 },
  fadeTop: { top: 0, height: '15%', experimental_backgroundImage: `linear-gradient(0deg, rgba(0,0,0,0) 0%, ${BLACK} 100%)` },
  fadeBottom: { bottom: 0, height: '40%', experimental_backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${BLACK} 100%)` },
  // minHeight: mismo alto en las 3 para que el título no salte al deslizar.
  copy: { paddingHorizontal: 28, minHeight: 150 },
  title: { color: IVORY, fontSize: 34, fontWeight: '800', lineHeight: 38, letterSpacing: -0.8 },
  sub: { color: IVORY_SOFT, fontSize: 17, lineHeight: 24, marginTop: 12 },
  gold: { color: GOLD, fontWeight: '600' },
  footer: { paddingHorizontal: 28, paddingTop: 16, paddingBottom: 16, gap: 20 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: IVORY_DIM },
  dotActive: { width: 24, backgroundColor: GOLD },
  button: { backgroundColor: GOLD, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  buttonText: { color: BLACK, fontSize: 14, fontWeight: '800', letterSpacing: 1.5 },
  link: { alignSelf: 'center' },
  linkText: { color: IVORY_SOFT, fontSize: 15 },
  linkStrong: { color: IVORY, fontWeight: '700' },
});
