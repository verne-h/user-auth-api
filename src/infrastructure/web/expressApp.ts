import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { RedisStore as RateLimitRedisStore } from 'rate-limit-redis';
import type { RedisClientType } from 'redis';
import { config } from '../../config/index.js';
import { requestIdMiddleware } from '../../interfaces/middleware/requestId.js';
import { errorHandler } from '../../interfaces/middleware/errorHandler.js';
import { contentTypeMiddleware } from '../../interfaces/middleware/contentType.js';
import type { UserRepository } from '../../features/user/domain/UserRepository.js';
import { createAuthRouter } from '../../features/auth/http/authRoutes.js';
import { createUserRouter } from '../../features/user/http/userRoutes.js';

export function createApp({ repository, redis }: { repository: UserRepository; redis?: RedisClientType }) {
    const app = express();

    app.disable('x-powered-by');
    if (config.trustProxy) app.set('trust proxy', 1);

    app.use(requestIdMiddleware);
    app.use(
        helmet({
            contentSecurityPolicy: false,
            crossOriginEmbedderPolicy: false,
        }),
    );
    app.use(contentTypeMiddleware);
    app.use(express.json({ limit: config.requestBodyLimit, type: 'application/json' }));

    const makeRateLimitStore = (prefix: string) =>
        redis
            ? new RateLimitRedisStore({
                sendCommand: (...args: string[]) => redis.sendCommand(args),
                prefix,
            })
            : undefined;

    const loginLimiter = rateLimit({
        windowMs: config.loginRateLimitWindowMs,
        max: config.loginRateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
        store: makeRateLimitStore('auth:login'),
        handler: (_req, res) => {
            res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
        },
    });

    const createUserLimiter = rateLimit({
        windowMs: config.createUserRateLimitWindowMs,
        max: config.createUserRateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
        store: makeRateLimitStore('auth:create-user'),
        handler: (_req, res) => {
            res.status(429).json({ message: 'Too many user creation attempts. Please try again later.' });
        },
    });

    app.use(
        '/v1',
        createUserRouter(repository, createUserLimiter),
        createAuthRouter(repository, loginLimiter),
    );

    app.get('/livez', (_req, res) => res.status(200).json({ status: 'ok' }));
    app.get('/readyz', async (req, res) => {
        if (!redis) return res.status(200).json({ status: 'ok' });
        try {
            await redis.ping();
            return res.status(200).json({ status: 'ok' });
        } catch {
            return res.status(503).json({ status: 'unavailable' });
        }
    });

    app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found.' }, request_id: res.locals.requestId }));

    app.use(errorHandler);

    return app;
}
