import { ui } from '../styles/classes';
interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

export default function Avatar({ src, alt, size = 'md', className = '' }: AvatarProps) {
  const initials = alt
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={ui(
        `inline-flex items-center justify-center rounded-full bg-primary-100 text-primary-700 font-semibold overflow-hidden flex-shrink-0 ${sizeStyles[size]} ${className}`,
      )}
    >
      {src ? <img src={src} alt={alt} className="w-full h-full object-cover" /> : initials}
    </div>
  );
}
