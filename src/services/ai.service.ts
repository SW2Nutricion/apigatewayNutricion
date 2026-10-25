import { config } from '../config/env.js';
import { CoreClientService } from './core-client.service.js';

export interface PatientFeatureInput {
  patient_id: string;
  imc: number | null;
  porcentaje_grasa: number | null;
  masa_muscular_kg: number | null;
  variacion_peso_3m: number | null;
  nivel_actividad: number | null;
  adherencia_dieta_pct: number | null;
  asistencia_citas_pct: number | null;
}

export interface RiskFeatures {
  edad: number | null;
  sexo: number | null;
  peso_kg: number | null;
  talla_m: number | null;
  imc: number | null;
  variacion_peso_3m_kg: number;
  porcentaje_grasa: number | null;
  nivel_actividad: number;
  calidad_dieta_score: number;
  num_comorbilidades: number;
}

export class AiService {
  /**
   * Invoca el motor de IA (FastAPI) para segmentar los pacientes del tenant.
   * Recopila la información de pacientes desde Core reenviando el Authorization header.
   */
  static async analyzeTenantSegmentation(authHeader?: string): Promise<any> {
    const patientsQuery = `
      query GetPatientsForSegmentation {
        patients {
          id
          tenantId
          activityLevel
          bodyMeasurements {
            measuredAt
            weightKg
            heightCm
            bmi
          }
          bodyCompositions {
            measuredAt
            bodyFatPercentage
            muscleMassKg
          }
        }
      }
    `;

    const data = await CoreClientService.executeGraphQL<{ patients: any[] }>(
      patientsQuery,
      {},
      authHeader,
    );

    const patients = data?.patients || [];
    if (patients.length === 0) {
      throw new Error('No hay pacientes disponibles para segmentar.');
    }

    const tenantId = patients[0]?.tenantId || 'default-tenant';

    const features: PatientFeatureInput[] = patients.map((p) => {
      const latestMeasurement = p.bodyMeasurements?.[0] || null;
      const latestComposition = p.bodyCompositions?.[0] || null;

      const rawImc = latestMeasurement?.bmi ??
        (latestMeasurement?.weightKg && latestMeasurement?.heightCm
          ? Number((latestMeasurement.weightKg / Math.pow(latestMeasurement.heightCm / 100, 2)).toFixed(2))
          : null);

      const clamp = (val: number | null | undefined, min: number, max: number) => {
        if (val === null || val === undefined) return null;
        if (val < min) return min;
        if (val > max) return max;
        return val;
      };

      return {
        patient_id: p.id,
        imc: clamp(rawImc, 10, 70),
        porcentaje_grasa: clamp(latestComposition?.bodyFatPercentage, 3, 70),
        masa_muscular_kg: clamp(latestComposition?.muscleMassKg, 5, 100),
        variacion_peso_3m: 0,
        nivel_actividad: clamp(p.activityLevel ?? 2, 0, 4),
        adherencia_dieta_pct: 50,
        asistencia_citas_pct: 80,
      };
    });

    const aiUrl = `${config.aiServiceUrl}/api/v1/segmentation`;
    const response = await fetch(aiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.aiApiKey,
      },
      body: JSON.stringify({ tenant_id: tenantId, patients: features }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`FastAPI AI Segmentation error [${response.status}]: ${errText || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Invoca el modelo Random Forest en FastAPI para calcular el riesgo nutricional de un paciente.
   */
  static async predictPatientRisk(patientId: string, authHeader?: string): Promise<any> {
    const patientQuery = `
      query GetPatientForRisk($id: ID!) {
        patient(id: $id) {
          id
          tenantId
          birthDate
          gender
          activityLevel
          dietQualityScore
          comorbiditiesCount
          heightCm
          bodyMeasurements {
            measuredAt
            weightKg
            heightCm
            bmi
          }
          bodyCompositions {
            measuredAt
            bodyFatPercentage
          }
        }
      }
    `;

    const data = await CoreClientService.executeGraphQL<{ patient: any }>(
      patientQuery,
      { id: patientId },
      authHeader,
    );

    const patient = data?.patient;
    if (!patient) {
      throw new Error(`Paciente con ID ${patientId} no encontrado en el Core.`);
    }

    const latestMeasurement = patient.bodyMeasurements?.[0] || null;
    const latestComposition = patient.bodyCompositions?.[0] || null;

    const age = patient.birthDate
      ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    const genderCode = patient.gender === 'MALE' ? 1 : patient.gender === 'FEMALE' ? 0 : null;
    const heightM = (latestMeasurement?.heightCm || patient.heightCm) ? (latestMeasurement?.heightCm || patient.heightCm) / 100 : null;
    const weightKg = latestMeasurement?.weightKg || null;
    const bmi = latestMeasurement?.bmi || (weightKg && heightM ? Number((weightKg / (heightM * heightM)).toFixed(2)) : null);

    const features: RiskFeatures = {
      edad: age,
      sexo: genderCode,
      peso_kg: weightKg,
      talla_m: heightM,
      imc: bmi,
      variacion_peso_3m_kg: 0,
      porcentaje_grasa: latestComposition?.bodyFatPercentage ?? null,
      nivel_actividad: patient.activityLevel ?? 2,
      calidad_dieta_score: patient.dietQualityScore ?? 5,
      num_comorbilidades: patient.comorbiditiesCount ?? 0,
    };

    const aiUrl = `${config.aiServiceUrl}/api/v1/risk-prediction`;
    const response = await fetch(aiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.aiApiKey,
      },
      body: JSON.stringify({
        patient_id: patientId,
        tenant_id: patient.tenantId,
        features,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`FastAPI AI Risk Prediction error [${response.status}]: ${errText || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Reenvío directo de cualquier petición a la IA con inyección automática de X-API-Key.
   */
  static async forwardToAi(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${config.aiServiceUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': config.aiApiKey,
      ...((options.headers as Record<string, string>) || {}),
    };

    return fetch(url, { ...options, headers });
  }
}
