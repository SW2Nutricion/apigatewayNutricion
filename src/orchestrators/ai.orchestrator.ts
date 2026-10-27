import { aiClient } from '../clients/ai.client.js';

export const aiOrchestrator = {
  scanTenant: aiClient.analyzeTenantSegmentation,
  predictRisk: aiClient.predictPatientRisk,
};
