import type { CreateUserResult } from './CreateUserResult.js';
import type { User } from './User.js';

export interface UserRepository {
    createUser(user: User): Promise<CreateUserResult>;
    getUser(username: string): Promise<User | null>;
}
