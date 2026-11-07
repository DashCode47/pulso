import { useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './Text';
import { colors, themed } from '../theme';

// Instructor photo from the instructor-photos bucket; initials until an admin
// uploads one (photos are set by hand in the Supabase dashboard), or if the
// photo fails to load (missing file, no connection).
export function InstructorAvatar({
  name,
  photoUrl,
  size,
  style,
}: {
  name: string;
  photoUrl: string | null;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[styles.avatar, box, style]}>
      {photoUrl && photoUrl !== failedUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={box}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          onError={() => setFailedUrl(photoUrl)}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
      )}
    </View>
  );
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}

const styles = themed(() => StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  initials: { fontWeight: '700', color: colors.inkSoft, letterSpacing: 0.5 },
}));
