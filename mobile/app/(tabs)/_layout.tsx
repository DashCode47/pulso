import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import {
  HouseIcon,
  CalendarCheckIcon,
  TrophyIcon,
  ChartBarIcon,
  UsersThreeIcon,
  UserCircleIcon,
  type Icon,
} from '../../components/icons';
import { useAuthStore } from '../../features/auth/store';
import { colors, useThemeMode } from '../../theme';

const tabIcon =
  (I: Icon) =>
  ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    // tintColor props are always plain strings here (from theme colors)
    <I color={color as string} size={size} weight={focused ? 'fill' : 'regular'} />
  );

export default function TabsLayout() {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  useThemeMode((s) => s.mode); // re-render del tab bar al cambiar de tema

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Inicio', tabBarIcon: tabIcon(HouseIcon) }} />
      <Tabs.Protected guard={!isAdmin}>
        <Tabs.Screen name="bookings" options={{ title: 'Reservar', tabBarIcon: tabIcon(CalendarCheckIcon) }} />
        <Tabs.Screen name="leaderboard" options={{ title: 'Ranking', tabBarIcon: tabIcon(TrophyIcon) }} />
        <Tabs.Screen name="progress" options={{ title: 'Progreso', tabBarIcon: tabIcon(ChartBarIcon) }} />
      </Tabs.Protected>
      <Tabs.Protected guard={isAdmin}>
        <Tabs.Screen name="admin" options={{ title: 'Clases', tabBarIcon: tabIcon(CalendarCheckIcon) }} />
        <Tabs.Screen name="members" options={{ title: 'Miembros', tabBarIcon: tabIcon(UsersThreeIcon) }} />
      </Tabs.Protected>
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: tabIcon(UserCircleIcon) }} />
    </Tabs>
  );
}
