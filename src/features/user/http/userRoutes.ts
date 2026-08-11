import express from 'express';
import type { UserRepository } from '../domain/UserRepository.js';
import { createUserSchema } from './validators.js';
import { registerUser } from '../application/registerUser.js';
import { authenticate } from '../../../interfaces/middleware/authenticate.js';

export function createUserRouter(repository: UserRepository, limiter?: express.RequestHandler) {
    const router = express.Router();

    router.post('/users', limiter ?? ((req, res, next) => next()), async (req, res, next) => {
        try {
            const input = createUserSchema.parse(req.body);
            const result = await registerUser(repository, input);

            if (result === 'username_exists' || result === 'email_exists') {
                return res.status(409).json({ message: 'Username or email already exists.' });
            }

            return res.status(200).json({
                message: 'User created successfully.', user: {
                    username: input.username,
                    email: input.email,
                    is_active: true,
                    created_at: new Date().toISOString(),
                }
            });
        } catch (err) {
            next(err);
        }
    });

    router.get('/users/me', authenticate, async (req, res, next) => {
        try {
            const username = res.locals.auth?.claims?.sub;
            if (typeof username !== 'string' || username.length === 0) {
                return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired access token.' }, request_id: res.locals.requestId });
            }

            const user = await repository.getUser(username);
            if (!user) {
                return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired access token.' }, request_id: res.locals.requestId });
            }

            return res.status(200).json({
                message: 'Current user returned successfully.',
                user: {
                    username: user.username,
                    email: user.email,
                    is_active: user.isActive,
                    created_at: user.createdAt,
                },
            });
        } catch (err) {
            next(err);
        }
    });

    return router;
}
