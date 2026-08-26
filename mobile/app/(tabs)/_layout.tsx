import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../features/auth/store';

export default function TabsLayout() {
  const isAdmin = useAuthStore((s) => s.isAdmin);

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#111' }}>
      <Tabs.Screen
        name="home"
        options={{ title: 'Inicio', tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }}
      />
      <Tabs.Protected guard={!isAdmin}>
        <Tabs.Screen
          name="bookings"
          options={{
            title: 'Reservar',
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{ title: 'Ranking', tabBarIcon: ({ color, size }) => <Ionicons name="trophy" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progreso',
            tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" color={color} size={size} />,
          }}
        />
      </Tabs.Protected>
      <Tabs.Protected guard={isAdmin}>
        <Tabs.Screen
          name="admin"
          options={{ title: 'Clases', tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="members"
          options={{ title: 'Miembros', tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} /> }}
        />
      </Tabs.Protected>
      <Tabs.Screen
        name="profile"
        options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
