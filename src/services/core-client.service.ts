import { config } from '../config/env.js';

export interface CoreGraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string; locations?: any; path?: any; extensions?: any }>;
}

export class CoreClientService {
  /**
   * Ejecuta una consulta o mutación GraphQL contra el Core backend,
   * reenviando siempre la cabecera Authorization sin modificar.
   */
  static async executeGraphQL<T = any>(
    query: string,
    variables: Record<string, any> = {},
    authHeader?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authHeader) {
      headers['authorization'] = authHeader;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeouts.core);
    const response = await fetch(config.coreGraphqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = new Error(`Core GraphQL falló con status ${response.status}: ${response.statusText}`);
      Object.assign(error, { status: response.status });
      throw error;
    }

    const json = (await response.json()) as CoreGraphQLResponse<T>;

    if (json.errors && json.errors.length > 0) {
      const msg = json.errors.map((e) => e.message).join(' | ');
      throw new Error(`Error en Core GraphQL: ${msg}`);
    }

    return json.data as T;
  }

  /**
   * Ejecuta una petición REST contra el Core backend, reenviando Authorization.
   */
  static async requestRest<T = any>(
    endpoint: string,
    options: RequestInit = {},
    authHeader?: string,
  ): Promise<T> {
    const url = `${config.coreServiceUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (authHeader) {
      headers['authorization'] = authHeader;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeouts.core);
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Core REST error [${response.status}] en ${endpoint}: ${response.statusText}`);
    }

    return (await response.json()) as T;
  }
}
