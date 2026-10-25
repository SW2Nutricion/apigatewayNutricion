import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Downstream Services
  coreServiceUrl: (process.env.CORE_SERVICE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  coreGraphqlUrl: process.env.CORE_GRAPHQL_URL || `${(process.env.CORE_SERVICE_URL || 'http://localhost:3000').replace(/\/$/, '')}/graphql`,

  springBootServiceUrl: (process.env.SPRING_BOOT_SERVICE_URL || 'http://localhost:8082').replace(/\/$/, ''),

  aiServiceUrl: (process.env.AI_SERVICE_URL || 'http://localhost:8001').replace(/\/$/, ''),
  aiApiKey: process.env.AI_API_KEY || 'vitalbite_ia_secret_key_dev_change_in_prod',

  paymentsServiceUrl: (process.env.PAYMENTS_SERVICE_URL || 'http://localhost:5100').replace(/\/$/, ''),
};
