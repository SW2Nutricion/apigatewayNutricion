import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config/env.js';

export const documentsProxy = createProxyMiddleware({ target: config.springBootServiceUrl, changeOrigin: true });
