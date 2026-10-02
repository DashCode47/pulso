import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, Pressable, ScrollView, Animated, Easing, AccessibilityInfo, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { getLeaderboard, type LeaderboardEntry as BaseEntry } from '../../services/backend';
import { useAuthStore } from '../../features/auth/store';
import { Screen } from '../../components/Screen';
import { PulseLine } from '../../components/PulseLine';
import { colors, radius, spacing, type } from '../../theme';

type LeaderboardEntry = BaseEntry & { isMe: boolean };


// Orden visual del podio: 2º a la izquierda, 1º al centro, 3º a la derecha.
const podiumOrder = [1, 0, 2];
const podiumHeights = [120, 88, 64]; // por puesto (0 = 1º)
const growDelays = [500, 250, 0]; // el 3º sube primero, el 1º al final
const medalColors = ['#F5C451', '#D0D5DD', '#D8955B']; // oro, plata, bronce

function Avatar({ entry, size }: { entry: LeaderboardEntry; size: number }) {
  const style = { width: size, height: size, borderRadius: size / 2 };
  return entry.avatarUrl ? (
    <Image source={{ uri: entry.avatarUrl }} style={[styles.avatar, style]} cachePolicy="memory-disk" />
  ) : (
    <View style={[styles.avatar, style]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{entry.name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function PodiumColumn({ entry, place }: { entry: LeaderboardEntry; place: number }) {
  const grow = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const first = place === 0;
  const medal = medalColors[entry.rank - 1]; // por rank: empatados comparten color
  const size = first ? 84 : 62;

  useEffect(() => {
    const delay = growDelays[place];
    // height no soporta native driver; pop/pulse sí, por eso van en valores separados.
    Animated.spring(grow, { toValue: 1, delay, friction: 5, tension: 50, useNativeDriver: false }).start();
    Animated.spring(pop, { toValue: 1, delay: delay + 250, friction: 4, tension: 90, useNativeDriver: true }).start();
    if (!first) return;
    let loop: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(
        Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, []);

  return (
    <View style={styles.podiumCol}>
      <Animated.View style={[styles.podiumHead, { opacity: pop, transform: [{ scale: pop }] }]}>
        {first && (
          <Animated.Text
            style={[
              styles.crown,
              { transform: [{ translateY: pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -6, 0] }) }] },
            ]}
          >
            👑
          </Animated.Text>
        )}
        <View>
          {first && (
            <Animated.View
              style={[
                styles.glow,
                {
                  backgroundColor: medal,
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }],
                },
              ]}
            />
          )}
          <View style={[styles.podiumRing, { borderColor: entry.isMe ? colors.success : medal }]}>
            <Avatar entry={entry} size={size} />
          </View>
          <View style={[styles.medalBadge, { backgroundColor: medal }]}>
            <Text style={styles.medalBadgeText}>{entry.rank}</Text>
          </View>
        </View>
        <Text style={[styles.podiumName, first && styles.podiumNameFirst, entry.isMe && styles.nameMe]} numberOfLines={1}>
          {entry.name}
        </Text>
        <Text style={[styles.podiumXp, { color: medal }]}>{entry.xp} XP</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.podiumBlock,
          {
            backgroundColor: medal,
            height: grow.interpolate({ inputRange: [0, 1], outputRange: [0, podiumHeights[place]] }),
          },
        ]}
      >
        <Text style={styles.podiumRank}>{entry.rank}</Text>
      </Animated.View>
    </View>
  );
}

function Podium({ top }: { top: LeaderboardEntry[] }) {
  return (
    <View style={styles.podium}>
      {podiumOrder.map((i) =>
        top[i] ? <PodiumColumn key={top[i].userId} entry={top[i]} place={i} /> : <View key={i} style={styles.podiumCol} />,
      )}
    </View>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <View style={[styles.row, entry.isMe && styles.rowMe]}>
      <Text style={styles.rank}>{entry.rank}</Text>
      <Avatar entry={entry} size={40} />
      <Text style={[styles.name, entry.isMe && styles.nameMe]} numberOfLines={1}>
        {entry.name}
      </Text>
      <Text style={[styles.xp, entry.isMe && styles.xpMe]}>{entry.xp} XP</Text>
    </View>
  );
}

