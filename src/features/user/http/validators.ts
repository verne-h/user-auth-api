import { z } from 'zod';

const usernameSchema = z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(64, 'Username must be at most 64 characters')
    .regex(/^[A-Za-z0-9._-]+$/, 'Username may contain only letters, numbers, dot, underscore, and hyphen');

const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .email('Email must be a valid email address')
    .max(254, 'Email must be at most 254 characters');

const passwordSchema = z
    .string()
    .min(15, 'Password must be at least 15 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must include at least one uppercase character')
    .regex(/[a-z]/, 'Password must include at least one lowercase character')
    .regex(/\d/, 'Password must include at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character');

export const createUserSchema = z
    .object({
        username: usernameSchema,
        email: emailSchema,
        password: passwordSchema,
    })
    .strict();
