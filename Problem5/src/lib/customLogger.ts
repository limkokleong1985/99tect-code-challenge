// logging.ts
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

interface RequestContextStore {
  requestId: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<RequestContextStore>();

export const originalLog = console.log.bind(console);
export const originalError = console.error.bind(console);

export function getRequestId(): string | null {
  const store = asyncLocalStorage.getStore();
  return store?.requestId ?? null;
}

export const init = ()=>{
  console.log = (...args: unknown[]): void => {
    const requestId = getRequestId();
    if (requestId) {
      originalLog(`[${requestId}]`, ...args);
    } else {
      originalLog(...args);
    }
  };


  console.error = (...args: unknown[]): void => {
    const requestId = getRequestId();
    if (requestId) {
      originalError(`[${requestId}]`, ...args);
    } else {
      originalError(...args);
    }
  };
}









type RequestWithId = Request & { id?: string };


export function requestContextMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction
): void {
  const requestId = randomUUID();
  const start = process.hrtime.bigint();

  asyncLocalStorage.run({ requestId }, () => {
    
    req.id = requestId;

    
    console.log(
      `Incoming request: ${req.method} ${req.originalUrl || req.url}`
    );

    
    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000; // ns → ms

      console.log(
        `Completed request: ${req.method} ${req.originalUrl || req.url} ` +
          `status=${res.statusCode} duration=${durationMs.toFixed(2)}ms`
      );
    });

    next();
  });
}