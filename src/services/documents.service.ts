import { config } from '../config/env.js';
import { CoreClientService } from './core-client.service.js';
import { mapDietPlanToPdfPayload } from '../mappers/diet-pdf.mapper.js';

export class DocumentsService {
  /**
   * Genera el PDF de una dieta comunicándose con Core (para obtener el plan)
   * y con el microservicio Spring Boot (para compilar y emitir el PDF).
   */
  static async generateDietPdf(dietId: string, authHeader?: string): Promise<{ url: string; base64?: string }> {
    const dietQuery = `
      query GetDietForPdf($id: ID!) {
        dietPlan(id: $id) {
          id
          tenantId
          patientId
          nutritionistId
          name
          objective
          phase
          approach
          startDate
          endDate
          status
          mealsPerDay
          mainRestriction
          notes
          estimatedCalories
          adherencePercent
          patientFullName
          nutritionistFullName
          days {
            id
            dietPlanId
            dayLabel
            dayOrder
            meals {
              id
              dietPlanDayId
              name
              mealOrder
              targetCalories
              notes
              items {
                id
                dietMealId
                name
                portion
                calories
                itemOrder
                notes
              }
            }
          }
        }
      }
    `;

    const data = await CoreClientService.executeGraphQL<{ dietPlan: any }>(
      dietQuery,
      { id: dietId },
      authHeader,
    );

    if (!data?.dietPlan) {
      throw new Error(`Plan de dieta con ID ${dietId} no encontrado en el Core.`);
    }

    const payload = mapDietPlanToPdfPayload(data.dietPlan);

    const springBootUrl = `${config.springBootServiceUrl}/api/v1/documents/pdf/diet`;
    const response = await fetch(springBootUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error en microservicio Spring Boot [${response.status}]: ${errText || response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = (await response.json()) as any;
      return { url: json.url || json.documentUrl || springBootUrl };
    }

    // Spring Boot responde con application/pdf binario:
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Pdf = buffer.toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64Pdf}`;

    return {
      url: dataUrl,
      base64: base64Pdf,
    };
  }

  /**
   * Genera el PDF directamente a partir del payload sin consultar Core.
   */
  static async generatePdfFromPayload(payload: any, authHeader?: string): Promise<Buffer> {
    const springBootUrl = `${config.springBootServiceUrl}/api/v1/documents/pdf/diet`;
    const response = await fetch(springBootUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error generando PDF en Spring Boot: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
