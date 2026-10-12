import { useEffect, useRef, useState } from 'react';
import { useAuthDialog } from '../context/AuthDialogContext';
import { ApiError, apiRequest } from '../../../shared/api/client';
import { questionnaireSchema, type Question } from '../schemas/questionnaire.schema';
import { z } from 'zod';
const schema = z.object({ data: questionnaireSchema });
export function OnboardingAdminPage() {
  const { accessToken, openAuth } = useAuthDialog();
  return (
    <main id="main" className="container content-page">
      <h1>Câu hỏi đăng ký</h1>
      {accessToken ? (
        <Editor key={accessToken} token={accessToken} />
      ) : (
        <button type="button" onClick={() => openAuth('login')}>
          Đăng nhập Admin
        </button>
      )}
    </main>
  );
}
function Editor({ token }: { token: string }) {
  const [loaded, setLoaded] = useState<{ id: string; questions: Question[] } | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [retry, setRetry] = useState(0),
    [frozen, setFrozen] = useState(false);
  const pending = useRef<{ key: string; body: string } | null>(null);
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
              ? 'Bạn không có quyền quản lý câu hỏi.'
              : 'Chưa tải được bộ câu hỏi.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [token, retry]);
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
    try {
      if (!pending.current)
        pending.current = {
          key: crypto.randomUUID(),
          body: JSON.stringify({ questionnaireId: loaded.id, questions: loaded.questions }),
        };
      setFrozen(true);
      const result = await apiRequest('/admin/onboarding/questions', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': pending.current.key,
        },
        body: pending.current.body,
      });
      setLoaded(schema.parse(result).data);
      setNotice('Đã xuất bản bộ câu hỏi mới. Tài khoản đã hoàn tất giữ câu trả lời cũ.');
      pending.current = null;
      setFrozen(false);
    } catch (e) {
      if (e instanceof ApiError && e.status < 500) {
        pending.current = null;
        setFrozen(false);
        setError(
          e.code === 'ONBOARDING_QUESTIONNAIRE_CHANGED'
            ? 'Admin khác vừa cập nhật. Hãy tải lại rồi sửa.'
            : 'Cấu hình chưa hợp lệ hoặc bạn không có quyền lưu.',
        );
      } else setError('Chưa xác nhận được kết quả. Bấm xuất bản lại với cùng yêu cầu.');
    } finally {
      setBusy(false);
    }
  }
  if (!loaded)
    return (
      <>
        <p role="status">{error || 'Đang tải…'}</p>
        {error && <button onClick={() => setRetry((v) => v + 1)}>Thử lại</button>}
      </>
    );
  return (
    <>
      <p>Bốn trường luôn bắt buộc: vai trò, tên hiển thị, giới tính, ngày sinh.</p>
      <p>
        Thay đổi dưới đây áp dụng cho lượt đăng ký chưa hoàn tất. Phiên bản và câu trả lời trước
        được giữ.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void publish();
        }}
      >
        <fieldset disabled={busy || frozen} style={{ border: 0, padding: 0 }}>
          {loaded.questions.map((q, index) => (
            <section
              key={q.key}
              style={{ border: '1px solid #cbd5e1', padding: 16, marginBottom: 12 }}
            >
              <label>
                Nội dung câu hỏi
                <input
                  required
                  maxLength={160}
                  value={q.label}
                  onChange={(e) => change(index, { ...q, label: e.target.value })}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => change(index, { ...q, required: e.target.checked })}
                />{' '}
                Bắt buộc trả lời
              </label>
              {q.key.startsWith('custom_') ? (
                <>
                  <label>
                    Kiểu trả lời
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
                      <option value="TEXT">Văn bản ngắn</option>
                      <option value="SINGLE_CHOICE">Chọn một</option>
                      <option value="MULTI_CHOICE">Chọn nhiều</option>
                    </select>
                  </label>
                  {q.kind !== 'TEXT' && (
                    <label>
                      Lựa chọn, mỗi dòng: mã | nhãn
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
                  Nguồn dữ liệu:{' '}
                  {q.kind === 'CATEGORIES'
                    ? 'Danh mục sự kiện'
                    : q.kind === 'CITY'
                      ? 'Thành phố'
                      : 'Organizer đã duyệt'}
                </p>
              )}
              <button
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
                Lên
              </button>
              <button
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
                Xuống
              </button>
              <button
                type="button"
                onClick={() =>
                  setLoaded((current) =>
                    current
                      ? { ...current, questions: current.questions.filter((_, i) => i !== index) }
                      : null,
                  )
                }
              >
                Bỏ câu hỏi
              </button>
            </section>
          ))}
          {loaded.questions.length < 20 && (
            <div>
              <button
                type="button"
                onClick={() =>
                  add({
                    key: 'custom_q' + crypto.randomUUID().replaceAll('-', ''),
                    kind: 'TEXT',
                    label: 'Câu hỏi mới',
                    required: false,
                  })
                }
              >
                Thêm câu hỏi
              </button>
              {(
                [
                  { key: 'favoriteCategories', kind: 'CATEGORIES', label: 'Danh mục yêu thích' },
                  { key: 'preferredCity', kind: 'CITY', label: 'Thành phố' },
                  { key: 'followedOrganizers', kind: 'ORGANIZERS', label: 'Nhà tổ chức quan tâm' },
                ] as const
              )
                .filter((q) => !loaded.questions.some((item) => item.key === q.key))
                .map((q) => (
                  <button key={q.key} type="button" onClick={() => add({ ...q, required: false })}>
                    Thêm {q.label.toLowerCase()}
                  </button>
                ))}
            </div>
          )}
        </fieldset>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Xuất bản bộ câu hỏi'}
        </button>
        <button type="button" disabled={busy || frozen} onClick={() => setRetry((v) => v + 1)}>
          Tải lại bản hiện hành
        </button>
      </form>
    </>
  );
}
