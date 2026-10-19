import { useEffect, useState } from 'react';
import { getAvatar } from '../api/media.api';
import { ImageUpload } from './ImageUpload';
import { useLocale } from '../../../shared/i18n/LocaleContext';

export function AvatarUpload({ accessToken }: { accessToken: string }) {
  const { t } = useLocale();
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
      label={t('Ảnh đại diện', 'Profile picture')}
      imageUrl={avatarUrl}
      onUploaded={(result) => setAvatarUrl(result.imageUrl)}
    />
  );
}
