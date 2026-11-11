import { useCallback } from 'react';
import { Text } from '../../components/Text';
import { Image } from 'expo-image';
import { View, Pressable, ScrollView, StyleSheet, Linking } from 'react-native';
import { ArrowRightIcon, CalendarBlankIcon,FireIcon, LightningIcon, LockIcon, PlusCircleIcon, RankingIcon, UsersThreeIcon, WhatsappLogoIcon } from '../../components/icons';
import { whatsappUrl } from '../../lib/legal';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../features/auth/store';
import { useMyProgress, weeklyGoalHint } from '../../features/progress/useMyProgress';
import { useNews } from '../../features/home/useNews';
import { useMyAvatar } from '../../features/profile/useAvatar';
import { groupClassesByDay, useUpcomingClasses, useMyMembership } from '../../features/bookings/useBookings';
import { membershipBlockMessage } from '../../features/bookings/errorMessages';
import * as backend from '../../services/backend';
import { ProgressBar } from '../../components/ProgressBar';
import { NewsCarousel } from '../../components/NewsCarousel';
import { PulseLine } from '../../components/PulseLine';
import { Screen } from '../../components/Screen';
import { AvatarRing } from '../../components/AvatarRing';
import { InstructorAvatar } from '../../components/InstructorAvatar';
import { AppImage } from '../../components/AppImage';
import { colors, radius, spacing, type, themed, useThemeMode } from '../../theme';

export default function Home() {
  useThemeMode((s) => s.mode); // re-render al cambiar de tema
  const isAdmin = useAuthStore((s) => s.isAdmin);
  return isAdmin ? <AdminHome /> : <MemberHome />;
}

