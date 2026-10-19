import { useAuthMessages } from '../../../shared/i18n/authMessages';
import type { Question, Answers } from '../schemas/questionnaire.schema';
export function QuestionFields({
  questions,
  answers,
  onAnswer,
  categories,
  onCategories,
  city,
  onCity,
  following,
  onFollowing,
  options,
  editing,
}: {
  questions: Question[];
  answers: Answers;
  onAnswer: (key: string, value: string | string[]) => void;
  categories: string[];
  onCategories: (values: string[]) => void;
  city: string;
  onCity: (value: string) => void;
  following: string[];
  onFollowing: (values: string[]) => void;
  options: {
    categories: { id: string; name: string }[];
    cities: { id: string; name: string }[];
    organizers: { id: string; name: string }[];
  };
  editing: boolean;
}) {
  const text = useAuthMessages();
  return (
    <>
      {questions.map((q) => {
        const label = q.label + (q.required ? ' *' : '');
        if (q.kind === 'CITY')
          return (
            <label key={q.key}>
              {label}
              <select
                required={q.required && !editing}
                value={city}
                onChange={(e) => onCity(e.target.value)}
              >
                <option value="">{text('Chưa chọn')}</option>
                {options.cities.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
          );
        if (q.kind === 'CATEGORIES' || q.kind === 'ORGANIZERS') {
          const list = q.kind === 'CATEGORIES' ? options.categories : options.organizers,
            selected = q.kind === 'CATEGORIES' ? categories : following,
            change = q.kind === 'CATEGORIES' ? onCategories : onFollowing,
            max = q.kind === 'CATEGORIES' ? 10 : 20;
          return (
            <fieldset key={q.key}>
              <legend>{label}</legend>
              {list.map((i) => (
                <label key={i.id} style={{ display: 'block' }}>
                  <input
                    type="checkbox"
                    checked={selected.includes(i.id)}
                    disabled={!selected.includes(i.id) && selected.length >= max}
                    onChange={(e) =>
                      change(
                        e.target.checked
                          ? [...selected, i.id]
                          : selected.filter((id) => id !== i.id),
                      )
                    }
                  />
                  {i.name}
                </label>
              ))}
            </fieldset>
          );
        }
        if (q.kind === 'TEXT')
          return (
            <label key={q.key}>
              {label}
              <input
                required={q.required}
                maxLength={500}
                value={typeof answers[q.key] === 'string' ? answers[q.key] : ''}
                onChange={(e) => onAnswer(q.key, e.target.value)}
              />
            </label>
          );
        if (q.kind === 'SINGLE_CHOICE')
          return (
            <label key={q.key}>
              {label}
              <select
                required={q.required}
                value={typeof answers[q.key] === 'string' ? answers[q.key] : ''}
                onChange={(e) => onAnswer(q.key, e.target.value)}
              >
                <option value="">{text('Chưa chọn')}</option>
                {q.options?.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </label>
          );
        const selected = Array.isArray(answers[q.key]) ? (answers[q.key] as string[]) : [];
        return (
          <fieldset key={q.key}>
            <legend>{label}</legend>
            {q.options?.map((i) => (
              <label key={i.value} style={{ display: 'block' }}>
                <input
                  type="checkbox"
                  checked={selected.includes(i.value)}
                  onChange={(e) =>
                    onAnswer(
                      q.key,
                      e.target.checked
                        ? [...selected, i.value]
                        : selected.filter((v) => v !== i.value),
                    )
                  }
                />
                {i.label}
              </label>
            ))}
          </fieldset>
        );
      })}
    </>
  );
}