export default function Leaderboard() {
  const meId = useAuthStore((s) => s.user?.id);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['leaderboard'], queryFn: getLeaderboard });
  // Cada vez que la pestaña recibe foco: datos frescos y se remonta el podio para repetir la animación.
  const [visits, setVisits] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setVisits((v) => v + 1);
      refetch();
    }, [refetch]),
  );

  // La vista solo trae miembros activos con XP > 0.
  const entries: LeaderboardEntry[] = (data ?? []).map((e) => ({ ...e, isMe: e.userId === meId }));
  const top10 = entries.slice(0, 10);
  const myEntry = entries.find((e) => e.isMe);

  return (
    <Screen style={styles.container}>
      <Text style={styles.title}>Ranking</Text>

      {isLoading ? (
        <View style={styles.center}>
          <PulseLine />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>No se pudo cargar el ranking.</Text>
          <Pressable onPress={() => refetch()}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {myEntry ? (
            <View style={styles.myRankCard}>
              <Avatar entry={myEntry} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.myRankLabel}>Tu posición</Text>
                <Text style={styles.myRankXp}>{myEntry.xp} XP</Text>
              </View>
              <Text style={styles.myRankValue}>#{myEntry.rank}</Text>
            </View>
          ) : (
            !isAdmin && (
              <View style={styles.myRankCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.myRankLabel}>Tu posición</Text>
                  <Text style={styles.myRankXp}>Asiste a una clase para entrar al ranking</Text>
                </View>
              </View>
            )
          )}

          {top10.length === 0 ? (
            <Text style={styles.emptyText}>Nadie suma XP todavía. ¡Reserva una clase y sé el primero!</Text>
          ) : (
            <>
              <Podium key={visits} top={top10.slice(0, 3)} />
              <View style={styles.list}>
                {top10.slice(3).map((entry) => (
                  <LeaderboardRow key={entry.userId} entry={entry} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.sm },
  title: { ...type.title, color: colors.ink, paddingHorizontal: spacing.xxl },
  scroll: { padding: spacing.xxl, gap: spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  errorText: { color: colors.inkSoft, fontSize: 14 },
  retryText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  emptyText: { ...type.body, color: colors.inkSoft, textAlign: 'center', marginTop: spacing.xl },

  myRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  myRankLabel: { ...type.eyebrow, color: colors.onAccent, opacity: 0.6 },
  myRankXp: { fontSize: 16, fontWeight: '700', color: colors.onAccent, marginTop: 2 },
  myRankValue: { fontSize: 28, fontWeight: '800', color: colors.onAccent, letterSpacing: -0.6 },

  avatar: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', color: colors.ink },

  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.lg },
  podiumCol: { flex: 1, alignItems: 'center' },
  podiumHead: { alignItems: 'center' },
  crown: { fontSize: 28, marginBottom: spacing.xs },
  glow: { ...StyleSheet.absoluteFill, borderRadius: radius.pill },
  podiumRing: { padding: 3, borderRadius: radius.pill, borderWidth: 3, backgroundColor: colors.bg },
  medalBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  medalBadgeText: { fontSize: 12, fontWeight: '800', color: colors.onAccent },
  podiumName: { ...type.label, color: colors.ink, marginTop: spacing.md, maxWidth: '100%' },
  podiumNameFirst: { fontSize: 15, fontWeight: '800' },
  podiumXp: { ...type.caption, fontWeight: '700', marginTop: 2, marginBottom: spacing.sm },
  podiumBlock: {
    alignSelf: 'stretch',
    alignItems: 'center',
    overflow: 'hidden',
    paddingTop: spacing.sm,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  podiumRank: { fontSize: 36, fontWeight: '900', color: colors.onAccent, opacity: 0.35 },

  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
  },
  rowMe: { borderColor: colors.accent, borderWidth: 1 },
  rank: { width: 24, fontSize: 15, fontWeight: '700', textAlign: 'center', color: colors.inkSoft },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.ink },
  xp: { fontSize: 15, color: colors.inkSoft, fontWeight: '600' },
  nameMe: { fontWeight: '800' },
  xpMe: { color: colors.ink },
});
