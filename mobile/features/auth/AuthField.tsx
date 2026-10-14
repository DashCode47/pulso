import { useState } from 'react';
import { Pressable, View, type TextInputProps } from 'react-native';
import { TextInput } from '../../components/Text';
import { EyeIcon, EyeSlashIcon, type Icon } from '../../components/icons';
import { authStyles as styles, GOLD, PLACEHOLDER } from './styles';

// Input pill con ícono dorado a la izquierda; `secure` agrega el toggle de ver contraseña.
export function AuthField({ icon: FieldIcon, secure, ...props }: TextInputProps & { icon: Icon; secure?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <FieldIcon size={26} color={GOLD} weight="fill" />
      </View>
      <View style={{ flex: 1 }}>
        <TextInput
          {...props}
          style={[styles.input, secure && styles.inputWithIcon]}
          placeholderTextColor={PLACEHOLDER}
          keyboardAppearance="dark"
          autoCapitalize={secure ? 'none' : props.autoCapitalize}
          secureTextEntry={secure && !visible}
        />
        {secure && (
          <Pressable
            style={styles.eye}
            onPress={() => setVisible((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {visible ? <EyeSlashIcon size={20} color={PLACEHOLDER} /> : <EyeIcon size={20} color={PLACEHOLDER} />}
          </Pressable>
        )}
      </View>
    </View>
  );
}
