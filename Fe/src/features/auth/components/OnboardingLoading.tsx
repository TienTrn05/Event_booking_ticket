import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** Keep the app inaccessible while the onboarding chunk itself is being loaded. */
export function OnboardingLoading({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = document.getElementById('root');
    const wasInert = root?.inert ?? false;
    const overflow = document.body.style.overflow;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (root) root.inert = true;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      if (root) root.inert = wasInert;
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        display: 'grid',
        placeItems: 'center',
        background: 'var(--page)',
        color: 'var(--text)',
      }}
    >
      {message}
    </div>,
    document.body,
  );
}
