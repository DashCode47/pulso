import { useState } from 'react';
import { View, Pressable, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '../../components/Text';
import { PulseLine } from '../../components/PulseLine';
import { showAlert } from '../../components/Dialog';
import { PencilSimpleIcon, ScalesIcon } from '../../components/icons';
import * as backend from '../../services/backend';
import { colors, radius, spacing, type, themed } from '../../theme';
import { bmi, chartPoints, localDate, parseDecimal } from './body';

const CHART_HEIGHT = 120;
const REMIND_DAYS = 30; // same window as queue_weigh_in_reminders()

function shortDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' }).replace('.', '');
}

export function BodyTracker() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['my-body'], queryFn: backend.getMyBody });
  const [editing, setEditing] = useState<'weight' | 'height' | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);

  if (isLoading || !data) return <PulseLine style={{ alignSelf: 'center' }} />;

  const { heightCm, measurements } = data;
  const first = measurements[0];
  const last = measurements.at(-1);
  const delta = first && last ? Math.round((last.weightKg - first.weightKg) * 10) / 10 : 0;
  const imc = last && heightCm ? bmi(last.weightKg, heightCm) : null;
  const daysSince = last ? Math.floor((Date.now() - new Date(last.measuredOn + 'T00:00:00').getTime()) / 86_400_000) : null;
  const due = daysSince !== null && daysSince >= REMIND_DAYS;

  function startEdit(kind: 'weight' | 'height') {
    setDraft(kind === 'height' && heightCm ? String(heightCm) : '');
    setEditing(kind);
  }

  async function save() {
    if (!editing || saving) return;
    const value = editing === 'weight' ? parseDecimal(draft, 25, 300) : parseDecimal(draft, 100, 250);
    if (value === null) {
      return showAlert('Valor inválido', editing === 'weight' ? 'Ingresa tu peso en kg (25–300).' : 'Ingresa tu estatura en cm (100–250).');
    }
    setSaving(true);
    try {
      if (editing === 'weight') await backend.logMyWeight(value, localDate());
      else await backend.updateMyHeight(value);
      setEditing(null);
      // Only cached copy of height_cm / body_measurements.
      queryClient.invalidateQueries({ queryKey: ['my-body'] });
    } catch {
      showAlert('Error', 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  const points = chartWidth && measurements.length > 1 ? chartPoints(measurements.map((m) => m.weightKg), chartWidth, CHART_HEIGHT) : [];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <ScalesIcon size={18} color={colors.accent} weight="fill" />
        <Text style={styles.title}>Peso y estatura</Text>
        <Pressable style={styles.heightChip} accessibilityRole="button" accessibilityLabel="Editar estatura" onPress={() => startEdit('height')}>
          <Text style={styles.heightText}>{heightCm ? `${heightCm} cm` : 'Agregar estatura'}</Text>
          <PencilSimpleIcon size={12} color={colors.inkMuted} />
        </Pressable>
      </View>

      {last ? (
        <View style={styles.stats}>
          <Stat label="Actual" value={`${last.weightKg} kg`} />
          <Stat label="Cambio" value={`${delta > 0 ? '+' : ''}${delta} kg`} sub={`desde ${shortDate(first!.measuredOn)}`} />
          <Stat label="IMC" value={imc ? String(imc) : '—'} sub={imc ? undefined : 'Falta estatura'} />
        </View>
      ) : (
        <Text style={styles.hint}>Registra tu peso cuando quieras y te mostramos tu evolución. Si pasa un mes sin registrar, te lo recordamos.</Text>
      )}

      {measurements.length > 1 && (
        <View>
          <View style={{ height: CHART_HEIGHT }} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
            {points.length > 0 && (
              <Svg width={chartWidth} height={CHART_HEIGHT}>
                <Polyline points={points.map((p) => p.join(',')).join(' ')} fill="none" stroke={colors.accent} strokeWidth={2.5} strokeLinejoin="round" />
                {points.map(([x, y], i) => (
                  <Circle key={i} cx={x} cy={y} r={3.5} fill={colors.accent} />
                ))}
              </Svg>
            )}
          </View>
          <View style={styles.axis}>
            <Text style={styles.axisText}>{shortDate(first!.measuredOn)}</Text>
            <Text style={styles.axisText}>{shortDate(last!.measuredOn)}</Text>
          </View>
        </View>
      )}

      {editing ? (
        <View style={styles.editRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            keyboardType="decimal-pad"
            placeholder={editing === 'weight' ? 'Peso' : 'Estatura'}
            placeholderTextColor={colors.inkMuted}
            autoFocus
            maxLength={5}
            editable={!saving}
            onSubmitEditing={save}
            accessibilityLabel={editing === 'weight' ? 'Peso en kilogramos' : 'Estatura en centímetros'}
          />
          <Text style={styles.unit}>{editing === 'weight' ? 'kg' : 'cm'}</Text>
          <Pressable style={styles.secondaryButton} disabled={saving} onPress={() => setEditing(null)}>
            <Text style={styles.secondaryText}>Cancelar</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} disabled={saving} onPress={save}>
            {saving ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Text style={styles.primaryText}>Guardar</Text>}
          </Pressable>
        </View>
      ) : (
        <View style={styles.footer}>
          <Text style={styles.hint}>
            {last ? (due ? 'Te toca tu registro mensual.' : `Último registro: ${shortDate(last.measuredOn)}`) : ''}
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => startEdit('weight')}>
            <Text style={styles.primaryText}>{last ? 'Registrar peso' : 'Primer registro'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...type.h2, color: colors.ink, flex: 1 },
  heightChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.sm },
  heightText: { ...type.caption, color: colors.inkSoft },
  stats: { flexDirection: 'row', gap: spacing.md },
  statLabel: { ...type.eyebrow, fontSize: 10, color: colors.inkMuted },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.ink, marginTop: 2 },
  statSub: { ...type.caption, color: colors.inkSoft },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { ...type.caption, color: colors.inkMuted },
  hint: { ...type.caption, color: colors.inkSoft, flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.ink, borderBottomWidth: 1, borderBottomColor: colors.accent, paddingVertical: spacing.xs },
  unit: { ...type.label, color: colors.inkSoft },
  primaryButton: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.accent },
  primaryText: { ...type.label, color: colors.onAccent },
  secondaryButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  secondaryText: { ...type.label, color: colors.inkSoft },
}));
