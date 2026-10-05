import { useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import type { NewsItem } from '../services/backend';
import { colors, radius, spacing, type, themed } from '../theme';

const GUTTER = spacing.xxl;
const GAP = spacing.md;

// Carrusel de banners a todo el ancho: se sale del padding del padre con
// margen negativo para que el siguiente banner "asome" por la derecha.
// ponytail: sin autoplay; agregar con setInterval + scrollToOffset si se pide.
export function NewsCarousel({ items }: { items: NewsItem[] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = width - GUTTER * 2;
  const snap = cardWidth + GAP;
  const scrollX = useRef(new Animated.Value(0)).current;

  return (
    <View style={styles.root}>
      <Animated.FlatList
        data={items}
        horizontal
        keyExtractor={(n) => n.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={snap}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: GUTTER }}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        scrollEventThrottle={16}
        // width no se puede animar con el native driver; son 4 dots, da igual.
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/news/${item.id}`)}
            style={({ pressed }) => [styles.card, { width: cardWidth }, pressed && styles.cardPressed]}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${item.subtitle}`}
          >
            <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} cachePolicy="memory-disk" />
            <View style={styles.scrim} />
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.tag}</Text>
            </View>
            <View style={styles.copy}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {item.subtitle}
              </Text>
            </View>
          </Pressable>
        )}
      />

      <View style={styles.dots}>
        {items.map((item, i) => {
          const inputRange = [(i - 1) * snap, i * snap, (i + 1) * snap];
          return (
            <Animated.View
              key={item.id}
              style={[
                styles.dot,
                {
                  width: scrollX.interpolate({ inputRange, outputRange: [6, 22, 6], extrapolate: 'clamp' }),
                  opacity: scrollX.interpolate({ inputRange, outputRange: [0.25, 1, 0.25], extrapolate: 'clamp' }),
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { marginHorizontal: -GUTTER },
  card: {
    height: 210,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    justifyContent: 'space-between',
    padding: spacing.xl,
  },
  cardPressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  scrim: {
    ...StyleSheet.absoluteFill,
    // El borde va aquí (encima de la imagen) para que las fotos oscuras no se fundan con el fondo.
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `rgba(${colors.inkRgb},0.14)`,
    // Funde la foto hacia el fondo del tema para que el texto (ink) siempre se lea.
    experimental_backgroundImage: `linear-gradient(180deg, rgba(${colors.bgRgb},0.1) 0%, rgba(${colors.bgRgb},0.2) 40%, rgba(${colors.bgRgb},0.9) 100%)`,
  },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `rgba(${colors.inkRgb},0.4)`,
    backgroundColor: `rgba(${colors.bgRgb},0.5)`,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
  },
  tagText: { ...type.eyebrow, fontSize: 10, color: colors.ink },
  copy: { gap: spacing.xs },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: colors.ink },
  subtitle: { fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  dot: { height: 6, borderRadius: 3, backgroundColor: colors.ink },
}));
