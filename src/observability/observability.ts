import { ConsoleLogger, INestApplication, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

type LogContext = { requestId?: string; runId?: string };
const context = new AsyncLocalStorage<LogContext>();
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function logContext(): LogContext {
  return { ...context.getStore() };
}

export function withLogContext<T>(ids: LogContext, operation: () => T): T {
  const safe = logContext();
  for (const key of ['requestId', 'runId'] as const) {
    const value = ids[key];
    if (typeof value === 'string' && uuid.test(value)) safe[key] = value;
  }
  return context.run(safe, operation);
}

export function createServiceLogger(): ConsoleLogger {
  return new ConsoleLogger({
    json: true,
    colors: false,
    logLevels: ['log', 'warn', 'error', 'fatal'],
  });
}

export function httpLoggingMiddleware(logger = new Logger('HTTP')) {
  return (request: Request, response: Response, next: NextFunction): void => {
    // Heartbeats are represented by probe metrics, not repetitive access logs.
    if (
      request.path === '/health' &&
      ['GET', 'HEAD'].includes(request.method)
    ) {
      next();
      return;
    }
    const requestId = randomUUID();
    const started = process.hrtime.bigint();
    response.setHeader('X-Request-ID', requestId);
    response.once('finish', () => {
      const route = request.route as { path?: unknown } | undefined;
      const entry = {
        event: 'http_request',
        requestId,
        method: request.method,
        // Never export concrete paths, queries, bodies, cookies or auth headers.
        route: typeof route?.path === 'string' ? route.path : '/unmatched',
        statusCode: response.statusCode,
        durationMs: Math.round(Number(process.hrtime.bigint() - started) / 1e6),
      };
      if (entry.statusCode >= 500) logger.error(entry);
      else if (entry.statusCode >= 400) logger.warn(entry);
      else logger.log(entry);
    });
    withLogContext({ requestId }, next);
  };
}

export function configureObservability(app: INestApplication): void {
  app.use(httpLoggingMiddleware());
  app.enableShutdownHooks();
}
