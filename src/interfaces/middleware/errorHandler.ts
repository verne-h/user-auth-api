import type { Request, Response, NextFunction } from 'express';
import type { ApiErrorBody } from '../../shared/types/ApiErrorBody.js';
import { ZodError } from 'zod';

function requestId(res: Response): string {
    return String(res.locals.requestId ?? 'unknown');
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
    if (err instanceof ZodError) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Request validation failed.', err.flatten());
    }

    if (err instanceof SyntaxError && 'body' in err) {
        return sendError(res, 400, 'INVALID_JSON', 'Request body must contain valid JSON.');
    }

    const logRecord = {
        level: 'error',
        request_id: requestId(res),
        method: req.method,
        path: req.path,
        message: err instanceof Error ? err.message : 'Unknown error',
    };
    console.error(JSON.stringify(logRecord));

    return sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
}

export function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
    const body: ApiErrorBody = {
        error: { code, message },
        request_id: requestId(res),
    };

    if (details !== undefined) body.error.details = details;
    return res.status(status).json(body);
}
