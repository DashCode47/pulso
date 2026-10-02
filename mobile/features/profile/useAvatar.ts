import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as backend from '../../services/backend';

// Single cache entry shared by Home and Profile: updating it after an upload
// re-renders every avatar at once.
const KEY = ['my-avatar'];

export function useMyAvatar() {
  return useQuery({ queryKey: KEY, queryFn: backend.getMyAvatarUrl });
}

// Resolves to null when the user cancels the picker.
export function useChangeAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1, // compressed once below, not twice
      });
      if (result.canceled) return null;
      // Avatars render at 40-84 px (~250 px on a 3x screen): a full-res photo
      // (1-3 MB) would be egress on every ranking view. 512 px JPEG is ~50 KB.
      const image = await ImageManipulator.manipulate(result.assets[0].uri).resize({ width: 512 }).renderAsync();
      const resized = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
      return backend.uploadMyAvatar(resized.uri, 'image/jpeg');
    },
    onSuccess: (url) => {
      if (url) queryClient.setQueryData(KEY, url);
    },
  });
}
