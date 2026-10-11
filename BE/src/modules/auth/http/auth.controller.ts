import { createGoogleController } from '../google/google.controller.js';
import { createOtpController } from '../otp/otp.controller.js';
import { createSessionController } from '../session/session.controller.js';
export function createAuthController() {
  return {
    ...createGoogleController(),
    ...createOtpController(),
    ...createSessionController(),
  };
}
