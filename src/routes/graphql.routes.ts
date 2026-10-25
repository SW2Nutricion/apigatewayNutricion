import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';
import { DocumentsService } from '../services/documents.service.js';
import { AiService } from '../services/ai.service.js';
import { PaymentsService } from '../services/payments.service.js';

export const graphqlRouter = Router();

// GET /graphql: Redirige o proxifica la interfaz GraphiQL / Playground desde el Core
graphqlRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.authHeader || (req.headers['authorization'] as string);
    const headers: Record<string, string> = {};
    if (authHeader) headers['authorization'] = authHeader;

    const coreResponse = await fetch(config.coreGraphqlUrl, {
      method: 'GET',
      headers,
    });

    res.status(coreResponse.status);
    coreResponse.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });
    const body = await coreResponse.text();
    res.send(body);
  } catch (error) {
    next(error);
  }
});

// POST /graphql: Enrutamiento inteligente con reenvío íntegro del header Authorization
graphqlRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, variables, operationName } = req.body || {};
    const authHeader = req.authHeader || (req.headers['authorization'] as string);

    // 1. Intercepción: Generación de PDF de Dieta (Spring Boot)
    if (typeof query === 'string' && (query.includes('generateDietPdf') || operationName === 'GenerateDietPdf')) {
      const dietId = variables?.id || extractArgument(query, 'generateDietPdf', 'id');
      if (dietId) {
        const pdfResult = await DocumentsService.generateDietPdf(dietId, authHeader);
        return res.json({
          data: {
            generateDietPdf: pdfResult.url,
          },
        });
      }
    }

    // 2. Intercepción: Segmentación de Pacientes IA (FastAPI)
    if (typeof query === 'string' && (query.includes('analyzeTenantSegmentation') || operationName === 'AnalyzeTenantSegmentation')) {
      const segResult = await AiService.analyzeTenantSegmentation(authHeader);
      return res.json({
        data: {
          analyzeTenantSegmentation: segResult,
        },
      });
    }

    // 3. Intercepción: Predicción de Riesgo IA (FastAPI)
    if (typeof query === 'string' && (query.includes('patientRiskPrediction') || operationName === 'PatientRiskPrediction')) {
      const patientId = variables?.patientId || extractArgument(query, 'patientRiskPrediction', 'patientId');
      if (patientId) {
        const riskResult = await AiService.predictPatientRisk(patientId, authHeader);
        return res.json({
          data: {
            patientRiskPrediction: {
              status: 'SUCCESS',
              nivelRiesgo: riskResult.nivel_riesgo,
              probabilidad: riskResult.probabilidad,
              probabilidades: riskResult.probabilidades,
              factoresCriticos: riskResult.factores_criticos || [],
              recomendacion: riskResult.recomendacion,
            },
          },
        });
      }
    }

    // 4. Intercepción: Planes de Suscripción (Payments Microservice)
    if (typeof query === 'string' && (query.includes('subscriptionPlans') || operationName === 'SubscriptionPlans')) {
      const plans = await PaymentsService.findPlans(authHeader);
      return res.json({
        data: {
          subscriptionPlans: plans,
        },
      });
    }

    // 5. Reenvío por defecto al Core (PostgreSQL, Auth, Pacientes, Citas, etc.)
    // Reenvía el header Authorization sin modificarlo
    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (authHeader) {
      forwardHeaders['authorization'] = authHeader;
    }

    const coreResponse = await fetch(config.coreGraphqlUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(req.body),
    });

    const data = await coreResponse.json();
    return res.status(coreResponse.status).json(data);
  } catch (error) {
    next(error);
  }
});

function extractArgument(query: string, fieldName: string, argName: string): string | null {
  const regex = new RegExp(`${fieldName}\\s*\\([^)]*${argName}\\s*:\\s*["']?([^"',\\s)]+)["']?`, 'i');
  const match = query.match(regex);
  return match ? match[1] : null;
}
