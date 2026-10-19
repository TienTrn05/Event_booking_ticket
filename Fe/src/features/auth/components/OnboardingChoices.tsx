import type { ReactNode } from 'react';
import { BookOpen, Check, Compass, Drama, Music2, Sparkles, Trees, Trophy } from 'lucide-react';
import { ExpressiveIcon } from '../../../shared/ui/ExpressiveIcon';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { categoryLabel } from '../../catalog/category-label';
import type { OnboardingOptions } from '../schemas/onboarding.schema';
import type { Question, Answers } from '../schemas/questionnaire.schema';

export function ChoiceCard({
  name,
  value,
  selected,
  multiple = false,
  onChange,
  children,
  detail,
  image,
  className = '',
}: {
  name: string;
  value: string;
  selected: boolean;
  multiple?: boolean;
  onChange: () => void;
  children: ReactNode;
  detail?: string;
  image?: ReactNode;
  className?: string;
}) {
  return (
    <label className={`onboarding-choice ${className}`}>
      <input
        type={multiple ? 'checkbox' : 'radio'}
        name={name}
        value={value}
        checked={selected}
        onChange={onChange}
      />
      <span className="onboarding-choice-body">
        <span className="onboarding-choice-check">
          <Check size={16} />
        </span>
        {image && <span className="onboarding-choice-art">{image}</span>}
        <strong>{children}</strong>
        {detail && <small>{detail}</small>}
      </span>
    </label>
  );
}
const icons = {
  music: Music2,
  sports: Trophy,
  arts: Drama,
  workshops: BookOpen,
  festivals: Trees,
  technology: Sparkles,
};
function toggle(values: string[], id: string, limit: number) {
  return values.includes(id)
    ? values.filter((v) => v !== id)
    : values.length < limit
      ? [...values, id]
      : values;
}
export function OnboardingChoices({
  question,
  options,
  search,
  categories,
  city,
  following,
  noOrganizerYet,
  answers,
  onCategories,
  onCity,
  onFollowing,
  onNone,
  onAnswer,
}: {
  question: Question;
  options: OnboardingOptions;
  search: string;
  categories: string[];
  city: string;
  following: string[];
  noOrganizerYet: boolean;
  answers: Answers;
  onCategories: (values: string[]) => void;
  onCity: (value: string) => void;
  onFollowing: (values: string[]) => void;
  onNone: () => void;
  onAnswer: (key: string, value: string | string[]) => void;
}) {
  const { t, locale } = useLocale();
  const match = (name: string) =>
    name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  if (question.kind === 'TEXT')
    return (
      <label className="onboarding-text-answer">
        {question.label}
        <textarea
          required
          rows={4}
          maxLength={500}
          value={typeof answers[question.key] === 'string' ? answers[question.key] : ''}
          onChange={(e) => onAnswer(question.key, e.target.value)}
        />
      </label>
    );
  if (question.kind === 'CATEGORIES')
    return (
      <div className="onboarding-choices">
        {options.categories.map((item) => (
          <ChoiceCard
            key={item.id}
            name={question.key}
            value={item.id}
            multiple
            selected={categories.includes(item.id)}
            onChange={() => onCategories(toggle(categories, item.id, 10))}
            image={
              <ExpressiveIcon icon={icons[item.id as keyof typeof icons] ?? Sparkles} size={64} />
            }
          >
            {categoryLabel(item.name, item.id, locale)}
          </ChoiceCard>
        ))}
        {!options.categories.length && (
          <p>
            {t(
              'Chưa có danh mục để chọn. Hãy thử tải lại.',
              'No categories available. Please reload.',
            )}
          </p>
        )}
      </div>
    );
  if (question.kind === 'CITY')
    return (
      <div className="onboarding-choices onboarding-places">
        {options.cities
          .filter((item) => match(item.name))
          .map((item) => (
            <ChoiceCard
              key={item.id}
              name={question.key}
              value={item.id}
              selected={city === item.id}
              onChange={() => onCity(item.id)}
              className="onboarding-place"
              image={
                <>
                  <ExpressiveIcon icon={Compass} size={64} />
                  {item.image && (
                    <img
                      src={item.image}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                </>
              }
            >
              {item.name}
            </ChoiceCard>
          ))}
        {!options.cities.some((item) => match(item.name)) && (
          <p>{t('Không tìm thấy thành phố phù hợp.', 'No matching cities.')}</p>
        )}
      </div>
    );
  if (question.kind === 'ORGANIZERS')
    return (
      <>
        <div className="onboarding-choices onboarding-organizers">
          {options.organizers
            .filter((item) => match(item.name))
            .map((item) => (
              <ChoiceCard
                key={item.id}
                name={question.key}
                value={item.id}
                multiple
                selected={following.includes(item.id)}
                onChange={() => onFollowing(toggle(following, item.id, 20))}
                image={
                  <span className="onboarding-avatar">
                    <span>{item.name.slice(0, 2).toUpperCase()}</span>
                    {item.avatar && (
                      <img
                        src={item.avatar}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </span>
                }
              >
                {item.name}
              </ChoiceCard>
            ))}
        </div>
        {!options.organizers.some((item) => match(item.name)) && (
          <p>
            {t(
              'Chưa tìm thấy nhà tổ chức phù hợp. Bạn vẫn có thể chọn bên dưới.',
              'No matching organizers. You can still choose the option below.',
            )}
          </p>
        )}
        <ChoiceCard
          className="onboarding-none"
          name={question.key}
          value="not-yet"
          multiple
          selected={noOrganizerYet}
          onChange={onNone}
          image={<ExpressiveIcon icon={Compass} size={30} />}
        >
          {t('Tôi chưa biết nhà tổ chức nào', 'I have not discovered any organizers yet')}
        </ChoiceCard>
      </>
    );
  const selected = answers[question.key];
  return (
    <div className="onboarding-choices">
      {question.options?.map((item, index) => (
        <ChoiceCard
          key={item.value}
          name={question.key}
          value={item.value}
          multiple={question.kind === 'MULTI_CHOICE'}
          selected={
            Array.isArray(selected) ? selected.includes(item.value) : selected === item.value
          }
          onChange={() =>
            onAnswer(
              question.key,
              question.kind === 'MULTI_CHOICE'
                ? toggle(Array.isArray(selected) ? selected : [], item.value, 20)
                : item.value,
            )
          }
          image={
            <span className="onboarding-option-number">{String(index + 1).padStart(2, '0')}</span>
          }
        >
          {item.label}
        </ChoiceCard>
      ))}
    </div>
  );
}
