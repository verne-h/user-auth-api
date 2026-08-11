import express from 'express';
import type { UserRepository } from '../../user/domain/UserRepository.js';
import { loginSchema } from './validators.js';
import { loginUser } from '../application/loginUser.js';

export function createAuthRouter(repository: UserRepository, limiter?: express.RequestHandler) {
    const router = express.Router();

    router.post('/auth/login', limiter ?? ((req, res, next) => next()), async (req, res, next) => {
        try {
            const input = loginSchema.parse(req.body);
            const result = await loginUser(repository, input);

            if (!result.success) {
                return res.status(401).json({ message: 'Invalid username or password.' });
            }

            return res.status(200).json({
                message: 'Authentication successful.',
                access_token: result.token.accessToken,
                token_type: 'Bearer',
                expires_in: result.token.expiresIn,
                user: {
                    username: result.user.username,
                    email: result.user.email,
                    is_active: result.user.isActive,
                },
            });
        } catch (err) {
            next(err);
        }
    });

    return router;
}
