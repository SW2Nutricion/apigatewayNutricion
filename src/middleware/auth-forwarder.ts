import { Request, Response, NextFunction } from 'express';
import { ClientRequest } from 'http';

declare global {
  namespace Express {
    interface Request {
      authHeader?: string;
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
