import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/infrastructure/web/expressApp.js';
import type { CreateUserResult } from '../src/features/user/domain/CreateUserResult.js';
import type { User } from '../src/features/user/domain/User.js';
import type { UserRepository } from '../src/features/user/domain/UserRepository.js';

class MemoryStore implements UserRepository {
  private users = new Map<string, User>();
  private emails = new Set<string>();

  async createUser(user: User): Promise<CreateUserResult> {
    const usernameKey = user.username.toLowerCase();
    const emailKey = user.email.toLowerCase();
    if (this.users.has(usernameKey)) return 'username_exists';
    if (this.emails.has(emailKey)) return 'email_exists';
    this.users.set(usernameKey, user);
    this.emails.add(emailKey);
    return 'created';
  }

  async getUser(username: string): Promise<User | null> {
    return this.users.get(username.toLowerCase()) ?? null;
  }
}

const validUser = {
  username: 'alice',
  email: 'alice@example.com',
  password: 'Correct Horse Battery 9!',
};

describe('user auth API', () => {
  it('creates and authenticates a user under /v1', async () => {
    const app = createApp({ repository: new MemoryStore() });

    const created = await request(app).post('/v1/users').send(validUser);
    expect(created.status).toBe(200);
    expect(created.body.user).toMatchObject({
      username: validUser.username,
      email: validUser.email,
      is_active: true,
    });
    expect(created.body.user.created_at).toEqual(expect.any(String));

    const login = await request(app)
      .post('/v1/auth/login')
      .send({ username: validUser.username, password: validUser.password });
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({
      token_type: 'Bearer',
      expires_in: expect.any(Number),
      access_token: expect.any(String),
    });
    expect(login.body.access_token.split('.')).toHaveLength(3);
    expect(login.body.user).toMatchObject({
      username: validUser.username,
      email: validUser.email,
      is_active: true,
    });
  });

  it('stores all required user fields', async () => {
    const repository = new MemoryStore();
    const app = createApp({ repository });
    await request(app).post('/v1/users').send(validUser);

    const saved = await repository.getUser(validUser.username);
    expect(saved).not.toBeNull();
    expect(saved).toEqual(
      expect.objectContaining({
        username: validUser.username,
        email: validUser.email,
        isActive: true,
        createdAt: expect.any(String),
        passwordHash: expect.any(String),
        passwordChangedAt: expect.any(String),
      }),
    );
    expect(saved?.passwordHash).not.toBe(validUser.password);
  });

  it('rejects duplicate usernames case-insensitively', async () => {
    const app = createApp({ repository: new MemoryStore() });
    await request(app).post('/v1/users').send(validUser);
    const duplicate = await request(app).post('/v1/users').send({
      ...validUser,
      username: 'Alice',
      email: 'alice2@example.com',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toMatch(/already exists/i);
  });

  it('rejects duplicate emails case-insensitively', async () => {
    const app = createApp({ repository: new MemoryStore() });
    await request(app).post('/v1/users').send(validUser);
    const duplicate = await request(app).post('/v1/users').send({
      ...validUser,
      username: 'alice2',
      email: 'ALICE@example.com',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toMatch(/already exists/i);
  });

  it('returns 401 for invalid credentials', async () => {
    const app = createApp({ repository: new MemoryStore() });
    await request(app).post('/v1/users').send(validUser);
    const login = await request(app)
      .post('/v1/auth/login')
      .send({ username: validUser.username, password: 'Wrong password value' });
    expect(login.status).toBe(401);
    expect(login.body.message).toBe('Invalid username or password.');
  });

  it('rate-limits repeated login attempts', async () => {
    const app = createApp({ repository: new MemoryStore() });
    let lastResponse: { status: number } | undefined;

    for (let attempt = 0; attempt < 11; attempt += 1) {
      lastResponse = await request(app)
        .post('/v1/auth/login')
        .send({ username: 'missing-user', password: 'Wrong password value' });
    }

    expect(lastResponse?.status).toBe(429);
  });

  it('rejects short passwords with JSON validation errors', async () => {
    const app = createApp({ repository: new MemoryStore() });
    const response = await request(app)
      .post('/v1/users')
      .send({ username: 'alice', email: 'alice@example.com', password: 'too-short' });
    expect(response.status).toBe(400);
    expect(response.type).toMatch(/json/);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.request_id).toEqual(expect.any(String));
  });

  it('requires passwords to include uppercase, lowercase, numbers, and special characters', async () => {
    const app = createApp({ repository: new MemoryStore() });
    const response = await request(app)
      .post('/v1/users')
      .send({ username: 'alice', email: 'alice@example.com', password: 'simplepassword123' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires application/json for POST requests', async () => {
    const app = createApp({ repository: new MemoryStore() });
    const response = await request(app).post('/v1/users').type('text').send('hello');
    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('returns 404 when the protected endpoint is missing', async () => {
    const app = createApp({ repository: new MemoryStore() });
    const response = await request(app).get('/v1/users/me');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for a tampered access token on a missing route', async () => {
    const app = createApp({ repository: new MemoryStore() });
    await request(app).post('/v1/users').send(validUser);
    const login = await request(app)
      .post('/v1/auth/login')
      .send({ username: validUser.username, password: validUser.password });

    const token = String(login.body.access_token);
    const tamperedToken = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
    const response = await request(app)
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${tamperedToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('does not expose unversioned API routes', async () => {
    const app = createApp({ repository: new MemoryStore() });
    const response = await request(app).post('/users').send(validUser);
    expect(response.status).toBe(404);
  });
});
