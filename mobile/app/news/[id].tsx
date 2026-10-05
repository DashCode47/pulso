import { useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { ArrowRightIcon, CaretLeftIcon } from '../../components/icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNews } from '../../features/home/useNews';
import { PulseLine } from '../../components/PulseLine';
import { colors, radius, spacing, type, themed, useThemeMode } from '../../theme';

const HERO = 460;

export default function NewsDetail() {
  useThemeMode((s) => s.mode); // re-render al cambiar de tema
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { data: news, isLoading } = useNews();
  const item = news?.find((n) => n.id === id);

  if (isLoading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <PulseLine />
      </View>
    );
  }
  if (!item) return <Redirect href="/home" />;

  // Parallax: al bajar la imagen se mueve más lento que el contenido; al
  // hacer overscroll (iOS) se estira para no dejar hueco arriba.
  const heroTransform = [
    { translateY: scrollY.interpolate({ inputRange: [-HERO, 0, HERO], outputRange: [-HERO / 2, 0, HERO * 0.4] }) },
    { scale: scrollY.interpolate({ inputRange: [-HERO, 0, HERO], outputRange: [2, 1, 1] }) },
  ];

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        <View style={styles.hero}>
          <Animated.Image source={{ uri: item.image }} style={[StyleSheet.absoluteFill, { transform: heroTransform }]} />
          <View style={styles.heroScrim} />
          <View style={styles.heroCopy}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.tag}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.date}>
              {new Date(item.date).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>

        <View style={[styles.body, { paddingBottom: insets.bottom + spacing.xxl * 2 }]}>
          <Text style={styles.lead}>{item.subtitle}</Text>
          <View style={styles.divider} />
          {item.body.map((p, i) => (
            <Text key={i} style={styles.paragraph}>
              {p}
            </Text>
          ))}

          {item.cta && (
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              onPress={() => router.navigate(item.cta!.href)}
            >
              <Text style={styles.ctaText}>{item.cta.label}</Text>
              <ArrowRightIcon size={18} color={colors.onAccent} weight="bold" />
            </Pressable>
          )}
        </View>
      </Animated.ScrollView>

      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        style={({ pressed }) => [styles.back, { top: insets.top + spacing.sm }, pressed && { opacity: 0.7 }]}
      >
        <CaretLeftIcon size={22} color={colors.ink} weight="bold" />
      </Pressable>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: { height: HERO, justifyContent: 'flex-end' },
  heroScrim: {
    ...StyleSheet.absoluteFill,
    // Oscurece arriba (legibilidad del botón volver) y se funde al negro del fondo abajo.
    experimental_backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.35) 60%, ${colors.bg} 100%)`,
  },
  heroCopy: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.lg, gap: spacing.sm },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
  },
  tagText: { ...type.eyebrow, fontSize: 10, color: colors.onAccent },
  title: { ...type.display, color: colors.ink },
  date: { ...type.eyebrow, color: colors.inkSoft },

  // bg sólido: tapa la imagen cuando el parallax la empuja hacia abajo.
  body: { backgroundColor: colors.bg, paddingHorizontal: spacing.xxl, gap: spacing.lg },
  lead: { fontSize: 18, lineHeight: 26, fontWeight: '600', color: colors.ink },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  paragraph: { ...type.body, fontSize: 16, lineHeight: 26, fontWeight: '400', color: colors.inkSoft },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
  },
  ctaPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  ctaText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },

  back: {
    position: 'absolute',
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,243,238,0.2)',
  },
}));
