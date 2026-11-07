import { useState } from 'react';
import { Image, type ImageProps } from 'expo-image';
import { appImageUrl, type AppImageName } from '../services/backend';

// Image from the app-images bucket, with the bundled copy as placeholder and
// fallback: shows instantly on first launch / offline, and stays if the file
// is missing from the bucket.
// cachePolicy "memory": no disk cache, so an image replaced in the bucket
// shows up on the next app launch (within the CDN's cache window).
export function AppImage({
  name,
  fallback,
  ...props
}: Omit<ImageProps, 'source' | 'placeholder'> & { name: AppImageName; fallback: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      // Crossfade placeholder -> bucket image instead of a hard swap; callers can override.
      transition={300}
      {...props}
      source={failed ? fallback : { uri: appImageUrl(name) }}
      placeholder={fallback}
      placeholderContentFit={props.contentFit}
      cachePolicy="memory"
      onError={() => setFailed(true)}
    />
  );
}
