import { config } from '../config/env.js';

export class DownstreamError extends Error {
  constructor(
    message: string,
    public readonly status = 503,
    public readonly code = 'DOWNSTREAM_ERROR',
  ) {
    super(message);
    this.name = 'DownstreamError';
  }
}

export async function requestJson<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  correlationId?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers);
  if (correlationId) headers.set('X-Correlation-Id', correlationId);

  try {
    const response = await fetch(url, { ...init, headers, signal: controller.signal });
    if (!response.ok) {
      throw new DownstreamError(
        `Servicio downstream respondio ${response.status}`,
        response.status,
        response.status >= 500 ? 'DOWNSTREAM_UNAVAILABLE' : 'DOWNSTREAM_REJECTED',
      );
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DownstreamError) throw error;
    throw new DownstreamError(
      error instanceof Error && error.name === 'AbortError'
        ? 'Timeout del servicio downstream'
        : 'No se pudo contactar al servicio downstream',
      503,
      error instanceof Error && error.name === 'AbortError' ? 'DOWNSTREAM_TIMEOUT' : 'DOWNSTREAM_UNAVAILABLE',
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
