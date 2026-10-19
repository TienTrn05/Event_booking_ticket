export type MotionPreference = 'full' | 'reduced' | 'system';

export const MOTION_STORAGE_KEY = 'event-ticketing.motion';
let preference: MotionPreference = 'full';
const listeners = new Set<() => void>();

function parsePreference(value: string | null): MotionPreference {
  return value === 'reduced' || value === 'system' ? value : 'full';
}

function applyMotion() {
  const reduced =
    preference === 'reduced' ||
    (preference === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
  for (const listener of listeners) listener();
}

export function getMotionPreference() {
  return preference;
}

export function isMotionReduced() {
  return document.documentElement.dataset.motion === 'reduced';
}

export function subscribeMotion(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setMotionPreference(value: MotionPreference) {
  preference = value;
  try {
    localStorage.setItem(MOTION_STORAGE_KEY, value);
  } catch {
    // The choice still applies when storage is unavailable.
  }
  applyMotion();
}

/** Application lifetime subscriptions; run once before React mounts. */
export function initializeMotion() {
  try {
    preference = parsePreference(localStorage.getItem(MOTION_STORAGE_KEY));
  } catch {
    preference = 'full';
  }
  applyMotion();
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyMotion);
  window.addEventListener('storage', (event) => {
    if (event.key === MOTION_STORAGE_KEY || event.key === null) {
      preference = parsePreference(event.newValue);
      applyMotion();
    }
  });
}
