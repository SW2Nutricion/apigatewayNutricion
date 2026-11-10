import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { authForwarderMiddleware } from './middleware/auth-forwarder.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './routes/health.routes.js';
import { graphqlRouter } from './routes/graphql.routes.js';
import { documentsRouter } from './routes/documents.routes.js';
import { iaRouter } from './routes/ia.routes.js';

const app = express();

// Middlewares base
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(requestLogger);
app.use(authForwarderMiddleware);
app.use((req, res, next) => {
  res.setHeader('X-Correlation-Id', req.correlationId || 'unknown');
  next();
});

// Rutas del Gateway
app.use('/health', healthRouter);
app.use('/graphql', graphqlRouter);
app.use('/api/v1/documents', documentsRouter);
app.use('/api/v1/ia', iaRouter);

// Ruta raíz con información del gateway
app.get('/', (_req, res) => {
  res.json({
    service: 'VitalBite API Gateway',
    version: '1.0.0',
    description: 'Punto de entrada único para orquestación, reenvío de autenticación y proxy de microservicios.',
    endpoints: {
      health: '/health',
      graphql: '/graphql',
      documents: '/api/v1/documents',
      ia: '/api/v1/ia',
    },
    downstreamServices: {
      core: config.coreServiceUrl,
      springBoot: config.springBootServiceUrl,
      ia: config.aiServiceUrl,
    },
  });
});

// Middleware centralizado de errores
app.use(errorHandler);

// Inicio del servidor
app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 VitalBite API Gateway iniciado exitosamente`);
  console.log(`📡 Puerto: ${config.port}`);
  console.log(`🔗 Core Backend (Auth & PostgreSQL): ${config.coreServiceUrl}`);
  console.log(`📄 Spring Boot (Documentos / PDF): ${config.springBootServiceUrl}`);
  console.log(`🧠 Backend IA (FastAPI): ${config.aiServiceUrl}`);
  console.log(`🔒 Reenvío de Authorization: ACTIVO (Unmodified Bearer)`);
  console.log(`=======================================================`);
});

export default app;
