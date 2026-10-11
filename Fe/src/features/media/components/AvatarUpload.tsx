import { useEffect, useState } from 'react';
import { getAvatar } from '../api/media.api';
import { ImageUpload } from './ImageUpload';

export function AvatarUpload({ accessToken }: { accessToken: string }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void getAvatar(accessToken, controller.signal)
      .then((url) => {
        if (!controller.signal.aborted) setAvatarUrl(url);
      })
      .catch(() => {
        /* Upload reports actionable errors to the user. */
      });
    return () => controller.abort();
  }, [accessToken]);
  return (
    <ImageUpload
      key={accessToken}
      accessToken={accessToken}
      target={{ purpose: 'avatar' }}
      label="Ảnh đại diện"
      imageUrl={avatarUrl}
      onUploaded={(result) => setAvatarUrl(result.imageUrl)}
    />
  );
}
