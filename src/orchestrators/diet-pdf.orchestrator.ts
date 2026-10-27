import { documentsClient } from '../clients/documents.client.js';

export const dietPdfOrchestrator = {
  generateByDietId: documentsClient.generateDietPdf,
  generateFromPayload: documentsClient.generatePdfFromPayload,
};
