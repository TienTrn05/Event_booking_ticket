import type { RequestHandler } from 'express';
import { requireAppOrigin } from '../../../shared/http/private-request.js';
import { sendData } from '../../../shared/http/response.js';
import { numericId } from '../../../shared/validation/common.schema.js';
import { authenticatedUser } from '../../auth/auth.service.js';
import { attendeesInput, verificationInput } from './attendee.schema.js';
import { getAttendees, saveAttendees, verifyAttendee } from './attendee.service.js';

export function createAttendeeController() {
  const getAttendeesHandler: RequestHandler = async (req, res) => {
    const data = await getAttendees(
      await authenticatedUser(req.get('authorization')),
      numericId.parse(req.params.id),
    );
    sendData(res, data);
  };

  const saveAttendeesHandler: RequestHandler = async (req, res) => {
    requireAppOrigin(req);
    const actor = await authenticatedUser(req.get('authorization'));
    const input = attendeesInput.parse(req.body);
    const data = await saveAttendees(
      actor,
      numericId.parse(req.params.id),
      input.attendees,
      String(res.locals.requestId),
    );
    sendData(res, data);
  };

  const verifyAttendeeHandler: RequestHandler = async (req, res) => {
    requireAppOrigin(req);
    const actor = await authenticatedUser(req.get('authorization'));
    const input = verificationInput.parse(req.body);
    const data = await verifyAttendee(
      actor,
      numericId.parse(req.params.id),
      input,
      String(res.locals.requestId),
    );
    sendData(res, data);
  };
  return {
    getAttendees: getAttendeesHandler,
    saveAttendees: saveAttendeesHandler,
    verifyAttendee: verifyAttendeeHandler,
  };
}
