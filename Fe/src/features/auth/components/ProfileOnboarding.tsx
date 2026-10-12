import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { ApiError, apiRequest } from '../../../shared/api/client';
import { Link } from 'react-router-dom';
import { QuestionFields } from './QuestionFields';
import { questionnaireSchema, type Answers } from '../schemas/questionnaire.schema';

const stateSchema = z.object({
  data: z.object({
    completed: z.boolean(),
    roles: z.array(z.string()),
    registrationRole: z.enum(['CUSTOMER', 'ORGANIZER']).nullable(),
    favoriteCategories: z.array(z.string()),
    preferredCity: z.string().nullable(),
    followedOrganizers: z.array(z.string()),
    questionnaire: questionnaireSchema.nullable(),
    answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
    profile: z.object({
      displayName: z.string(),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED']).nullable(),
      dateOfBirth: z.string().nullable(),
    }),
  }),
});
const optionsSchema = z.object({
  data: z.object({
    categories: z.array(z.object({ id: z.string(), name: z.string() })),
    cities: z.array(z.object({ id: z.string(), name: z.string() })),
    organizers: z.array(z.object({ id: z.string(), name: z.string() })),
    questionnaire: questionnaireSchema,
  }),
});
type State = z.infer<typeof stateSchema>['data'];
type Options = z.infer<typeof optionsSchema>['data'];
type Props = {
  token: string;
  editing: boolean;
  onClose: () => void;
  onSaved: (name: string) => void;
  onLogout: () => Promise<void>;
};
export function ProfileOnboarding(props: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const [loaded, setLoaded] = useState<{ state: State; options: Options } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const headers = { Authorization: `Bearer ${props.token}` };
    void Promise.all([
      apiRequest('/users/me/onboarding', { headers }),
      apiRequest('/users/me/onboarding/options', { headers }),
    ])
      .then(([state, options]) => {
        if (!cancelled) {
          setLoaded({
            state: stateSchema.parse(state).data,
            options: optionsSchema.parse(options).data,
          });
          setError('');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Chưa tải được hồ sơ. Hãy thử lại.');
      });
    return () => {
      cancelled = true;
    };
  }, [props.token, retry]);
  const visible = !loaded?.state.completed || props.editing;
  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const nodes = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled)',
        ) ?? [],
      );
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialogRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === dialogRef.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [visible]);
  if (loaded?.state.completed && !props.editing) return null;
  return (
    <div className="auth-overlay" style={{ zIndex: 110 }}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        style={{ maxHeight: '90dvh', overflowY: 'auto' }}
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
      >
        <h2 id="profile-title">
          {props.editing ? 'Hồ sơ và sở thích' : 'Bắt đầu trải nghiệm của bạn'}
        </h2>
        {loaded ? (
          <ProfileForm
            key={loaded.state.completed ? 'edit' : 'register'}
            {...props}
            state={loaded.state}
            options={loaded.options}
            onReload={() => setRetry((value) => value + 1)}
            onComplete={(state) => {
              setLoaded({ ...loaded, state });
              props.onSaved(state.profile.displayName);
            }}
          />
        ) : (
          <>
            <p role="status">{error || 'Đang tải hồ sơ…'}</p>
            {error && (
              <button type="button" onClick={() => setRetry(retry + 1)}>
                Thử lại
              </button>
            )}
            <button type="button" onClick={() => void props.onLogout()}>
              Đăng xuất
            </button>
          </>
        )}
      </section>
    </div>
  );
}
function ProfileForm({
  state,
  options,
  onComplete,
  onReload,
  ...props
}: Props & {
  state: State;
  options: Options;
  onComplete: (state: State) => void;
  onReload: () => void;
}) {
  const [step, setStep] = useState(state.completed ? 1 : 0);
  const [role, setRole] = useState<'CUSTOMER' | 'ORGANIZER'>(state.registrationRole ?? 'CUSTOMER');
  const [name, setName] = useState(state.profile.displayName);
  const [gender, setGender] = useState(state.profile.gender ?? '');
  const [dob, setDob] = useState(state.profile.dateOfBirth ?? '');
  const [categories, setCategories] = useState(state.favoriteCategories);
  const [city, setCity] = useState(state.preferredCity ?? '');
  const [following, setFollowing] = useState<string[]>(state.followedOrganizers);
  const [answers, setAnswers] = useState<Answers>(state.answers);
  const questionnaire = state.completed
    ? (state.questionnaire ?? options.questionnaire)
    : options.questionnaire;
  const questions = questionnaire.questions;
  const hasRequired = questions.some((q) => q.required);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [retryPending, setRetryPending] = useState(false);
  const pending = useRef<{ key: string; body: string } | null>(null);
  const headers = { Authorization: `Bearer ${props.token}`, 'Content-Type': 'application/json' };
  const today = new Date().toLocaleDateString('en-CA');
  const mandatory = (
    <>
      <label>
        Tên hiển thị
        <input
          autoFocus
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Giới tính
        <select required value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">Chọn giới tính</option>
          <option value="MALE">Nam</option>
          <option value="FEMALE">Nữ</option>
          <option value="OTHER">Khác</option>
          <option value="UNDISCLOSED">Không muốn tiết lộ</option>
        </select>
      </label>
      <label>
        Ngày sinh
        <input
          required
          type="date"
          max={today}
          value={dob}
          onChange={(e) => setDob(e.target.value)}
        />
      </label>
    </>
  );
  async function save(skip = false) {
    setBusy(true);
    setError('');
    try {
      const customAnswers: Answers = {};
      for (const q of questions) {
        const value = answers[q.key];
        if (
          q.key.startsWith('custom_') &&
          !skip &&
          (Array.isArray(value) ? value.length > 0 : !!value?.trim())
        )
          customAnswers[q.key] = value!;
      }
      if (
        !skip &&
        questions.some(
          (q) =>
            q.required &&
            (!state.completed || q.key.startsWith('custom_')) &&
            !(q.kind === 'CATEGORIES'
              ? categories.length
              : q.kind === 'CITY'
                ? city
                : q.kind === 'ORGANIZERS'
                  ? following.length
                  : customAnswers[q.key]),
        )
      ) {
        setError('Hãy trả lời các câu hỏi có dấu *.');
        return;
      }
      if (!state.completed) {
        const body = JSON.stringify({
          role,
          displayName: name.trim(),
          gender,
          dateOfBirth: dob,
          favoriteCategories:
            skip || !questions.some((q) => q.kind === 'CATEGORIES') ? [] : categories,
          preferredCity: skip || !questions.some((q) => q.kind === 'CITY') ? null : city || null,
          followedOrganizers:
            skip || !questions.some((q) => q.kind === 'ORGANIZERS') ? [] : following,
          questionnaireId: questionnaire.id,
          answers: customAnswers,
        });
        if (!pending.current) {
          pending.current = { key: crypto.randomUUID(), body };
          setRetryPending(true);
        }
        const response = await apiRequest('/users/me/onboarding', {
          method: 'PUT',
          headers: { ...headers, 'Idempotency-Key': pending.current.key },
          body: pending.current.body,
        });
        onComplete(stateSchema.parse(response).data);
      } else {
        await apiRequest('/users/me', {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ displayName: name.trim(), gender, dateOfBirth: dob }),
        });
        for (const id of following.filter((id) => !state.followedOrganizers.includes(id)))
          await apiRequest(`/organizers/${encodeURIComponent(id)}/follow`, {
            method: 'PUT',
            headers,
            body: '{}',
          });
        for (const id of state.followedOrganizers.filter((id) => !following.includes(id)))
          await apiRequest(`/organizers/${encodeURIComponent(id)}/follow`, {
            method: 'DELETE',
            headers,
          });
        await apiRequest('/users/me/preferences', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ favoriteCategories: categories, preferredCity: city || null }),
        });
        const response = await apiRequest('/users/me/onboarding/answers', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ answers: customAnswers }),
        });
        onComplete(stateSchema.parse(response).data);
        props.onClose();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status < 500) {
        pending.current = null;
        setRetryPending(false);
        if (e.code === 'ONBOARDING_QUESTIONNAIRE_CHANGED') {
          setError('Bộ câu hỏi vừa được cập nhật. Hãy kiểm tra các câu hỏi mới rồi lưu lại.');
          onReload();
          return;
        }
        setError(
          e.code === 'ROLE_CHANGE_DURING_BOOKING'
            ? 'Hãy hoàn tất hoặc hủy lượt mua hiện tại trước khi chọn Organizer.'
            : 'Kiểm tra thông tin và thử lại.',
        );
      } else setError('Chưa xác nhận được kết quả. Bấm lưu lại để kiểm tra cùng yêu cầu.');
    } finally {
      setBusy(false);
    }
  }
  async function enableCustomer() {
    setBusy(true);
    setError('');
    try {
      const response = await apiRequest('/users/me/roles/customer', {
        method: 'POST',
        headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
        body: '{}',
      });
      onComplete(stateSchema.parse(response).data);
    } catch {
      setError('Chưa bật được quyền mua vé. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!state.completed && step === 0) setStep(1);
        else void save();
      }}
    >
      <fieldset
        disabled={busy || retryPending}
        style={{ border: 0, padding: 0, display: 'grid', gap: 12 }}
      >
        {!state.completed && step === 0 ? (
          <>
            <p>Bạn muốn tham gia với vai trò nào?</p>
            <label>
              <input
                type="radio"
                name="role"
                checked={role === 'CUSTOMER'}
                onChange={() => setRole('CUSTOMER')}
              />{' '}
              Khách tham dự — khám phá và mua vé
            </label>
            <label>
              <input
                type="radio"
                name="role"
                checked={role === 'ORGANIZER'}
                onChange={() => setRole('ORGANIZER')}
              />{' '}
              Nhà tổ chức — tạo tổ chức và sự kiện nháp
            </label>
            <p>
              Nhà tổ chức có thể bật quyền mua vé sau. Admin duyệt tổ chức và sự kiện trước mở bán.
            </p>
            {mandatory}
          </>
        ) : (
          <>
            {state.completed && mandatory}
            <p>Câu hỏi có dấu * cần trả lời. Bạn có thể sửa câu trả lời trong tài khoản.</p>
            <QuestionFields
              questions={questions}
              answers={answers}
              onAnswer={(key, value) => setAnswers((current) => ({ ...current, [key]: value }))}
              categories={categories}
              onCategories={setCategories}
              city={city}
              onCity={setCity}
              following={following}
              onFollowing={setFollowing}
              options={options}
              editing={state.completed}
            />
          </>
        )}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="auth-submit" disabled={busy}>
        {busy ? 'Đang lưu…' : !state.completed && step === 0 ? 'Tiếp tục' : 'Lưu hồ sơ'}
      </button>
      {!state.completed && step === 1 && (
        <>
          {!hasRequired && (
            <button type="button" disabled={busy || retryPending} onClick={() => void save(true)}>
              Bỏ qua sở thích và hoàn tất
            </button>
          )}
          {!retryPending && (
            <button type="button" disabled={busy} onClick={() => setStep(0)}>
              Quay lại
            </button>
          )}
        </>
      )}
      {state.completed &&
        state.roles.includes('ORGANIZER') &&
        !state.roles.includes('CUSTOMER') && (
          <button type="button" disabled={busy} onClick={() => void enableCustomer()}>
            Bật quyền mua vé Customer
          </button>
        )}
      {state.completed && (
        <>
          {state.roles.includes('ADMIN') && (
            <Link to="/admin/onboarding" onClick={props.onClose}>
              Quản lý câu hỏi đăng ký
            </Link>
          )}
          <button type="button" disabled={busy} onClick={props.onClose}>
            Đóng
          </button>
        </>
      )}
      {!state.completed && (
        <button type="button" disabled={busy} onClick={() => void props.onLogout()}>
          Đăng xuất
        </button>
      )}
    </form>
  );
}
