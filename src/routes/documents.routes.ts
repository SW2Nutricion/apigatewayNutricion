import { Router, Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config/env.js';
import { onProxyReqForwardAuth } from '../middleware/auth-forwarder.js';
import { DocumentsService } from '../services/documents.service.js';

export const documentsRouter = Router();

// Orquestación: Generar PDF a partir del ID de dieta en el Core
documentsRouter.post('/pdf/diet/:dietId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.authHeader || (req.headers['authorization'] as string);
    const result = await DocumentsService.generateDietPdf(req.params.dietId, authHeader);
    res.json({
      success: true,
      url: result.url,
      dietId: req.params.dietId,
    });
  } catch (error) {
    next(error);
  }
});

// Orquestación: Generar PDF enviando el payload completo directamente
documentsRouter.post('/pdf/diet', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.authHeader || (req.headers['authorization'] as string);
    const pdfBuffer = await DocumentsService.generatePdfFromPayload(req.body, authHeader);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="dieta.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// Proxy transparente para el resto de rutas de Spring Boot (/api/v1/documents/** y /api/v1/documentos/**)
const springBootProxy = createProxyMiddleware({
  target: config.springBootServiceUrl,
  changeOrigin: true,
  on: {
    proxyReq: onProxyReqForwardAuth,
  },
});

documentsRouter.use('/', springBootProxy);
