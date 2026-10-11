import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { uploadImage, type ImageTarget } from '../api/media.api';

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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), [accessToken]);
  return (
    <div className="my-4 flex flex-col gap-2">
      {imageUrl && (
        <img src={imageUrl} alt={label} className="h-20 w-20 rounded-full object-cover" />
      )}
      <label className="text-sm font-medium">
        {label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          className="mt-2 block w-full text-sm"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (!file) return;
            void (async () => {
              controller.current?.abort();
              const request = new AbortController();
              controller.current = request;
              setBusy(true);
              setMessage('Đang tải ảnh…');
              try {
                const result = await uploadImage(file, target, accessToken, request.signal);
                if (!request.signal.aborted) {
                  onUploaded(result);
                  setMessage('Đã cập nhật ảnh.');
                }
              } catch (error) {
                if (!request.signal.aborted)
                  setMessage(
                    error instanceof ApiError && error.status === 401
                      ? 'Phiên đã hết hạn. Hãy mở lại tài khoản và thử lại.'
                      : error instanceof ApiError && error.status === 409
                        ? 'Thông tin đã thay đổi. Hãy tải lại và thử lại.'
                        : error instanceof Error && !(error instanceof ApiError)
                          ? error.message
                          : 'Không cập nhật được ảnh. Vui lòng thử lại.',
                  );
              } finally {
                if (!request.signal.aborted) setBusy(false);
              }
            })();
          }}
        />
      </label>
      <p className="text-xs opacity-70">JPEG, PNG hoặc WebP · Tối đa 5 MB</p>
      <p role="status" className="text-sm">
        {message}
      </p>
    </div>
  );
}
