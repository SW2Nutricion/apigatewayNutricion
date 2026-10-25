import { Router, Request, Response } from 'express';
import { config } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const checkService = async (name: string, url: string, path: string = '') => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${url}${path}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      return { status: res.ok || res.status < 500 ? 'UP' : 'DEGRADED', statusCode: res.status };
    } catch {
      return { status: 'DOWN', error: 'Connection refused or timeout' };
    }
  };

  const [core, springBoot, ia, payments] = await Promise.all([
    checkService('core', config.coreServiceUrl),
    checkService('springBoot', config.springBootServiceUrl, '/api/v1/documents/pdf'),
    checkService('ia', config.aiServiceUrl, '/api/v1/health'),
    checkService('payments', config.paymentsServiceUrl, '/plans'),
  ]);

  res.json({
    status: 'UP',
    gateway: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      nodeEnv: config.nodeEnv,
      port: config.port,
    },
    downstream: {
      core: { url: config.coreServiceUrl, ...core },
      springBoot: { url: config.springBootServiceUrl, ...springBoot },
      ia: { url: config.aiServiceUrl, ...ia },
      payments: { url: config.paymentsServiceUrl, ...payments },
    },
  });
});
