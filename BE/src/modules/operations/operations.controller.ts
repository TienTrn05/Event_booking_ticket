import type { RequestHandler } from 'express';
import { sendData } from '../../shared/http/response.js';
import { authenticatedUser } from '../auth/auth.service.js';
import { statisticsQuery } from './operations.schema.js';
import { OperationsService } from './operations.service.js';

export function createOperationsController(service = new OperationsService()) {
  const statistics: RequestHandler = async (req, res) => {
    const actor = await authenticatedUser(req.get('authorization'));
    sendData(res, await service.statistics(actor, statisticsQuery.parse(req.query)));
  };
  const health: RequestHandler = async (req, res) => {
    sendData(res, await service.health(await authenticatedUser(req.get('authorization'))));
  };
  return { statistics, health };
}
