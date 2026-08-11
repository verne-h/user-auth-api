import { z } from 'zod';

const booleanFromEnv = z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true');

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
    TRUST_PROXY: booleanFromEnv,
    LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    CREATE_USER_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    CREATE_USER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    REQUEST_BODY_LIMIT: z.string().default('16kb'),
    JWT_SECRET: z.string().min(32).optional(),
    JWT_ISSUER: z.string().min(1).default('user-auth-api'),
    JWT_AUDIENCE: z.string().min(1).default('user-auth-api-clients'),
    JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
});

const env = envSchema.parse(process.env);

if (env.NODE_ENV === 'production' && !env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in production and must contain at least 32 characters.');
}

const developmentJwtSecret = 'local-development-only-secret-change-before-production-8f4da7a7';

export const config = {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    redisUrl: env.REDIS_URL,
    trustProxy: env.TRUST_PROXY,
    loginRateLimitWindowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
    loginRateLimitMax: env.LOGIN_RATE_LIMIT_MAX,
    createUserRateLimitWindowMs: env.CREATE_USER_RATE_LIMIT_WINDOW_MS,
    createUserRateLimitMax: env.CREATE_USER_RATE_LIMIT_MAX,
    requestBodyLimit: env.REQUEST_BODY_LIMIT,
    jwtSecret: env.JWT_SECRET ?? developmentJwtSecret,
    jwtIssuer: env.JWT_ISSUER,
    jwtAudience: env.JWT_AUDIENCE,
    jwtAccessTokenTtlSeconds: env.JWT_ACCESS_TOKEN_TTL_SECONDS,
    isProduction: env.NODE_ENV === 'production',
} as const;
