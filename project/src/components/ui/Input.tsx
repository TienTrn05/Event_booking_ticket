import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  label?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, label, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-ink-500 mb-1.5 uppercase tracking-wide">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full h-12 rounded-xl border border-ink-200 bg-white text-ink-900 placeholder:text-ink-400 transition-all duration-200 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 ${icon ? 'pl-11 pr-4' : 'px-4'} ${className}`}
            {...props}
          />
        </div>
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
