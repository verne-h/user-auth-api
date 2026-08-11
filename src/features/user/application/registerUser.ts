import argon2 from 'argon2';
import type { CreateUserDto } from './dto.js';
import type { UserRepository } from '../domain/UserRepository.js';
import type { CreateUserResult } from '../domain/CreateUserResult.js';
import type { User } from '../domain/User.js';

export async function registerUser(
    repository: UserRepository,
    data: CreateUserDto,
): Promise<CreateUserResult> {
    const now = new Date().toISOString();
    const passwordHash = await argon2.hash(data.password, {
        type: argon2.argon2id,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
    });

    const user: User = {
        username: data.username,
        email: data.email,
        isActive: true,
        createdAt: now,
        passwordHash,
        passwordChangedAt: now,
    };

    return repository.createUser(user);
}
