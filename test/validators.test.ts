import { describe, expect, it } from 'vitest';
import { createUserSchema } from '../src/features/user/http/validators.js';

describe('createUserSchema password validation', () => {
    it('accepts passwords with uppercase, lowercase, numbers, and special characters', () => {
        const result = createUserSchema.safeParse({
            username: 'alice',
            email: 'alice@example.com',
            password: 'CorrectHorseBattery9!',
        });

        expect(result.success).toBe(true);
    });

    it('rejects passwords missing one of the required character classes', () => {
        const result = createUserSchema.safeParse({
            username: 'alice',
            email: 'alice@example.com',
            password: 'simplepassword123',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((issue) => issue.message.includes('Password must include at least one'))).toBe(true);
        }
    });
});
