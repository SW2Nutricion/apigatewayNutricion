import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config/env.js';

export const aiProxy = createProxyMiddleware({
  target: config.aiServiceUrl,
  changeOrigin: true,
  pathRewrite: { '^/api/v1/ia': '/api/v1' },
});
