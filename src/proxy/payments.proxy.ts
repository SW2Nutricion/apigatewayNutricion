import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config/env.js';

export const paymentsProxy = createProxyMiddleware({
  target: config.paymentsServiceUrl || 'http://localhost:5100',
  changeOrigin: true,
  pathRewrite: { '^/api/v1/payments': '' },
});
