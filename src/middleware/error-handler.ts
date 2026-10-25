import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Error interno en el API Gateway';

  console.error(`[Gateway Error] Status ${status}:`, err);

  res.status(status).json({
    success: false,
    statusCode: status,
    error: message,
    timestamp: new Date().toISOString(),
  });
}
