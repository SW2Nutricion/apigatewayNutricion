import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;
  const hasAuth = Boolean(req.headers['authorization']);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    console.log(
      `[Gateway] ${new Date().toISOString()} | ${method} ${originalUrl} | Status: ${statusCode} | ${duration}ms | AuthForwarded: ${hasAuth}`,
    );
  });

  next();
}
