import { AppError } from '../../../shared/errors/app-error.js';
import { calendarDate } from '../../../shared/validation/common.schema.js';
export function ageAtDate(dateOfBirth: string, referenceDate: string) {
  calendarDate.parse(dateOfBirth);
  calendarDate.parse(referenceDate);
  if (dateOfBirth > referenceDate)
    throw new AppError(400, 'INVALID_DATE_OF_BIRTH', 'Ngày sinh không hợp lệ.');
  const years = Number(referenceDate.slice(0, 4)) - Number(dateOfBirth.slice(0, 4));
  return years - (referenceDate.slice(5) < dateOfBirth.slice(5) ? 1 : 0);
}
export function checkMinimumAge(
  dateOfBirth: string,
  referenceDate: string,
  minimumAge: number | null,
) {
  const age = ageAtDate(dateOfBirth, referenceDate);
  return {
    ageAtSession: age,
    minimumAge,
    ageTag: minimumAge === null ? null : `${minimumAge}+`,
    eligible: minimumAge === null || age >= minimumAge,
  };
}
