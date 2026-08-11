import argon2 from 'argon2';
import type { LoginDto } from './dto.js';
import type { UserRepository } from '../../user/domain/UserRepository.js';
import type { User } from '../../user/domain/User.js';
import type { IssuedAccessToken } from '../domain/AuthClaims.js';
import { issueAccessToken } from '../domain/AuthService.js';

export type LoginResult =
    | { success: true; token: IssuedAccessToken; user: User }
    | { success: false };

export async function loginUser(
    repository: UserRepository,
    credentials: LoginDto,
): Promise<LoginResult> {
    const user = await repository.getUser(credentials.username);
    const hashToVerify = user?.passwordHash ?? (await argon2.hash('dummy-password-value-never-used-for-login', {
        type: argon2.argon2id,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
    }));

    const passwordMatches = await argon2.verify(hashToVerify, credentials.password);

    if (!user || !user.isActive || !passwordMatches) {
        return { success: false };
    }

    const token = await issueAccessToken(user);
    return { success: true, token, user };
}
