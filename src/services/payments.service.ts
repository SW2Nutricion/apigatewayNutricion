import { config } from '../config/env.js';

export interface PaymentsPlanResponse {
  code: string;
  name: string;
  description: string;
  priceUsd: number;
  billingPeriod: string;
  audience: string;
  included: string[];
  limits: Record<string, string>;
}

export interface PaymentsSubscriptionResponse {
  tenantId: string;
  planCode: string;
  planName: string;
  status: string;
  billingPeriod: string;
  startedAt: string;
  nextReviewAt: string;
  limits: Record<string, string>;
}

export interface PaymentsPlanChangeRequestResponse {
  requestId: string;
  tenantId: string;
  currentPlanCode: string;
  requestedPlanCode: string;
  requestedPlanName: string;
  status: string;
  comment?: string | null;
  requestedAt: string;
  resolutionComment?: string | null;
  resolvedAt?: string | null;
}

export interface PaymentsPayResponse {
  transactionHash: string;
  invoiceUrl: string;
  nextReviewAt: string;
}

export interface PaymentsInitialCheckoutSessionResponse {
  sessionId: string;
  checkoutUrl: string;
}

export interface PaymentsCheckoutSessionStatusResponse {
  sessionId: string;
  status: string;
  tenantId: string;
  planCode?: string | null;
  invoiceUrl?: string | null;
  activatedAt?: string | null;
  nextReviewAt?: string | null;
}

export interface PaymentsRequestOptions {
  method?: string;
  body?: string;
  authHeader?: string;
}

export class PaymentsService {
  static toGraphqlPlan(plan: PaymentsPlanResponse) {
    return { ...plan, limits: this.toLimitList(plan.limits) };
  }

  static toGraphqlSubscription(subscription: PaymentsSubscriptionResponse | null) {
    return subscription
      ? { ...subscription, limits: this.toLimitList(subscription.limits) }
      : null;
  }

  private static toLimitList(limits: Record<string, string> | undefined) {
    return Object.entries(limits || {}).map(([key, value]) => ({ key, value }));
  }

  private static async request<T>(path: string, init: PaymentsRequestOptions = {}): Promise<T> {
    const baseUrl = config.paymentsServiceUrl;
    const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (init.authHeader) {
      headers['authorization'] = init.authHeader;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: init.method ?? 'GET',
        headers,
        body: init.body,
      });
    } catch (err) {
      throw new Error(`Microservicio de pagos no disponible en ${baseUrl}: ${(err as Error).message}`);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Payments microservice error [${response.status}]: ${text || response.statusText}`);
    }

    return (await response.json()) as T;
  }

  private static async requestOptional<T>(path: string, init: PaymentsRequestOptions = {}): Promise<T | null> {
    try {
      return await this.request<T>(path, init);
    } catch (err: any) {
      if (err.message?.includes('404')) {
        return null;
      }
      throw err;
    }
  }

  static async findPlans(authHeader?: string): Promise<PaymentsPlanResponse[]> {
    return this.request<PaymentsPlanResponse[]>('/plans', { authHeader });
  }

  static async findCurrentTenantSubscription(tenantSlug: string, authHeader?: string): Promise<PaymentsSubscriptionResponse | null> {
    return this.requestOptional<PaymentsSubscriptionResponse>(
      `/tenants/${encodeURIComponent(tenantSlug)}/subscription`,
      { authHeader },
    );
  }

  static async findPlanChangeRequests(tenantSlug: string, authHeader?: string): Promise<PaymentsPlanChangeRequestResponse[]> {
    return this.request<PaymentsPlanChangeRequestResponse[]>(
      `/tenants/${encodeURIComponent(tenantSlug)}/plan-change-requests`,
      { authHeader },
    );
  }

  static async findAllSubscriptions(authHeader?: string): Promise<PaymentsSubscriptionResponse[]> {
    return this.request<PaymentsSubscriptionResponse[]>('/admin/subscriptions', { authHeader });
  }

  static async findAllPlanChangeRequests(filters: { status?: string | null } = {}, authHeader?: string): Promise<PaymentsPlanChangeRequestResponse[]> {
    const params = new URLSearchParams();
    if (filters.status) {
      params.set('status', filters.status);
    }
    const path = params.size ? `/admin/plan-change-requests?${params.toString()}` : '/admin/plan-change-requests';
    return this.request<PaymentsPlanChangeRequestResponse[]>(path, { authHeader });
  }

  static async requestPlanChange(tenantSlug: string, input: { planCode: string; comment?: string }, authHeader?: string): Promise<PaymentsPlanChangeRequestResponse> {
    return this.request<PaymentsPlanChangeRequestResponse>(
      `/tenants/${encodeURIComponent(tenantSlug)}/plan-change-requests`,
      {
        method: 'POST',
        body: JSON.stringify(input),
        authHeader,
      },
    );
  }

  static async paySubscription(tenantSlug: string, authHeader?: string): Promise<PaymentsPayResponse> {
    return this.request<PaymentsPayResponse>(
      `/tenants/${encodeURIComponent(tenantSlug)}/payments/pay`,
      {
        method: 'POST',
        body: '{}',
        authHeader,
      },
    );
  }

  static async createInitialCheckoutSession(tenantSlug: string, planCode: string, authHeader?: string): Promise<PaymentsInitialCheckoutSessionResponse> {
    return this.request<PaymentsInitialCheckoutSessionResponse>(
      `/tenants/${encodeURIComponent(tenantSlug)}/checkout-sessions`,
      {
        method: 'POST',
        body: JSON.stringify({ planCode }),
        authHeader,
      },
    );
  }

  static async getCheckoutSessionStatus(sessionId: string, authHeader?: string): Promise<PaymentsCheckoutSessionStatusResponse> {
    return this.request<PaymentsCheckoutSessionStatusResponse>(
      `/checkout-sessions/${encodeURIComponent(sessionId)}`,
      { authHeader },
    );
  }

  static async resolvePlanChangeForTenant(
    tenantSlug: string,
    requestId: string,
    action: 'approve' | 'reject',
    comment?: string,
    authHeader?: string,
  ): Promise<PaymentsPlanChangeRequestResponse> {
    return this.request<PaymentsPlanChangeRequestResponse>(
      `/tenants/${encodeURIComponent(tenantSlug)}/plan-change-requests/${encodeURIComponent(requestId)}/${action}`,
      {
        method: 'POST',
        body: JSON.stringify({ comment }),
        authHeader,
      },
    );
  }
}
