import { Router, Request, Response } from 'express';
import { config } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const checkService = async (name: string, url: string, path: string = '') => {
    if (!url) return { status: 'not-configured' as const };
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${url}${path}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      return { status: res.ok || res.status < 500 ? 'up' as const : 'degraded' as const, statusCode: res.status };
    } catch {
      return { status: 'down' as const, error: 'Connection refused or timeout' };
    }
  };

  const [core, springBoot, ia, payments] = await Promise.all([
    checkService('core', config.coreServiceUrl),
    checkService('springBoot', config.springBootServiceUrl, '/api/v1/documents/pdf'),
    checkService('ia', config.aiServiceUrl, '/api/v1/health'),
    checkService('payments', config.paymentsServiceUrl, '/plans'),
  ]);

  const statuses = [core.status, springBoot.status, ia.status, payments.status];
  const gatewayStatus = statuses.includes('down') ? 'degraded' : 'up';
  res.status(gatewayStatus === 'up' ? 200 : 503).json({
    status: gatewayStatus,
    gateway: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      nodeEnv: config.nodeEnv,
      port: config.port,
    },
    services: {
      core: core.status,
      documents: springBoot.status,
      ia: ia.status,
      payments: payments.status,
    },
    downstream: {
      core: { url: config.coreServiceUrl, ...core },
      springBoot: { url: config.springBootServiceUrl, ...springBoot },
      ia: { url: config.aiServiceUrl, ...ia },
      payments: { url: config.paymentsServiceUrl || null, ...payments },
    },
  });
});
