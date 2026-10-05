import { useEffect, useRef } from 'react';
import { Modal, View, Text, Pressable, Animated, Easing, StyleSheet } from 'react-native';
import { create } from 'zustand';
import { colors, radius, spacing, themed } from '../theme';

type DialogButton = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
type DialogState = { title: string; message?: string; buttons: DialogButton[] };

const useDialog = create<{ dialog: DialogState | null }>(() => ({ dialog: null }));

// Reemplazo de Alert.alert con la misma firma: el Alert nativo no se puede
// estilizar. Requiere <DialogHost /> montado una vez (app/_layout.tsx).
// ponytail: un diálogo a la vez; uno nuevo reemplaza al abierto.
export function showAlert(title: string, message?: string, buttons: DialogButton[] = [{ text: 'Entendido' }]) {
  useDialog.setState({ dialog: { title, message, buttons } });
}

function close(button?: DialogButton) {
  useDialog.setState({ dialog: null });
  button?.onPress?.();
}

export function DialogHost() {
  const dialog = useDialog((s) => s.dialog);
  // Mantiene el contenido mientras corre el fade de salida del Modal.
  const last = useRef(dialog);
  if (dialog) last.current = dialog;
  const shown = last.current;

  const scale = useRef(new Animated.Value(0.94)).current;
  useEffect(() => {
    if (!dialog) return;
    scale.setValue(0.94);
    Animated.timing(scale, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [dialog, scale]);

  // Tocar afuera o el botón atrás de Android = el botón "cancel" (o cerrar si es un aviso de un botón).
  const cancel = shown?.buttons.find((b) => b.style === 'cancel') ?? (shown?.buttons.length === 1 ? shown.buttons[0] : undefined);
  const dismiss = () => cancel && close(cancel);

  return (
    <Modal visible={!!dialog} transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        {shown && (
          // Pressable vacío: evita que un toque en la tarjeta cierre el diálogo.
          <Pressable onPress={() => {}} style={styles.cardWrap}>
            <Animated.View style={[styles.card, { transform: [{ scale }] }]} accessibilityRole="alert">
              <Text style={styles.title}>{shown.title}</Text>
              {!!shown.message && <Text style={styles.message}>{shown.message}</Text>}
              <View style={styles.buttons}>
                {shown.buttons.map((b) => (
                  <Pressable
                    key={b.text}
                    onPress={() => close(b)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.button,
                      b.style === 'cancel' ? styles.buttonCancel : b.style === 'destructive' ? styles.buttonDestructive : styles.buttonDefault,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        b.style === 'cancel' ? styles.textCancel : b.style === 'destructive' ? styles.textDestructive : styles.textDefault,
                      ]}
                    >
                      {b.text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  cardWrap: { width: '100%', maxWidth: 360 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: colors.ink },
  message: { fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  button: { flex: 1, borderRadius: radius.pill, paddingVertical: spacing.md + 2, paddingHorizontal: spacing.md, alignItems: 'center' },
  buttonDefault: { backgroundColor: colors.accent },
  buttonCancel: { backgroundColor: colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  buttonDestructive: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  textDefault: { color: colors.onAccent },
  textCancel: { color: colors.ink },
  textDestructive: { color: colors.danger },
}));
