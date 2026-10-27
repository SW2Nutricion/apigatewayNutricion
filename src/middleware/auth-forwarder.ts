import { Request, Response, NextFunction } from 'express';
import { ClientRequest } from 'http';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      authHeader?: string;
      correlationId?: string;
    }
  }
}

/**
 * Middleware que captura y preserva el header Authorization entrante.
 * Garantiza que la cabecera no sufra transformaciones ni pérdidas.
 */
export function authForwarderMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (typeof auth === 'string' && auth.trim().length > 0) {
    req.authHeader = auth;
  }
  req.correlationId = req.headers['x-correlation-id']?.toString() || crypto.randomUUID();
  next();
}

/**
 * Helper para inyectar de manera segura el header Authorization sin modificar
 * en solicitudes salientes mediante http-proxy-middleware.
 */
export function onProxyReqForwardAuth(proxyReq: ClientRequest, req: Request): void {
  const auth = req.authHeader || req.headers['authorization'] || req.headers['Authorization'];
  if (auth && typeof auth === 'string') {
    proxyReq.setHeader('authorization', auth);
  }
}

export function setInternalHeaders(headers: Record<string, string>, req: Request): Record<string, string> {
  const result = { ...headers };
  if (req.correlationId) result['X-Correlation-Id'] = req.correlationId;
  return result;
}
