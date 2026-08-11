import type { RedisClientType } from 'redis';
import type { UserRepository } from '../domain/UserRepository.js';
import type { User } from '../domain/User.js';
import type { CreateUserResult } from '../domain/CreateUserResult.js';

const CREATE_USER_SCRIPT = `
local userKey = KEYS[1]
local emailKey = KEYS[2]

if redis.call('EXISTS', userKey) == 1 then
  return 'username_exists'
end

if redis.call('EXISTS', emailKey) == 1 then
  return 'email_exists'
end

redis.call('HSET', userKey,
  'username', ARGV[1],
  'email', ARGV[2],
  'is_active', ARGV[3],
  'created_at', ARGV[4],
  'password_hash', ARGV[5],
  'password_changed_at', ARGV[6]
)
redis.call('SET', emailKey, ARGV[1])
return 'created'
`;

export class RedisUserRepository implements UserRepository {
    constructor(private readonly redis: RedisClientType) { }

    private userKey(username: string): string {
        return `auth:user:${username.trim().toLowerCase()}`;
    }

    private emailKey(email: string): string {
        return `auth:email:${email.trim().toLowerCase()}`;
    }

    async createUser(user: User): Promise<CreateUserResult> {
        const result = await this.redis.eval(CREATE_USER_SCRIPT, {
            keys: [this.userKey(user.username), this.emailKey(user.email)],
            arguments: [
                user.username,
                user.email,
                user.isActive ? 'true' : 'false',
                user.createdAt,
                user.passwordHash,
                user.passwordChangedAt,
            ],
        });

        if (result === 'created' || result === 'username_exists' || result === 'email_exists') {
            return result;
        }

        throw new Error(`Unexpected Redis create-user result: ${String(result)}`);
    }

    async getUser(username: string): Promise<User | null> {
        const record = (await this.redis.hGetAll(this.userKey(username))) as Record<string, string | undefined>;
        if (!record.username) return null;

        const requiredFields = ['email', 'is_active', 'created_at', 'password_hash', 'password_changed_at'] as const;
        if (requiredFields.some((field) => !record[field])) {
            throw new Error(`Corrupt user record for ${this.userKey(username)}`);
        }
        if (record.is_active !== 'true' && record.is_active !== 'false') {
            throw new Error(`Invalid is_active value for ${this.userKey(username)}`);
        }

        return {
            username: String(record.username),
            email: String(record.email),
            isActive: record.is_active === 'true',
            createdAt: String(record.created_at),
            passwordHash: String(record.password_hash),
            passwordChangedAt: String(record.password_changed_at),
        };
    }
}
