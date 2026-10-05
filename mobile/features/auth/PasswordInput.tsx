import { useState } from 'react';
import { TextInput, Pressable, View } from 'react-native';
import { EyeIcon, EyeSlashIcon } from '../../components/icons';
import { authStyles as styles } from './styles';
import { colors, useThemeMode } from '../../theme';

export function PasswordInput(props: { placeholder: string; value: string; onChangeText: (v: string) => void }) {
  const mode = useThemeMode((s) => s.mode);
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <TextInput
        {...props}
        style={[styles.input, styles.inputWithIcon]}
        placeholderTextColor={colors.inkMuted}
        keyboardAppearance={mode}
        autoCapitalize="none"
        secureTextEntry={!visible}
      />
      <Pressable
        style={styles.eye}
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? <EyeSlashIcon size={20} color={colors.inkMuted} /> : <EyeIcon size={20} color={colors.inkMuted} />}
      </Pressable>
    </View>
  );
}
