import { Router, Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config/env.js';
import { onProxyReqForwardAuth } from '../middleware/auth-forwarder.js';
import { AiService } from '../services/ai.service.js';

export const iaRouter = Router();

// Orquestación: Segmentación de pacientes del tenant autenticado
iaRouter.post('/segmentation/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.authHeader || (req.headers['authorization'] as string);
    const result = await AiService.analyzeTenantSegmentation(authHeader);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Orquestación: Predicción de riesgo nutricional para un paciente específico
iaRouter.get('/risk-prediction/:patientId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.authHeader || (req.headers['authorization'] as string);
    const result = await AiService.predictPatientRisk(req.params.patientId, authHeader);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Proxy transparente para endpoints de FastAPI (/api/v1/food-scan, /api/v1/health, etc.)
const aiProxy = createProxyMiddleware({
  target: config.aiServiceUrl,
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/ia': '/api/v1',
  },
  on: {
    proxyReq: (proxyReq, req) => {
      onProxyReqForwardAuth(proxyReq, req as Request);
      // Inyección automática de la clave de seguridad del microservicio de IA
      if (!config.aiApiKey) {
        proxyReq.destroy(new Error('AI_API_KEY no está configurada en el gateway'));
        return;
      }
      proxyReq.setHeader('x-api-key', config.aiApiKey);
      proxyReq.setHeader('x-correlation-id', (req as Request).correlationId || '');
    },
  },
});

iaRouter.use('/', aiProxy);
