import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
    const id = crypto.randomUUID();
    res.locals.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
}
