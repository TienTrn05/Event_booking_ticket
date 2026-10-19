import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Compass, LogOut, Search, Ticket } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { ExpressiveIcon } from '../../../shared/ui/ExpressiveIcon';
import { ApiError, apiRequest } from '../../../shared/api/client';
import {
  onboardingStateSchema,
  type OnboardingState,
  type OnboardingOptions,
} from '../schemas/onboarding.schema';
import type { Answers, Question } from '../schemas/questionnaire.schema';
import { ChoiceCard, OnboardingChoices } from './OnboardingChoices';
import './onboarding.css';

const defaultHeadings: Record<string, [string, string, string]> = {
  favoriteCategories: [
    'Danh mục yêu thích',
    'Bạn thích những trải nghiệm nào?',
    'Which experiences excite you?',
  ],
  preferredCity: [
    'Thành phố',
    'Bạn muốn khám phá sự kiện ở đâu?',
    'Where would you like to explore?',
  ],
  followedOrganizers: [
    'Nhà tổ chức quan tâm',
    'Bạn muốn theo dõi nhà tổ chức nào?',
    'Which organizers would you like to follow?',
  ],
};

export function RegistrationWizard({
  state,
  options,
  token,
  onComplete,
  onReload,
  onLogout,
}: {
  state: OnboardingState;
  options: OnboardingOptions;
  token: string;
  onComplete: (state: OnboardingState) => void;
  onReload: () => void;
  onLogout: () => Promise<void>;
}) {
  const { t } = useLocale();
  const navigate = useNavigate(),
    location = useLocation();
  const [step, setStep] = useState(0),
    [search, setSearch] = useState('');
  const [role, setRole] = useState<'CUSTOMER' | 'ORGANIZER' | ''>(state.registrationRole ?? '');
  const [name, setName] = useState(state.profile.displayName);
  const [gender, setGender] = useState(state.profile.gender ?? '');
  const [dob, setDob] = useState(state.profile.dateOfBirth ?? '');
  const [categories, setCategories] = useState(state.favoriteCategories);
  const [city, setCity] = useState(state.preferredCity ?? '');
  const [following, setFollowing] = useState(state.followedOrganizers);
  const [noOrganizerYet, setNoOrganizerYet] = useState(false);
  const [answers, setAnswers] = useState<Answers>(state.answers);
  const [busy, setBusy] = useState(false),
    [frozen, setFrozen] = useState(false),
    [error, setError] = useState('');
  const pending = useRef<{ key: string; body: string; uncertain: boolean } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const questions = options.questionnaire.questions;
  const total = questions.length + 2,
    current = Math.min(step, total - 1);
  const question = current >= 2 ? questions[current - 2] : undefined;
  const today = new Date().toLocaleDateString('en-CA');
  useEffect(() => {
    heading.current?.focus();
  }, [current]);
  const validation = (index: number) => {
    if (index === 0)
      return role
        ? ''
        : t('Hãy chọn cách bạn muốn tham gia Eventix.', 'Choose how you want to join Eventix.');
    if (index === 1)
      return name.trim() && gender && dob && dob <= today
        ? ''
        : t(
            'Hãy điền tên, giới tính và ngày sinh hợp lệ.',
            'Enter your name, gender and a valid date of birth.',
          );
    const q = questions[index - 2];
    if (!q) return '';
    const value =
      q.kind === 'CATEGORIES'
        ? categories.length
        : q.kind === 'CITY'
          ? city
          : q.kind === 'ORGANIZERS'
            ? following.length || noOrganizerYet
            : answers[q.key];
    return (
      Array.isArray(value) ? value.length > 0 : typeof value === 'string' ? !!value.trim() : !!value
    )
      ? ''
      : t('Hãy trả lời câu hỏi này để tiếp tục.', 'Answer this question to continue.');
  };
  const move = (index: number) => {
    setStep(index);
    setSearch('');
    setError('');
  };
  async function submit() {
    if (busy) return;
    if (!pending.current) {
      for (let index = 0; index <= current; index++) {
        const message = validation(index);
        if (message) {
          move(index);
          setError(message);
          return;
        }
      }
      if (current < total - 1) {
        move(current + 1);
        return;
      }
      const available = (kind: Question['kind']) => questions.some((q) => q.kind === kind);
      pending.current = {
        key: crypto.randomUUID(),
        uncertain: false,
        body: JSON.stringify({
          role,
          displayName: name.trim(),
          gender,
          dateOfBirth: dob,
          favoriteCategories: available('CATEGORIES') ? categories : [],
          preferredCity: available('CITY') ? city || null : null,
          followedOrganizers: available('ORGANIZERS') ? following : [],
          noOrganizerYet: available('ORGANIZERS') && noOrganizerYet,
          questionnaireId: options.questionnaire.id,
          answers: Object.fromEntries(
            questions
              .filter((q) => q.key.startsWith('custom_'))
              .map((q) => [q.key, answers[q.key]]),
          ),
        }),
      };
    }
    setBusy(true);
    setFrozen(true);
    setError('');
    try {
      const response = await apiRequest('/users/me/onboarding', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': pending.current.key,
        },
        body: pending.current.body,
      });
      const completed = onboardingStateSchema.parse(response).data;
      onComplete(completed);
      if (completed.registrationRole === 'ORGANIZER') void navigate('/organizer');
      else if (['/', '/login', '/register'].includes(location.pathname)) void navigate('/for-you');
    } catch (e) {
      if (e instanceof ApiError && e.status < 500 && !pending.current.uncertain) {
        pending.current = null;
        setFrozen(false);
        if (e.code === 'ONBOARDING_QUESTIONNAIRE_CHANGED') {
          move(0);
          onReload();
          setError(
            t(
              'Bộ câu hỏi vừa thay đổi. Câu trả lời đang nhập được giữ lại; hãy kiểm tra và tiếp tục.',
              'Questions have changed. Your draft is kept; please review and continue.',
            ),
          );
        } else
          setError(
            t(
              'Chưa lưu được. Kiểm tra câu trả lời và thử lại.',
              'Unable to save. Check your answers and try again.',
            ),
          );
      } else {
        pending.current.uncertain = true;
        setError(
          t(
            'Chưa xác nhận được kết quả. Thử lưu lại để kiểm tra cùng yêu cầu.',
            'The result is not confirmed. Retry saving the same request.',
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  }
  const defaultHeading = question && defaultHeadings[question.key];
  const titles = question
    ? defaultHeading && question.label === defaultHeading[0]
      ? [defaultHeading[1], defaultHeading[2]]
      : [question.label, question.label]
    : current === 0
      ? ['Bạn đến Eventix để làm gì?', 'What brings you to Eventix?']
      : ['Chúng mình nên gọi bạn là gì?', 'What should we call you?'];
  const description =
    current === 0
      ? t(
          'Mỗi trải nghiệm bắt đầu bằng một lựa chọn của bạn.',
          'Every experience starts with your choice.',
        )
      : current === 1
        ? t(
            'Một chút thông tin để bắt đầu hành trình cùng nhau.',
            'A little about you before the adventure begins.',
          )
        : question?.kind === 'CATEGORIES'
          ? t(
              'Chọn những điều khiến bạn hào hứng. Tối đa 10 danh mục.',
              'Choose what excites you. Up to 10 categories.',
            )
          : question?.kind === 'CITY'
            ? t(
                'Bạn muốn khám phá sự kiện ở đâu? Chọn một thành phố.',
                'Where would you like to discover events? Choose one city.',
              )
            : question?.kind === 'ORGANIZERS'
              ? t(
                  'Theo dõi để khám phá hoạt động mở bán của họ. Tối đa 20 nhà tổ chức.',
                  'Follow their upcoming announcements. Up to 20 organizers.',
                )
              : t('Một lựa chọn nữa để hiểu bạn hơn.', 'One more answer to get to know you.');
  const count =
    question?.kind === 'CATEGORIES'
      ? categories.length
      : question?.kind === 'ORGANIZERS'
        ? following.length
        : null;
  return (
    <form
      className="onboarding-wizard"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <header className="onboarding-topbar">
        <span className="onboarding-wordmark">
          <ExpressiveIcon icon={Ticket} size={25} />
          Eventix
        </span>
        <div className="onboarding-progress">
          <span>
            {t('Bước', 'Step')} {current + 1}/{total}
          </span>
          <progress
            aria-label={t('Tiến trình đăng ký', 'Registration progress')}
            value={current + 1}
            max={total}
          />
        </div>
        <button
          type="button"
          className="onboarding-exit"
          onClick={() => void onLogout()}
          disabled={busy}
        >
          <LogOut size={17} />
          <span>{t('Đăng xuất', 'Sign out')}</span>
        </button>
      </header>
      <main className="onboarding-content">
        <div className="onboarding-heading">
          <span className="onboarding-eyebrow">
            {t('HÀNH TRÌNH CỦA BẠN', 'YOUR NEXT EXPERIENCE')}
          </span>
          <h1 ref={heading} tabIndex={-1}>
            {t(titles[0]!, titles[1]!)}
          </h1>
          <p>{description}</p>
        </div>
        <fieldset className="onboarding-step" key={current} disabled={busy || frozen}>
          <legend className="sr-only">{t(titles[0]!, titles[1]!)}</legend>
          {current === 0 ? (
            <div className="onboarding-choices onboarding-role-choices">
              <ChoiceCard
                name="registration-role"
                value="CUSTOMER"
                selected={role === 'CUSTOMER'}
                onChange={() => setRole('CUSTOMER')}
                image={<ExpressiveIcon icon={Compass} size={96} />}
                detail={t(
                  'Tìm trải nghiệm mới, đặt vé và tận hưởng khoảnh khắc.',
                  'Discover experiences, book tickets and make memories.',
                )}
              >
                {t('Khám phá & mua vé', 'Discover & attend')}
              </ChoiceCard>
              <ChoiceCard
                name="registration-role"
                value="ORGANIZER"
                selected={role === 'ORGANIZER'}
                onChange={() => setRole('ORGANIZER')}
                image={<ExpressiveIcon icon={CalendarDays} size={96} />}
                detail={t(
                  'Tạo tổ chức, chuẩn bị sự kiện và kết nối khán giả.',
                  'Create an organization, prepare events and connect with audiences.',
                )}
              >
                {t('Tổ chức sự kiện', 'Organize events')}
              </ChoiceCard>
            </div>
          ) : current === 1 ? (
            <div className="onboarding-profile">
              <span className="onboarding-profile-art">
                <ExpressiveIcon icon={Ticket} size={110} />
              </span>
              <label>
                {t('Tên hiển thị', 'Display name')}
                <input
                  required
                  autoComplete="nickname"
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                {t('Giới tính', 'Gender')}
                <select required value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">{t('Chọn giới tính', 'Choose gender')}</option>
                  <option value="MALE">{t('Nam', 'Male')}</option>
                  <option value="FEMALE">{t('Nữ', 'Female')}</option>
                  <option value="OTHER">{t('Khác', 'Other')}</option>
                  <option value="UNDISCLOSED">
                    {t('Không muốn tiết lộ', 'Prefer not to say')}
                  </option>
                </select>
              </label>
              <label>
                {t('Ngày sinh', 'Date of birth')}
                <input
                  required
                  type="date"
                  max={today}
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </label>
            </div>
          ) : (
            question && (
              <>
                {(question.kind === 'CITY' || question.kind === 'ORGANIZERS') && (
                  <label className="onboarding-search">
                    <Search size={19} />
                    <span className="sr-only">{t('Tìm lựa chọn', 'Search choices')}</span>
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('Tìm kiếm theo tên…', 'Search by name…')}
                    />
                  </label>
                )}
                {count !== null && (
                  <p className="onboarding-selection-count" role="status">
                    {t('Đã chọn', 'Selected')}: {count}
                  </p>
                )}
                <OnboardingChoices
                  question={question}
                  options={options}
                  search={search}
                  categories={categories}
                  city={city}
                  following={following}
                  noOrganizerYet={noOrganizerYet}
                  answers={answers}
                  onCategories={setCategories}
                  onCity={setCity}
                  onFollowing={(values) => {
                    setFollowing(values);
                    setNoOrganizerYet(false);
                  }}
                  onNone={() => {
                    setNoOrganizerYet(!noOrganizerYet);
                    setFollowing([]);
                  }}
                  onAnswer={(key, value) =>
                    setAnswers((currentAnswers) => ({ ...currentAnswers, [key]: value }))
                  }
                />
              </>
            )
          )}
        </fieldset>
      </main>
      <footer className="onboarding-bottom">
        <div className="onboarding-bottom-inner">
          {error && (
            <p className="onboarding-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="onboarding-back"
            type="button"
            disabled={current === 0 || busy || frozen}
            onClick={() => move(current - 1)}
          >
            <ArrowLeft size={18} />
            {t('Quay lại', 'Back')}
          </button>
          <span className="onboarding-footer-note">
            {t('Hoàn tất các bước để bắt đầu.', 'Complete each step to get started.')}
          </span>
          <button className="onboarding-next" type="submit" disabled={busy}>
            {busy
              ? t('Đang lưu…', 'Saving…')
              : frozen
                ? t('Thử lưu lại', 'Retry saving')
                : current === total - 1
                  ? t('Bắt đầu khám phá', 'Start exploring')
                  : t('Tiếp tục', 'Continue')}
            <ArrowRight size={18} />
          </button>
        </div>
      </footer>
    </form>
  );
}
