import { useSyncExternalStore } from 'react';

import { isMotionReduced, subscribeMotion } from './preference';

/** Track preference changes while the page is open as well as at mount. */
export function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, isMotionReduced, () => false);
}
