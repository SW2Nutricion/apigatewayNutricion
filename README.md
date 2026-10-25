# VitalBite API Gateway

API Gateway central para el ecosistema de microservicios VitalBite.
Centraliza la comunicación, enrutamiento, orquestación entre backends y preservación de cabeceras de autenticación.

## Arquitectura y Rol en el Ecosistema

El API Gateway actúa como el punto de entrada unificado para clientes web (Angular) y móviles (React Native/Expo).
Desacopla completamente el backend `vitalBite-backend-core` de dependencias HTTP hacia otros backends, asumiendo la orquestación y el proxy hacia:

- **Core Backend (`vitalBite-backend-core`)**: Dominio de negocio, persistencia en PostgreSQL con Prisma y autenticación JWT.
- **Microservicio Documental (`vitalBite-Spring-Boot`)**: Generación de documentos PDF (`dieta.pdf`, `factura.pdf`) y gestión documental.
- **Microservicio de IA (`vitalBite-backend-ia`)**: Algoritmos de Machine Learning y Deep Learning (Random Forest, K-means, OCR y CNN).
- **Microservicio de Pagos**: Gestión de suscripciones, cambios de plan y pasarela de pagos.

```
                    ┌──────────────────────────┐
                    │  Clientes (Web / Móvil)  │
                    └────────────┬─────────────┘
                                 │ HTTP / GraphQL (Header: Authorization)
                                 ▼
                    ┌──────────────────────────┐
                    │  vitalBite-api-gateway   │ (Puerto 4000)
                    └────────────┬─────────────┘
         ┌───────────────────────┼──────────────────────────┬────────────────────────┐
         │ (Reenvío sin modif.)  │                          │                        │
         ▼                       ▼                          ▼                        ▼
┌─────────────────┐    ┌───────────────────┐      ┌──────────────────┐     ┌──────────────────┐
│  backend-core   │    │  backend-ia       │      │  Spring-Boot     │     │  payments-svc    │
│  (PostgreSQL)   │    │  (FastAPI)        │      │  (Documental)    │     │  (Suscripciones) │
│  Puerto 3000    │    │  Puerto 8001      │      │  Puerto 8082     │     │  Puerto 5100     │
└─────────────────┘    └───────────────────┘      └──────────────────┘     └──────────────────┘
```

## Reenvío del Header `Authorization`

El gateway implementa un middleware de reenvío transparente (`auth-forwarder.ts`):
Cualquier header `Authorization` (ej. `Bearer <jwt>`) recibido desde el cliente es propagado íntegramente y sin alteraciones hacia los microservicios downstream, permitiendo que la verificación de firma JWT y contexto de usuario en el Core sigan operando de forma continua.

## Endpoints Principales

- `GET /health`: Estado de salud del Gateway y chequeo de conectividad a todos los microservicios downstream.
- `POST /graphql`: Proxy GraphQL inteligente hacia el Core con intercepción de operaciones que invocan microservicios externos:
  - `generateDietPdf`: Orquesta la consulta del plan en el Core y la compilación en Spring Boot.
  - `analyzeTenantSegmentation`: Orquesta la extracción de métricas de pacientes y el análisis K-Means en FastAPI.
  - `patientRiskPrediction`: Orquesta la recopilación de mediciones y la inferencia Random Forest en FastAPI.
  - `subscriptionPlans`: Consulta los planes en el microservicio de pagos.
  - El resto de consultas y mutaciones se transfieren íntegramente al Core.
- `GET /graphql`: Interfaz GraphiQL / Playground proxificada desde el Core.
- `POST /api/v1/documents/pdf/diet/:dietId`: Orquestación directa REST de generación de PDF para una dieta.
- `/api/v1/documents/*`: Proxy hacia el microservicio Spring Boot.
- `/api/v1/ia/*`: Proxy hacia el microservicio FastAPI (con inyección automática de `X-API-Key`).
- `/api/v1/payments/*`: Endpoints y proxy hacia el microservicio de pagos y suscripciones.

## Instalación y Ejecución

```bash
# Instalar dependencias
npm install

# Modo desarrollo con recarga en caliente
npm run dev

# Compilar TypeScript
npm run build

# Iniciar en producción
npm run start
```
