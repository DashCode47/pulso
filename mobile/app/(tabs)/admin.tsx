import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as backend from '../../services/backend';
import { Screen } from '../../components/Screen';
import { colors, radius, spacing, type } from '../../theme';

const statusLabel: Record<backend.AdminClass['status'], string> = {
  scheduled: 'Programada',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const emptyForm = { title: '', instructorId: '', durationMinutes: '', capacity: '' };

export default function Admin() {
  const queryClient = useQueryClient();
  const { data: classes, isLoading } = useQuery({
    queryKey: ['admin', 'classes'],
    queryFn: backend.listAllUpcomingClasses,
  });
  const { data: instructors, refetch: refetchInstructors } = useQuery({
    queryKey: ['admin', 'instructors'],
    queryFn: backend.listInstructors,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [startsAt, setStartsAt] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [showPicker, setShowPicker] = useState<'date' | 'time' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [newInstructorName, setNewInstructorName] = useState('');
  const [addingInstructor, setAddingInstructor] = useState(false);

  const isEditing = editingId !== null;
  const canSubmit = form.title.trim().length > 0 && form.instructorId.length > 0 && Number(form.durationMinutes) > 0 && Number(form.capacity) > 0;

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setStartsAt(new Date(Date.now() + 60 * 60 * 1000));
    setFormError(null);
  }

  function startEditing(c: backend.AdminClass) {
    setEditingId(c.id);
    setForm({ title: c.title, instructorId: c.instructorId, durationMinutes: String(c.durationMinutes), capacity: String(c.capacity) });
    setStartsAt(new Date(c.startsAt));
    setFormError(null);
  }

  async function handleAddInstructor() {
    const name = newInstructorName.trim();
    if (!name || addingInstructor) return;
    setAddingInstructor(true);
    const { instructor, error } = await backend.createInstructor(name);
    setAddingInstructor(false);
    if (error || !instructor) {
      setFormError('No se pudo agregar el instructor.');
      return;
    }
    setNewInstructorName('');
    setForm((f) => ({ ...f, instructorId: instructor.id }));
    refetchInstructors();
  }

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setFormError(null);

    const input = {
      title: form.title.trim(),
      instructorId: form.instructorId,
      startsAt,
      durationMinutes: Number(form.durationMinutes),
      capacity: Number(form.capacity),
    };
    const { error } = isEditing ? await backend.updateClass(editingId, input) : await backend.createClass(input);

    setSubmitting(false);
    if (error) {
      setFormError(isEditing ? 'No se pudo actualizar la clase.' : 'No se pudo crear la clase.');
      return;
    }
    resetForm();
    await queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
  }

  function confirmCancel(c: backend.AdminClass) {
    Alert.alert('Cancelar clase', `¿Cancelar "${c.title}"? Se reembolsará el crédito a quienes ya reservaron.`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          setCancellingId(c.id);
          const { error } = await backend.cancelClass(c.id);
          setCancellingId(null);
          if (error) {
            Alert.alert('Error', 'No se pudo cancelar la clase.');
            return;
          }
          if (editingId === c.id) resetForm();
          await queryClient.invalidateQueries({ queryKey: ['admin', 'classes'] });
        },
      },
    ]);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Admin</Text>

        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.sectionTitle}>{isEditing ? 'Editar clase' : 'Nueva clase'}</Text>
            {isEditing && (
              <Pressable onPress={resetForm}>
                <Text style={styles.cancelEditText}>Cancelar edición</Text>
              </Pressable>
            )}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Título (ej. HIIT)"
            placeholderTextColor={colors.inkMuted}
            value={form.title}
            onChangeText={(title) => setForm((f) => ({ ...f, title }))}
          />
          <Text style={styles.fieldLabel}>Instructor</Text>
          <View style={styles.chipRow}>
            {(instructors ?? []).filter((i) => i.active).map((i) => (
              <Pressable
                key={i.id}
                style={[styles.chip, form.instructorId === i.id && styles.chipSelected]}
                onPress={() => setForm((f) => ({ ...f, instructorId: i.id }))}
              >
                <Text style={[styles.chipText, form.instructorId === i.id && styles.chipTextSelected]}>{i.name}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder="Nuevo instructor"
              placeholderTextColor={colors.inkMuted}
              value={newInstructorName}
              onChangeText={setNewInstructorName}
            />
            <Pressable style={styles.addInstructorButton} disabled={addingInstructor} onPress={handleAddInstructor}>
              {addingInstructor ? (
                <ActivityIndicator size="small" color={colors.onAccent} />
              ) : (
                <Text style={styles.addInstructorButtonText}>Agregar</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.row}>
            <Pressable style={styles.dateButton} onPress={() => setShowPicker('date')}>
              <Text style={styles.dateButtonText}>
                {startsAt.toLocaleDateString('es', { day: '2-digit', month: 'short' })}
              </Text>
            </Pressable>
            <Pressable style={styles.dateButton} onPress={() => setShowPicker('time')}>
              <Text style={styles.dateButtonText}>
                {startsAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Pressable>
          </View>

          {showPicker && (
            <DateTimePicker
              value={startsAt}
              mode={showPicker}
              is24Hour
              onChange={(_event, selected) => {
                setShowPicker(Platform.OS === 'ios' ? showPicker : null);
                if (!selected) return;
                setStartsAt(selected);
              }}
            />
          )}

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder="Duración (min), ej. 45"
              placeholderTextColor={colors.inkMuted}
              keyboardType="number-pad"
              value={form.durationMinutes}
              onChangeText={(durationMinutes) => setForm((f) => ({ ...f, durationMinutes }))}
            />
            <TextInput
              style={[styles.input, styles.inputHalf]}
              placeholder="Capacidad, ej. 12"
              placeholderTextColor={colors.inkMuted}
              keyboardType="number-pad"
              value={form.capacity}
              onChangeText={(capacity) => setForm((f) => ({ ...f, capacity }))}
            />
          </View>

          {formError && <Text style={styles.formError}>{formError}</Text>}

          <Pressable
            style={[styles.submitButton, (!canSubmit || submitting) && styles.submitButtonDisabled]}
            disabled={!canSubmit || submitting}
            onPress={handleSubmit}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.submitButtonText}>{isEditing ? 'Guardar cambios' : 'Crear clase'}</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Próximas clases</Text>
        {isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <View style={styles.list}>
            {(classes ?? []).map((c) => {
              const isCancelled = c.status === 'cancelled';
              return (
                <View key={c.id} style={[styles.classRow, editingId === c.id && styles.classRowActive]}>
                  <Pressable style={{ flex: 1 }} disabled={isCancelled} onPress={() => startEditing(c)}>
                    <Text style={styles.classTitle}>{c.title}</Text>
                    <Text style={styles.classMeta}>
                      {new Date(c.startsAt).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} ·{' '}
                      {c.durationMinutes} min · {c.instructorName} · {c.capacity} bicis
                    </Text>
                    <Text style={[styles.classStatus, isCancelled && styles.classStatusCancelled]}>{statusLabel[c.status]}</Text>
                  </Pressable>
                  {!isCancelled && (
                    <Pressable
                      style={styles.cancelIconButton}
                      disabled={cancellingId === c.id}
                      onPress={() => confirmCancel(c)}
                    >
                      {cancellingId === c.id ? (
                        <ActivityIndicator size="small" color={colors.danger} />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })}
            {classes?.length === 0 && <Text style={styles.emptyText}>No hay clases programadas.</Text>}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xxl, gap: spacing.xl },
  title: { ...type.title, color: colors.ink },
  sectionTitle: { ...type.h2, color: colors.ink },

  formCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelEditText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  fieldLabel: { ...type.label, color: colors.inkSoft },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  chipTextSelected: { color: colors.onAccent },
  addInstructorButton: {
    backgroundColor: colors.ink,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addInstructorButtonText: { color: colors.onDark, fontWeight: '600', fontSize: 13 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    color: colors.ink,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  inputHalf: { flex: 1 },
  dateButton: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dateButtonText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  formError: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  submitButton: { backgroundColor: colors.accent, borderRadius: radius.sm, padding: spacing.md, alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: colors.locked },
  submitButtonText: { color: colors.onAccent, fontWeight: '700' },

  list: { gap: spacing.sm },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.sm,
  },
  classRowActive: { borderWidth: 1.5, borderColor: colors.accent },
  classTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  classMeta: { ...type.caption, color: colors.inkSoft, marginTop: 2 },
  classStatus: { ...type.label, color: colors.inkSoft, marginTop: 4 },
  classStatusCancelled: { color: colors.danger },
  cancelIconButton: { padding: spacing.sm },
  emptyText: { color: colors.inkSoft, fontSize: 14 },
});
