import type { Request, Response, NextFunction } from 'express';
import { sendError } from './errorHandler.js';

export function contentTypeMiddleware(req: Request, res: Response, next: NextFunction) {
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) {
        return sendError(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
    }
    next();
}
