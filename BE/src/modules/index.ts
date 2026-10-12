import type { Express } from 'express';

import { createCatalogRouter } from './catalog/catalog.routes.js';

import { createAuthRouter } from './auth/auth.routes.js';
import { createBookingRouter } from './bookings/booking.routes.js';
import { requireRoomAdmission } from './bookings/waiting-room/waiting-room.repository.js';
import type { CatalogRepository } from './catalog/catalog.repository.js';
import { createAgeRouter } from './events/age/age.routes.js';
import { createEventManagementRouter } from './events/management/event-management.routes.js';
import { createMediaRouter } from './media/http/media.routes.js';
import { createNotificationsRouter } from './notifications/http/notifications.routes.js';
import { createAttendeeRouter } from './tickets/attendees/attendee.routes.js';
import { createUsersRouter } from './users/http/users.routes.js';
import { createOnboardingRouter } from './users/onboarding/onboarding.routes.js';
import { createRecommendationRouter } from './catalog/recommendations/recommendation.routes.js';
import { createOrganizationRouter } from './organizations/organization.routes.js';
import { createPaymentRouter } from './payments/payment.routes.js';
import { createTicketRouter } from './tickets/ticket.routes.js';
import { createRefundRouter } from './refunds/refund.routes.js';
import { createFeedbackRouter } from './feedback/feedback.routes.js';
import { createCommerceServices } from '../startup/payment.dependencies.js';
import type { PaymentGateway, TicketIssuer } from './payments/application/payment.ports.js';

export interface ModuleDependencies {
  catalogRepository?: CatalogRepository;
  paymentGateway?: PaymentGateway;
  ticketIssuer?: TicketIssuer;
}

export function registerModules(app: Express, deps: ModuleDependencies) {
  const commerce = createCommerceServices(deps.paymentGateway, deps.ticketIssuer);
  app.use('/api/v1', createRefundRouter());
  app.use('/api/v1', createFeedbackRouter());
  app.use('/api/v1', createPaymentRouter(commerce.payments));
  app.use('/api/v1', createTicketRouter(commerce.tickets));
  app.use('/api/v1/auth', createAuthRouter());
  app.use('/api/v1/media', createMediaRouter());
  app.use('/api/v1/users', createUsersRouter());
  app.use('/api/v1', createOnboardingRouter());
  app.use('/api/v1', createRecommendationRouter());
  app.use('/api/v1', createOrganizationRouter());
  app.use('/api/v1', createNotificationsRouter());
  app.use('/api/v1', createAgeRouter());
  app.use('/api/v1', createEventManagementRouter());
  app.use('/api/v1', createAttendeeRouter());
  app.use(
    '/api/v1',
    createBookingRouter((_req, actor, _publicId, sessionId) =>
      requireRoomAdmission(sessionId, actor.id),
    ),
  );
  if (deps.catalogRepository) {
    app.use('/api/v1', createCatalogRouter(deps.catalogRepository));
  }
}
