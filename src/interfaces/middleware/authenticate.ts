import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../../features/auth/domain/AuthService.js';
import { sendError } from './errorHandler.js';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.get('authorization');

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const token = authHeader.slice('bearer '.length).trim();
    if (!token) {
        return sendError(res, 401, 'UNAUTHORIZED', 'Authentication required.');
    }

    try {
        const claims = await verifyAccessToken(token);
        res.locals.auth = { claims, token };
        return next();
    } catch {
        return sendError(res, 401, 'UNAUTHORIZED', 'Invalid or expired access token.');
    }
}
