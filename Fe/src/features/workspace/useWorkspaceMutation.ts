import { useRef, useState } from 'react';
import type { z } from 'zod';
import { ApiError, apiRequest } from '../../shared/api/client';
import { useLocale } from '../../shared/i18n/LocaleContext';
import { workspaceError } from './workspace.api';

type PreparedCommand = Readonly<{
  path: string;
  method: 'POST' | 'PATCH' | 'PUT';
  body: string;
  key: string;
  parse: (value: unknown) => unknown;
  success: (value: unknown) => void;
}>;

// One explicit attempt owns its immutable request until the server result is known.
// A token refresh does not create a new attempt; unmount on actor/logout discards it.
export function useWorkspaceMutation(token: string) {
  const { locale, t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const prepared = useRef<PreparedCommand | null>(null);
  const uncertainCommand = useRef<PreparedCommand | null>(null);
  const running = useRef(false);

  async function perform(command: PreparedCommand) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = command.parse(
        await apiRequest(command.path, {
          method: command.method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': command.key,
          },
          body: command.body,
        }),
      );
      prepared.current = null;
      uncertainCommand.current = null;
      setUncertain(false);
      command.success(result);
      setNotice(t('Đã lưu thay đổi.', 'Changes saved.'));
    } catch (cause) {
      const definitive =
        cause instanceof ApiError &&
        cause.status < 500 &&
        cause.code !== 'REQUEST_IN_PROGRESS' &&
        uncertainCommand.current !== command;
      if (definitive) {
        prepared.current = null;
        setUncertain(false);
        setError(workspaceError(cause, locale === 'en'));
      } else {
        // A later denial only rejects the retry; it cannot disprove the original commit.
        uncertainCommand.current = command;
        setUncertain(true);
        setError(
          t(
            'Chưa xác nhận được kết quả. Giữ nguyên yêu cầu và bấm “Thử lại cùng yêu cầu”.',
            'The result is uncertain. Keep this request unchanged and choose “Retry same request”.',
          ),
        );
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function start<T>(input: {
    path: string;
    method?: 'POST' | 'PATCH' | 'PUT';
    body: unknown;
    schema: z.ZodType<T>;
    onSuccess: (value: T) => void;
  }) {
    if (prepared.current || running.current) return;
    const command: PreparedCommand = Object.freeze({
      path: input.path,
      method: input.method ?? 'POST',
      body: JSON.stringify(input.body),
      key: crypto.randomUUID(),
      parse: (value: unknown) => input.schema.parse(value),
      success: (value: unknown) => input.onSuccess(input.schema.parse(value)),
    });
    prepared.current = command;
    void perform(command);
  }

  return {
    busy,
    uncertain,
    locked: busy || uncertain,
    error,
    notice,
    start,
    retry: () => {
      if (prepared.current) void perform(prepared.current);
    },
  };
}