function AdminHome() {
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: backend.getAdminDashboard });

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.eyebrow}>{todayLabel()}</Text>
          <Text style={styles.greeting}>Panel del estudio</Text>
        </View>

        <View style={styles.quickActions}>
          <Pressable style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]} onPress={() => router.push('/(tabs)/admin')}>
            <PlusCircleIcon size={20} color={colors.onAccent} weight="fill" />
            <Text style={styles.quickActionText}>Crear clase</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.quickAction, styles.quickActionSecondary, pressed && styles.pressed]}
            onPress={() => router.push('/(tabs)/members')}
          >
            <UsersThreeIcon size={20} color={colors.ink} weight="fill" />
            <Text style={[styles.quickActionText, { color: colors.ink }]}>Ver miembros</Text>
          </Pressable>
        </View>

        {isLoading || !data ? (
          <PulseLine style={{ alignSelf: 'center', marginTop: spacing.xl }} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>{data.activeMembers}</Text>
                <Text style={styles.statLabel}>miembros activos</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>{data.classesThisWeek}</Text>
                <Text style={styles.statLabel}>clases esta semana</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>{data.creditsGrantedThisMonth}</Text>
                <Text style={styles.statLabel}>créditos este mes</Text>
              </View>
            </View>

            <View>
              <Text style={styles.sectionTitle}>Clases de hoy</Text>
              {data.todayClasses.length === 0 ? (
                <View style={styles.emptyTodayCard}>
                  <Text style={styles.emptyClassTextDark}>No hay clases programadas hoy.</Text>
                </View>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {data.todayClasses.map((c) => {
                    const isFull = c.bookedCount >= c.capacity;
                    return (
                      <View key={c.id} style={styles.todayRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.todayTitle}>{c.title}</Text>
                          <Text style={styles.todayMeta}>
                            {new Date(c.startsAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                        <View style={[styles.occupancyBadge, isFull && styles.occupancyBadgeFull]}>
                          <Text style={[styles.occupancyText, isFull && styles.occupancyTextFull]}>
                            {c.bookedCount}/{c.capacity}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function MemberHome() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { data: progress, refetch: refetchProgress } = useMyProgress();
  useFocusEffect(useCallback(() => void refetchProgress(), [refetchProgress]));
  const weeklyGoal = progress?.weeklyGoal ?? 3;
  const weeklyCompleted = progress?.weeklyCompleted ?? 0;
  const { data: news, isLoading: loadingNews } = useNews();
  const { data: avatarUrl } = useMyAvatar();
  const { data: classes } = useUpcomingClasses();
  const { data: membership } = useMyMembership();
  const blockMessage = membershipBlockMessage(membership);
  const { data: whatsapp } = useQuery({ queryKey: ['support-whatsapp'], queryFn: backend.getSupportWhatsapp });
  const next = classes?.find((c) => c.myReservationId);
  const nextClass = next && {
    title: next.title,
    dayLabel: groupClassesByDay([next])[0].label,
    startsAt: new Date(next.startsAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
    bikeLabel: next.bikes.find((b) => b.id === next.bookedBikeId)?.label ?? '',
    instructorName: next.instructorName,
    instructorPhotoUrl: next.instructorPhotoUrl,
  };
  const firstName = (user?.name ?? user?.email ?? '').split(' ')[0].split('@')[0];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{todayLabel()}</Text>
            <Text style={styles.greeting}>Hola, {firstName}</Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/profile')} accessibilityLabel="Perfil">
            <AvatarRing size={44}>
              <View style={styles.avatar}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} cachePolicy="memory-disk" />
                ) : (
                  <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
                )}
              </View>
            </AvatarRing>
          </Pressable>
        </View>

        {/* Mismo alto que el banner mientras carga, para que no salte el layout.
            Si falla o no hay noticias, el carrusel simplemente no aparece. */}
        {loadingNews ? (
          <View style={styles.newsSkeleton}>
            <PulseLine bg={colors.surface} />
          </View>
        ) : (
          !!news?.length && <NewsCarousel items={news} />
        )}

        {!classes ? null : nextClass ? (
          <View style={styles.nextClassCard}>
            <View style={styles.nextClassTop}>
              <Text style={styles.nextClassLabel}>Tu próxima clase</Text>
              <PulseLine width={56} height={20} color={colors.onAccent} bg={colors.accent} />
            </View>
            <Text style={styles.nextClassTitle}>{nextClass.title}</Text>
            <Text style={styles.nextClassMeta}>
              {nextClass.dayLabel} · {nextClass.startsAt} · {nextClass.bikeLabel}
            </Text>
            <View style={styles.nextClassInstructor}>
              <InstructorAvatar
                name={nextClass.instructorName}
                photoUrl={nextClass.instructorPhotoUrl}
                size={56}
                style={styles.nextClassAvatar}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.nextClassInstructorLabel}>Instructor</Text>
                <Text style={styles.nextClassInstructorName} numberOfLines={1}>
                  {nextClass.instructorName}
                </Text>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.viewButton, pressed && styles.pressed]}
              onPress={() => router.push({ pathname: '/(tabs)/bookings', params: { classId: next.id } })}
            >
              <Text style={styles.viewButtonText}>Ver reserva</Text>
              <ArrowRightIcon size={16} color={colors.accent} weight="bold" />
            </Pressable>
          </View>
        ) : blockMessage ? (
          <View style={styles.emptyClassCard}>
            <LockIcon size={28} color={colors.danger} />
            <Text style={styles.emptyClassText}>{blockMessage}</Text>
            <Pressable style={({ pressed }) => [styles.bookButton, pressed && styles.pressed]} onPress={() => router.push('/(tabs)/profile')}>
              <Text style={styles.bookButtonText}>Ver mi membresía</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyClassCard}>
            <CalendarBlankIcon size={28} color={colors.inkSoft} />
            <Text style={styles.emptyClassText}>No tienes clases reservadas.</Text>
            <Pressable style={({ pressed }) => [styles.bookButton, pressed && styles.pressed]} onPress={() => router.push('/(tabs)/bookings')}>
              <Text style={styles.bookButtonText}>Reservar una clase</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <FireIcon size={16} color={colors.ink} weight="fill" />
            <Text style={styles.statValue}>{progress?.currentStreakWeeks ?? '–'}</Text>
            <Text style={styles.statLabel}>semanas</Text>
          </View>
          <View style={styles.statChip}>
            <LightningIcon size={16} color={colors.ink} weight="fill" />
            <Text style={styles.statValue}>{progress?.weeklyXp ?? '–'}</Text>
            <Text style={styles.statLabel}>XP semana</Text>
          </View>
          <View style={styles.statChip}>
            <RankingIcon size={16} color={colors.ink} weight="fill" />
            <Text style={styles.statValue}>{progress?.rank ? `#${progress.rank}` : '–'}</Text>
            <Text style={styles.statLabel}>ranking</Text>
          </View>
        </View>

        <View style={styles.weeklyCard}>
          <View style={styles.weeklyHeader}>
            <Text style={styles.weeklyTitle}>Objetivo semanal</Text>
            <Text style={styles.weeklyCount}>
              {weeklyCompleted}/{weeklyGoal}
            </Text>
          </View>
          <ProgressBar progress={weeklyCompleted / weeklyGoal} />
          <Text style={styles.weeklyHint}>{weeklyGoalHint(weeklyCompleted, weeklyGoal)}</Text>
        </View>

        {/* Hidden until an admin sets the number in settings. */}
        {!!whatsapp && (
          <Pressable
            style={({ pressed }) => [styles.whatsappCard, pressed && styles.pressed]}
            accessibilityRole="link"
            accessibilityLabel="Soporte en línea. Contáctanos por WhatsApp"
            onPress={() => Linking.openURL(whatsappUrl(whatsapp))}
          >
            <AppImage
              name="home-whatsapp.jpg"
              // Photo: Eugene Barmin on Pexels (Pexels License, free for commercial use).
              fallback={require('../../assets/support-headset.jpg')}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              contentPosition="right center"
            />
            <View style={[StyleSheet.absoluteFill, styles.whatsappScrim]} />
            <View>
              <Text style={styles.whatsappTitle}>Soporte en línea</Text>
              <Text style={styles.whatsappEyebrow}>Contáctanos</Text>
            </View>
            <View style={styles.whatsappPill}>
              <WhatsappLogoIcon size={18} color={WHATSAPP_GREEN} weight="fill" />
              <Text style={styles.whatsappPillText}>WhatsApp</Text>
            </View>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

// "sábado, 26 de septiembre" -> el estilo eyebrow lo pasa a mayúsculas.
function todayLabel() {
  return new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
}

const WHATSAPP_GREEN = '#25D366';

const card = () => ({
  backgroundColor: colors.surface,
  borderRadius: radius.lg,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: colors.border,
}) as const;

const styles = themed(() => StyleSheet.create({
  content: { padding: spacing.xxl, paddingBottom: spacing.xxl * 2, gap: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  eyebrow: { ...type.eyebrow, color: colors.inkMuted, marginBottom: spacing.xs },
  greeting: { ...type.title, color: colors.ink },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  avatarText: { fontSize: 17, fontWeight: '700', color: colors.ink },
  avatarImage: { width: 44, height: 44, borderRadius: 22 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  newsSkeleton: { ...card(), height: 210, alignItems: 'center', justifyContent: 'center' },

  quickActions: { flexDirection: 'row', gap: spacing.sm },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  quickActionSecondary: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  quickActionText: { color: colors.onAccent, fontWeight: '700' },

  sectionTitle: { ...type.eyebrow, color: colors.inkMuted, marginBottom: spacing.md },
  emptyTodayCard: { ...card(), padding: spacing.xl, alignItems: 'center' },
  emptyClassTextDark: { color: colors.inkSoft, fontSize: 14 },

  todayRow: { ...card(), borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
  todayTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  todayMeta: { ...type.caption, color: colors.inkSoft, marginTop: 2 },
  occupancyBadge: { backgroundColor: colors.successSoft, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.md },
  occupancyBadgeFull: { backgroundColor: colors.dangerSoft },
  occupancyText: { color: colors.success, fontWeight: '700', fontSize: 12 },
  occupancyTextFull: { color: colors.danger },

  // Tarjeta invertida (marfil sobre negro): el único bloque claro del Home.
  nextClassCard: { backgroundColor: colors.accent, borderRadius: radius.xl, padding: spacing.xxl, gap: spacing.xs },
  nextClassTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 20 },
  nextClassLabel: { ...type.eyebrow, color: colors.onAccent, opacity: 0.55 },
  nextClassTitle: { ...type.display, color: colors.onAccent, marginTop: spacing.xs },
  nextClassMeta: { color: colors.onAccent, opacity: 0.7, fontSize: 15, fontWeight: '500' },
  nextClassInstructor: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  nextClassAvatar: { borderWidth: 2, borderColor: colors.onAccent },
  nextClassInstructorLabel: { ...type.eyebrow, fontSize: 10, color: colors.onAccent, opacity: 0.55 },
  nextClassInstructorName: { ...type.h2, color: colors.onAccent, marginTop: 2 },
  viewButton: {
    flexDirection: 'row',
    backgroundColor: colors.onAccent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  viewButtonText: { color: colors.accent, fontWeight: '700' },

  emptyClassCard: { ...card(), borderRadius: radius.xl, padding: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  emptyClassText: { color: colors.inkSoft, fontSize: 14, textAlign: 'center' },
  bookButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.sm,
  },
  bookButtonText: { color: colors.onAccent, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statChip: { ...card(), flex: 1, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.xs },
  statValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, color: colors.ink },
  statLabel: { ...type.caption, color: colors.inkMuted },

  weeklyCard: { ...card(), padding: spacing.xl, gap: spacing.md },
  weeklyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weeklyTitle: { ...type.h2, color: colors.ink },
  weeklyCount: { ...type.h2, color: colors.ink },
  weeklyHint: { ...type.caption, color: colors.inkSoft },
  whatsappCard: { ...card(), minHeight: 136, padding: spacing.xl, justifyContent: 'space-between', overflow: 'hidden' },
  // Text sits on a photo, so it's white in both themes; the scrim keeps it readable over any upload.
  whatsappScrim: { experimental_backgroundImage: 'linear-gradient(110deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.55) 100%)' },
  whatsappTitle: { ...type.title, color: '#FFFFFF' },
  whatsappEyebrow: { ...type.eyebrow, fontSize: 13, letterSpacing: 4, color: 'rgba(255,255,255,0.85)', marginTop: spacing.xs },
  whatsappPill: {
    alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  whatsappPillText: { ...type.caption, fontWeight: '700', color: '#FFFFFF' },
}));
