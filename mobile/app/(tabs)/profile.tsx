import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../features/auth/useAuth';
import { mockMembership, mockHistory, historyStatusLabel, type HistoryStatus } from '../../features/profile/mockData';
import { Screen } from '../../components/Screen';

const statusColor: Record<HistoryStatus, string> = {
  attended: '#0a7d32',
  cancelled: '#999',
  no_show: '#c00',
};

export default function Profile() {
  const { user, signOut } = useAuth();

  return (
    <Screen>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={28} color="#fff" />
        </View>
        <View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </View>

      <View style={styles.membershipCard}>
        <Text style={styles.membershipPlan}>Plan {mockMembership.planName}</Text>
        <Text style={styles.membershipCredits}>
          {mockMembership.creditsBalance} / {mockMembership.creditsPerCycle} créditos
        </Text>
        <Text style={styles.membershipRenews}>Se renueva el {mockMembership.renewsOn}</Text>
      </View>

      <View>
        <Text style={styles.sectionTitle}>Historial</Text>
        <View style={styles.historyList}>
          {mockHistory.map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <View>
                <Text style={styles.historyTitle}>{entry.title}</Text>
                <Text style={styles.historyDate}>{entry.date}</Text>
              </View>
              <Text style={[styles.historyStatus, { color: statusColor[entry.status] }]}>
                {historyStatusLabel[entry.status]}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '700' },
  email: { fontSize: 14, color: '#666' },
  membershipCard: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, gap: 4 },
  membershipPlan: { fontSize: 16, fontWeight: '700' },
  membershipCredits: { fontSize: 14, color: '#333' },
  membershipRenews: { fontSize: 13, color: '#666' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  historyList: { gap: 8 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 14,
  },
  historyTitle: { fontSize: 15, fontWeight: '600' },
  historyDate: { fontSize: 13, color: '#666', marginTop: 2 },
  historyStatus: { fontSize: 13, fontWeight: '700' },
  signOutButton: { borderRadius: 8, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#c00' },
  signOutText: { color: '#c00', fontWeight: '600' },
});
