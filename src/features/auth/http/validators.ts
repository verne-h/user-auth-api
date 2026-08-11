import { z } from 'zod';

const usernameSchema = z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(64, 'Username must be at most 64 characters')
    .regex(/^[A-Za-z0-9._-]+$/, 'Username may contain only letters, numbers, dot, underscore, and hyphen');

export const loginSchema = z
    .object({
        username: usernameSchema,
        password: z.string().min(1).max(128),
    })
    .strict();
