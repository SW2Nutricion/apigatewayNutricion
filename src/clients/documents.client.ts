import { DocumentsService } from '../services/documents.service.js';

export const documentsClient = {
  generateDietPdf: DocumentsService.generateDietPdf.bind(DocumentsService),
  generatePdfFromPayload: DocumentsService.generatePdfFromPayload.bind(DocumentsService),
};
