
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { captureError } from '@/services/monitoring';

export function withMetrics(routeHandler: (request: Request, ...args: unknown[]) => Promise<Response>) {
  return async (request: Request, ...args: unknown[]) => {
    const startTime = Date.now();
    let status = 500;
    let provider = 'unknown';
    const cacheStatus = 'MISS'; // Default assumption for dynamic API routes

    try {
      const response = await routeHandler(request, ...args);
      status = response.status;
      
      // If we have custom headers for metrics (like provider), extract them
      if (response.headers.has('x-provider')) {
        provider = response.headers.get('x-provider') || 'unknown';
      }
      
      return response;
    } catch (error) {
      status = 500;
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      const url = new URL(request.url);
      const route = url.pathname;

      try {
        // Fire and forget metrics insert
        // Note: We use daily aggregates. For a raw log, we can just insert and let a cron aggregate.
        // Alternatively, we can use an RPC to do UPSERT for aggregates.
        // For now, we'll log raw metrics. A production system would use an aggregate query.
        getSupabaseAdmin().from('ApiMetrics').insert([{
          route,
          status,
          duration,
          provider,
          cache: cacheStatus,
          method: request.method
        }]).then(({ error }) => {
          if (error) {
            captureError(error, { route: 'metrics_middleware' });
          }
        }).catch(err => {
          captureError(err, { route: 'metrics_middleware' });
        });
      } catch (err) {
        captureError(err, { route: 'metrics_middleware' });
      }
    }
  };
}
