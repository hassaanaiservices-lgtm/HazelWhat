import { NextRequest, NextResponse } from 'next/server';
import { createTraceContext, runWithTraceContext, updateTraceContext } from './trace-context';
import { logger } from './logger';

export type ApiHandler = (req: NextRequest, context?: any) => Promise<NextResponse> | NextResponse;

export function withObservability(handler: ApiHandler, options: { service?: string; operation?: string } = {}) {
  return async (req: NextRequest, routeContext?: any): Promise<NextResponse> => {
    const startTime = performance.now();

    // 1. Extract incoming tracing headers if present (Sanitized by createTraceContext)
    const headerRequestId = req.headers.get('x-request-id') || undefined;
    const headerTraceId = req.headers.get('x-trace-id') || undefined;
    const headerCorrelationId = req.headers.get('x-correlation-id') || undefined;

    // SECURITY NOTE: Client-provided x-tenant-id is intentionally NOT trusted.
    // Tenant context is updated server-side by auth session middleware.

    // 2. Initialize Trace Context
    const traceCtx = createTraceContext({
      requestId: headerRequestId,
      traceId: headerTraceId,
      correlationId: headerCorrelationId,
      tenantId: undefined, // Must be set by server route handler after auth validation
      service: options.service || 'hazeldid-api',
      operation: options.operation || `${req.method} ${new URL(req.url).pathname}`,
      startTime: Date.now(),
    });

    // 3. Run Handler inside AsyncLocalStorage context
    return runWithTraceContext(traceCtx, async () => {
      try {
        const response = await handler(req, routeContext);
        const durationMs = performance.now() - startTime;

        const activeTenantId = traceCtx.tenantId;

        // Log HTTP completion
        logger.http(
          { method: req.method, url: req.url },
          response.status,
          durationMs,
          { tenant_id: activeTenantId }
        );

        // Inject tracing response headers
        response.headers.set('x-request-id', traceCtx.requestId);
        response.headers.set('x-trace-id', traceCtx.traceId);
        response.headers.set('x-correlation-id', traceCtx.correlationId);

        return response;
      } catch (err: any) {
        const durationMs = performance.now() - startTime;

        logger.error(
          `Unhandled API Error on ${req.method} ${new URL(req.url).pathname}`,
          err,
          {
            http: {
              method: req.method,
              url: req.url,
              status: 500,
              duration_ms: Math.round(durationMs * 100) / 100,
            },
          },
          options.operation || 'http_error'
        );

        const errorResponse = NextResponse.json(
          {
            error: err.message || 'Internal Server Error',
            requestId: traceCtx.requestId,
            traceId: traceCtx.traceId,
          },
          { status: 500 }
        );

        errorResponse.headers.set('x-request-id', traceCtx.requestId);
        errorResponse.headers.set('x-trace-id', traceCtx.traceId);
        errorResponse.headers.set('x-correlation-id', traceCtx.correlationId);

        return errorResponse;
      }
    });
  };
}
