import { AiService } from '../services/ai.service.js';

export const aiClient = {
  analyzeTenantSegmentation: AiService.analyzeTenantSegmentation.bind(AiService),
  predictPatientRisk: AiService.predictPatientRisk.bind(AiService),
};
