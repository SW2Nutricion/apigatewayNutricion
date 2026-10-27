import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';
import { DocumentsService } from '../services/documents.service.js';
import { AiService } from '../services/ai.service.js';
import { PaymentsService } from '../services/payments.service.js';
import { CoreClientService } from '../services/core-client.service.js';

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
    if (operationName === 'GenerateDietPdf') {
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
    if (operationName === 'AnalyzeTenantSegmentation') {
      const segResult = await AiService.analyzeTenantSegmentation(authHeader);
      return res.json({
        data: {
          analyzeTenantSegmentation: segResult,
        },
      });
    }

    // 3. Intercepción: Predicción de Riesgo IA (FastAPI)
    if (operationName === 'PatientRiskPrediction') {
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
    if (operationName === 'SubscriptionPlans') {
      const plans = await PaymentsService.findPlans(authHeader);
      return res.json({
        data: {
          subscriptionPlans: plans.map(PaymentsService.toGraphqlPlan),
        },
      });
    }

    if (operationName && isPaymentOperation(operationName)) {
      const tenantSlug = await getCurrentTenantSlug(authHeader);

      if (operationName === 'CurrentTenantSubscription') {
        const subscription = await PaymentsService.findCurrentTenantSubscription(tenantSlug, authHeader);
        return res.json({ data: { currentTenantSubscription: PaymentsService.toGraphqlSubscription(subscription) } });
      }

      if (operationName === 'PlanChangeRequests') {
        const requests = await PaymentsService.findPlanChangeRequests(tenantSlug, authHeader);
        return res.json({ data: { planChangeRequests: requests } });
      }

      if (operationName === 'CheckoutSessionStatus') {
        const sessionId = variables?.sessionId || extractArgument(query, 'checkoutSessionStatus', 'sessionId');
        const status = await PaymentsService.getCheckoutSessionStatus(sessionId, authHeader);
        return res.json({ data: { checkoutSessionStatus: status } });
      }

      if (operationName === 'RequestPlanChange') {
        const input = variables?.input || {};
        const result = await PaymentsService.requestPlanChange(tenantSlug, input, authHeader);
        return res.json({ data: { requestPlanChange: result } });
      }

      if (operationName === 'PaySubscription') {
        const result = await PaymentsService.paySubscription(tenantSlug, authHeader);
        return res.json({ data: { paySubscription: result } });
      }

      if (operationName === 'CreateInitialCheckoutSession') {
        const input = variables?.input || {};
        const result = await PaymentsService.createInitialCheckoutSession(tenantSlug, input.planCode, authHeader);
        return res.json({ data: { createInitialCheckoutSession: result } });
      }
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

function isPaymentOperation(operationName: string) {
  return new Set([
    'CurrentTenantSubscription',
    'PlanChangeRequests',
    'CheckoutSessionStatus',
    'RequestPlanChange',
    'PaySubscription',
    'CreateInitialCheckoutSession',
  ]).has(operationName);
}

async function getCurrentTenantSlug(authHeader?: string) {
  const data = await CoreClientService.executeGraphQL<{ currentTenant: { slug: string } }>(
    'query CurrentTenant { currentTenant { slug } }',
    {},
    authHeader,
  );
  if (!data.currentTenant?.slug) {
    throw new Error('No se pudo resolver el tenant actual para pagos.');
  }
  return data.currentTenant.slug;
}
