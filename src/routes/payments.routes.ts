import { Router, Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config/env.js';
import { onProxyReqForwardAuth } from '../middleware/auth-forwarder.js';
import { PaymentsService } from '../services/payments.service.js';

export const paymentsRouter = Router();

// Obtener planes disponibles
paymentsRouter.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.authHeader || (req.headers['authorization'] as string);
    const plans = await PaymentsService.findPlans(authHeader);
    res.json(plans);
  } catch (error) {
    next(error);
  }
});

// Suscripción actual del tenant
paymentsRouter.get('/tenants/:slug/subscription', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.authHeader || (req.headers['authorization'] as string);
    const sub = await PaymentsService.findCurrentTenantSubscription(req.params.slug, authHeader);
    res.json(sub);
  } catch (error) {
    next(error);
  }
});

// Crear sesión de checkout
paymentsRouter.post('/tenants/:slug/checkout-sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.authHeader || (req.headers['authorization'] as string);
    const session = await PaymentsService.createInitialCheckoutSession(req.params.slug, req.body.planCode, authHeader);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

// Estado de sesión de checkout
paymentsRouter.get('/checkout-sessions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.authHeader || (req.headers['authorization'] as string);
    const status = await PaymentsService.getCheckoutSessionStatus(req.params.id, authHeader);
    res.json(status);
  } catch (error) {
    next(error);
  }
});

// Pagar suscripción
paymentsRouter.post('/tenants/:slug/payments/pay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.authHeader || (req.headers['authorization'] as string);
    const payment = await PaymentsService.paySubscription(req.params.slug, authHeader);
    res.json(payment);
  } catch (error) {
    next(error);
  }
});

// Proxy transparente para el resto de peticiones al microservicio de pagos
const paymentsProxy = createProxyMiddleware({
  target: config.paymentsServiceUrl,
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/payments': '',
  },
  on: {
    proxyReq: onProxyReqForwardAuth,
  },
});

paymentsRouter.use('/', paymentsProxy);
