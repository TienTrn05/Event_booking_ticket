import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { uploadImage, type ImageTarget } from '../api/media.api';
import { useLocale } from '../../../shared/i18n/LocaleContext';

export function ImageUpload({
  accessToken,
  target,
  label,
  imageUrl,
  onUploaded,
}: {
  accessToken: string;
  target: ImageTarget;
  label: string;
  imageUrl?: string | null;
  onUploaded: (result: { imageUrl: string; version?: number }) => void;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), [accessToken]);
  return (
    <div className="my-4 flex flex-col gap-2">
      {imageUrl && (
        <img
          src={imageUrl}
          alt={label}
          className={
            target.purpose === 'avatar'
              ? 'h-20 w-20 rounded-full object-cover'
              : 'aspect-video w-full max-w-sm rounded-xl object-cover'
          }
        />
      )}
      <label className="text-sm font-medium">
        {label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-surface p-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:text-accent"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (!file) return;
            void (async () => {
              controller.current?.abort();
              const request = new AbortController();
              controller.current = request;
              setBusy(true);
              setMessage(t('Đang tải ảnh…', 'Uploading image…'));
              try {
                const result = await uploadImage(file, target, accessToken, request.signal);
                if (!request.signal.aborted) {
                  onUploaded(result);
                  setMessage(t('Đã cập nhật ảnh.', 'Image updated.'));
                }
              } catch (error) {
                if (!request.signal.aborted)
                  setMessage(
                    error instanceof ApiError && error.status === 401
                      ? t(
                          'Phiên đã hết hạn. Hãy mở lại tài khoản và thử lại.',
                          'Your session expired. Reopen your account and try again.',
                        )
                      : error instanceof ApiError && error.status === 409
                        ? t(
                            'Thông tin đã thay đổi. Hãy tải lại và thử lại.',
                            'Details changed. Refresh and try again.',
                          )
                        : error instanceof Error && !(error instanceof ApiError)
                          ? t(
                              error.message,
                              'Choose a JPEG, PNG or WebP image up to 5 MB and try again.',
                            )
                          : t(
                              'Không cập nhật được ảnh. Vui lòng thử lại.',
                              'Unable to update the image. Please try again.',
                            ),
                  );
              } finally {
                if (!request.signal.aborted) setBusy(false);
              }
            })();
          }}
        />
      </label>
      <p className="text-xs text-muted">
        {t('JPEG, PNG hoặc WebP · Tối đa 5 MB', 'JPEG, PNG or WebP · Up to 5 MB')}
      </p>
      <p role="status" className="text-sm">
        {message}
      </p>
    </div>
  );
}
