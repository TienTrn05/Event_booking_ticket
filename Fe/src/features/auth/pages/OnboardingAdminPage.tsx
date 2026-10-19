import Button from '../../../shared/ui/Button';
import { useEffect, useRef, useState } from 'react';
import { useAuthDialog } from '../context/AuthDialogContext';
import { ApiError, apiRequest } from '../../../shared/api/client';
import { questionnaireSchema, type Question } from '../schemas/questionnaire.schema';
import { z } from 'zod';
import { ClipboardList, LockKeyhole, Plus } from 'lucide-react';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import './onboarding-admin.css';
const schema = z.object({ data: questionnaireSchema });
export function OnboardingAdminPage() {
  const { accessToken, user, openAuth } = useAuthDialog();
  const { t } = useLocale();
  return (
    <main id="main" className="onboarding-admin">
      <header className="onboarding-admin-heading">
        <span>{t('QUẢN TRỊ HỆ THỐNG', 'ADMINISTRATION')}</span>
        <h1>
          <ClipboardList aria-hidden="true" />
          {t('Câu hỏi đăng ký', 'Registration questions')}
        </h1>
        <p>
          {t(
            'Một khởi đầu phù hợp hơn cho mỗi thành viên.',
            'A more thoughtful start for every member.',
          )}
        </p>
      </header>
      {accessToken && user ? (
        <Editor key={user.id} token={accessToken} />
      ) : (
        <section className="onboarding-admin-empty">
          <LockKeyhole aria-hidden="true" />
          <h2>{t('Đăng nhập Admin để tiếp tục', 'Sign in as an administrator')}</h2>
          <Button variant="outline" type="button" onClick={() => openAuth('login')}>
            {t('Đăng nhập Admin', 'Sign in')}
          </Button>
        </section>
      )}
    </main>
  );
}
function Editor({ token }: { token: string }) {
  const { t, locale } = useLocale();
  const [loaded, setLoaded] = useState<{ id: string; questions: Question[] } | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [retry, setRetry] = useState(0),
    [frozen, setFrozen] = useState(false);
  const pending = useRef<{ key: string; body: string } | null>(null);
  const uncertainRequest = useRef<{ key: string; body: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void apiRequest('/admin/onboarding/questions', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((result) => {
        if (!cancelled) {
          setLoaded(schema.parse(result).data);
          setError('');
        }
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof ApiError && e.status === 403
              ? t(
                  'Bạn không có quyền quản lý câu hỏi.',
                  'You do not have permission to manage questions.',
                )
              : t('Chưa tải được bộ câu hỏi.', 'Unable to load the questionnaire.'),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [token, retry, t]);
  const change = (index: number, next: Question) =>
    setLoaded((current) =>
      current
        ? { ...current, questions: current.questions.map((q, i) => (i === index ? next : q)) }
        : null,
    );
  const add = (question: Question) => {
    setNotice('');
    setLoaded((current) =>
      current ? { ...current, questions: [...current.questions, question] } : null,
    );
  };
  async function publish() {
    if (!loaded) return;
    setBusy(true);
    setError('');
    setNotice('');
    const current = pending.current ?? {
      key: crypto.randomUUID(),
      body: JSON.stringify({ questionnaireId: loaded.id, questions: loaded.questions }),
    };
    pending.current = current;
    try {
      setFrozen(true);
      const result = await apiRequest('/admin/onboarding/questions', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': current.key,
        },
        body: current.body,
      });
      setLoaded(schema.parse(result).data);
      setNotice(
        t(
          'Đã xuất bản bộ câu hỏi mới. Tài khoản đã hoàn tất giữ câu trả lời cũ.',
          'The new questionnaire is published. Completed registrations keep their previous answers.',
        ),
      );
      pending.current = null;
      uncertainRequest.current = null;
      setFrozen(false);
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status < 500 &&
        e.code !== 'REQUEST_IN_PROGRESS' &&
        uncertainRequest.current !== current
      ) {
        pending.current = null;
        setFrozen(false);
        setError(
          e.code === 'ONBOARDING_QUESTIONNAIRE_CHANGED'
            ? t(
                'Admin khác vừa cập nhật. Hãy tải lại rồi sửa.',
                'Another administrator updated this questionnaire. Reload before editing.',
              )
            : t(
                'Cấu hình chưa hợp lệ hoặc bạn không có quyền lưu.',
                'The configuration is invalid or you do not have permission to save.',
              ),
        );
      } else {
        uncertainRequest.current = current;
        setError(
          t(
            'Chưa xác nhận được kết quả. Bấm xuất bản lại với cùng yêu cầu.',
            'The result is uncertain. Publish again to retry the same request.',
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  }
  if (!loaded)
    return (
      <>
        <p role={error ? 'alert' : 'status'}>{error || t('Đang tải…', 'Loading…')}</p>
        {error && (
          <Button variant="outline" onClick={() => setRetry((v) => v + 1)}>
            {t('Thử lại', 'Try again')}
          </Button>
        )}
      </>
    );
  return (
    <>
      <div className="onboarding-admin-policy">
        <h2>{t('Hồ sơ cơ bản luôn được giữ', 'The core profile stays consistent')}</h2>
        <p>
          {t(
            'Bốn trường luôn bắt buộc: vai trò, tên hiển thị, giới tính, ngày sinh.',
            'Role, display name, gender, and date of birth are always required.',
          )}
        </p>
        <p>
          {t(
            'Thay đổi dưới đây áp dụng cho lượt đăng ký chưa hoàn tất. Phiên bản và câu trả lời trước được giữ.',
            'Changes apply to registrations still in progress. Previous versions and answers are retained.',
          )}
        </p>
        <span>
          {t('Phiên bản hiện tại', 'Current version')}: #{loaded.id}
        </span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void publish();
        }}
      >
        <fieldset disabled={busy || frozen} className="onboarding-admin-questions">
          {loaded.questions.map((q, index) => (
            <section key={q.key} className="onboarding-admin-question">
              <label>
                <span className="onboarding-admin-question-number">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {t('Nội dung câu hỏi', 'Question label')}
                <input
                  required
                  maxLength={160}
                  value={q.label}
                  onChange={(e) => change(index, { ...q, label: e.target.value })}
                />
              </label>
              <label>
                <input type="checkbox" checked disabled />{' '}
                {t(
                  'Mọi câu trong lượt đăng ký đều bắt buộc',
                  'Every registration question requires an answer',
                )}
              </label>
              {q.key.startsWith('custom_') ? (
                <>
                  <label>
                    {t('Kiểu trả lời', 'Answer type')}
                    <select
                      value={q.kind}
                      onChange={(e) => {
                        const kind = e.target.value as 'TEXT' | 'SINGLE_CHOICE' | 'MULTI_CHOICE';
                        change(index, {
                          key: q.key,
                          label: q.label,
                          required: q.required,
                          kind,
                          ...(kind === 'TEXT'
                            ? {}
                            : {
                                options: q.options ?? [
                                  { value: 'yes', label: 'Có' },
                                  { value: 'no', label: 'Không' },
                                ],
                              }),
                        });
                      }}
                    >
                      <option value="TEXT">{t('Văn bản ngắn', 'Short text')}</option>
                      <option value="SINGLE_CHOICE">{t('Chọn một', 'Single choice')}</option>
                      <option value="MULTI_CHOICE">{t('Chọn nhiều', 'Multiple choice')}</option>
                    </select>
                  </label>
                  {q.kind !== 'TEXT' && (
                    <label>
                      {t('Lựa chọn, mỗi dòng: mã | nhãn', 'Options, one per line: code | label')}
                      <textarea
                        required
                        value={q.options?.map((i) => `${i.value} | ${i.label}`).join('\n') ?? ''}
                        onChange={(e) =>
                          change(index, {
                            ...q,
                            options: e.target.value.split('\n').map((line) => {
                              const split = line.indexOf('|');
                              return {
                                value: split < 0 ? line.trim() : line.slice(0, split).trim(),
                                label: split < 0 ? '' : line.slice(split + 1).trim(),
                              };
                            }),
                          })
                        }
                      />
                    </label>
                  )}
                </>
              ) : (
                <p>
                  {t('Nguồn dữ liệu:', 'Data source:')}{' '}
                  {q.kind === 'CATEGORIES'
                    ? t('Danh mục sự kiện', 'Event categories')
                    : q.kind === 'CITY'
                      ? t('Thành phố', 'Cities')
                      : t('Organizer đã duyệt', 'Approved organizers')}
                </p>
              )}
              <Button
                variant="outline"
                type="button"
                disabled={index === 0}
                onClick={() =>
                  setLoaded((current) => {
                    if (!current) return current;
                    const values = [...current.questions];
                    [values[index - 1], values[index]] = [values[index]!, values[index - 1]!];
                    return { ...current, questions: values };
                  })
                }
              >
                {t('Lên', 'Move up')}
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={index === loaded.questions.length - 1}
                onClick={() =>
                  setLoaded((current) => {
                    if (!current) return current;
                    const values = [...current.questions];
                    [values[index], values[index + 1]] = [values[index + 1]!, values[index]!];
                    return { ...current, questions: values };
                  })
                }
              >
                {t('Xuống', 'Move down')}
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  setLoaded((current) =>
                    current
                      ? { ...current, questions: current.questions.filter((_, i) => i !== index) }
                      : null,
                  )
                }
              >
                {t('Bỏ câu hỏi', 'Remove question')}
              </Button>
            </section>
          ))}
          {loaded.questions.length < 20 && (
            <div className="onboarding-admin-add">
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  add({
                    key: 'custom_q' + crypto.randomUUID().replaceAll('-', ''),
                    kind: 'TEXT',
                    label: locale === 'en' ? 'New question' : 'Câu hỏi mới',
                    required: true,
                  })
                }
              >
                <Plus size={16} aria-hidden="true" />
                {t('Thêm câu hỏi', 'Add question')}
              </Button>
              {(
                [
                  {
                    key: 'favoriteCategories',
                    kind: 'CATEGORIES',
                    label: t('Danh mục yêu thích', 'Favorite categories'),
                  },
                  { key: 'preferredCity', kind: 'CITY', label: t('Thành phố', 'City') },
                  {
                    key: 'followedOrganizers',
                    kind: 'ORGANIZERS',
                    label: t('Nhà tổ chức quan tâm', 'Organizers to follow'),
                  },
                ] as const
              )
                .filter((q) => !loaded.questions.some((item) => item.key === q.key))
                .map((q) => (
                  <Button
                    variant="outline"
                    key={q.key}
                    type="button"
                    onClick={() => add({ ...q, required: true })}
                  >
                    {t('Thêm', 'Add')} {q.label.toLowerCase()}
                  </Button>
                ))}
            </div>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="onboarding-admin-alert">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="onboarding-admin-success">
            {notice}
          </p>
        )}
        <Button
          variant="primary"
          type="submit"
          disabled={busy}
          className="onboarding-admin-primary"
        >
          {busy
            ? t('Đang lưu…', 'Saving…')
            : frozen
              ? t('Thử lại cùng yêu cầu', 'Retry same request')
              : t('Xuất bản bộ câu hỏi', 'Publish questionnaire')}
        </Button>
        <Button
          variant="outline"
          type="button"
          disabled={busy || frozen}
          onClick={() => setRetry((v) => v + 1)}
        >
          {t('Tải lại bản hiện hành', 'Reload current version')}
        </Button>
      </form>
    </>
  );
}
