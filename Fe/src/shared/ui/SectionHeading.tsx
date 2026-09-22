import { ui } from '../styles/classes';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';

export function SectionHeading({
  eyebrow,
  title,
  description,
  to,
  linkText = 'Xem tất cả',
}: {
  eyebrow: string;
  title: string;
  description?: string;
  to?: string;
  linkText?: string;
}) {
  return (
    <div className={ui('section-heading')}>
      <div>
        <span className={ui('eyebrow')}>{eyebrow}</span>
        <h2>{title}</h2>
        {description && <p className={ui('section-intro')}>{description}</p>}
      </div>
      {to && (
        <Link className={ui('text-link')} to={to}>
          {linkText}
          <Icon name="arrow" />
        </Link>
      )}
    </div>
  );
}
