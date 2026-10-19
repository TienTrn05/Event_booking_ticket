import { isMotionReduced } from './preference';

let frame: number | undefined;
let stopListening: (() => void) | undefined;

function stopSmoothScroll() {
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = undefined;
  stopListening?.();
  stopListening = undefined;
}

/** A visible, consistent page glide; native smooth scrolling varies too much by browser. */
function scrollToPosition(target: number) {
  stopSmoothScroll();
  if (isMotionReduced()) {
    window.scrollTo({ top: target, behavior: 'instant' });
    return;
  }
  const start = window.scrollY;
  const distance = target - start;
  if (Math.abs(distance) < 2) {
    window.scrollTo({ top: target, behavior: 'instant' });
    return;
  }

  const duration = Math.min(1150, Math.max(650, Math.abs(distance) * 0.16));
  const startedAt = performance.now();
  const controller = new AbortController();
  const stop = () => stopSmoothScroll();
  window.addEventListener('wheel', stop, { passive: true, signal: controller.signal });
  window.addEventListener('touchstart', stop, { passive: true, signal: controller.signal });
  window.addEventListener('keydown', stop, { signal: controller.signal });
  stopListening = () => controller.abort();

  const tick = (now: number) => {
    if (isMotionReduced()) {
      window.scrollTo({ top: target, behavior: 'instant' });
      stopSmoothScroll();
      return;
    }
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased =
      progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    window.scrollTo({ top: start + distance * eased, behavior: 'instant' });
    if (progress < 1) frame = requestAnimationFrame(tick);
    else stopSmoothScroll();
  };
  frame = requestAnimationFrame(tick);
}

export function scrollToElement(
  element: HTMLElement,
  offset = window.matchMedia('(min-width: 1024px)').matches ? 24 : 80,
) {
  const documentEnd = document.documentElement.scrollHeight - window.innerHeight;
  scrollToPosition(
    Math.max(
      0,
      Math.min(documentEnd, element.getBoundingClientRect().top + window.scrollY - offset),
    ),
  );
}

export function scrollToHash(hash: string) {
  const target = document.getElementById(hash.replace(/^#/, ''));
  if (target) scrollToElement(target);
}
export function scrollToTop() {
  scrollToPosition(0);
}
