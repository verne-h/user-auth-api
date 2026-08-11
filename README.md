# User Authentication API

Production-oriented Node.js + TypeScript + Express REST API backed by Redis. It creates users, authenticates username/password credentials, and issues short-lived JWT access tokens.

## API endpoints

The public API is versioned at `/v1`:

- `POST /v1/users` creates a user.
- `POST /v1/auth/login` authenticates a user and returns a JWT access token.
- `GET /v1/users/me` is a JWT-protected example endpoint that returns the current user.
- `GET /livez` is a process liveness probe.
- `GET /readyz` verifies Redis connectivity and is suitable for readiness checks.

The OpenAPI document uses a relative server URL (`/v1`) rather than a hard-coded hostname. The same document therefore works when served from localhost, staging, or production.

## Configuration

The API reads configuration from environment variables, and it also loads values from a local `.env` file when present. The repository includes an `.env.example` file with the supported keys.

Supported variables include:

- `NODE_ENV`
- `PORT`
- `REDIS_URL`
- `TRUST_PROXY`
- `LOGIN_RATE_LIMIT_WINDOW_MS`
- `LOGIN_RATE_LIMIT_MAX`
- `CREATE_USER_RATE_LIMIT_WINDOW_MS`
- `CREATE_USER_RATE_LIMIT_MAX`
- `REQUEST_BODY_LIMIT`
- `JWT_SECRET`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `JWT_ACCESS_TOKEN_TTL_SECONDS`

## Redis data model

Each user is stored in a Redis hash at:

```text
auth:user:<normalized-username>
```

The hash contains exactly these application fields:

```text
username
email
is_active
created_at
password_hash
password_changed_at
```

A separate `auth:email:<normalized-email>` key provides an email uniqueness index. User creation is performed by a Redis Lua script so checking username/email uniqueness and creating both keys is atomic.

JWTs themselves are not stored in Redis. They are short-lived signed credentials. Protected requests validate the JWT and then re-read the user from Redis so an inactive account or a changed `password_changed_at` value immediately invalidates an otherwise unexpired access token.

## JWT design

Successful authentication returns:

```json
{
  "message": "Authentication successful.",
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": {
    "username": "alice",
    "email": "alice@example.com",
    "is_active": true
  }
}
```

Access tokens are signed with HS256 using `jose`. Verification explicitly allows only HS256 and validates the token's signature, issuer, audience, and expiration. Tokens also contain `sub`, `iat`, `exp`, `jti`, and a private `pwd_changed_at` claim. Password hashes, passwords, and other secrets are never placed in a JWT.

The default access-token lifetime is 15 minutes and is configurable with `JWT_ACCESS_TOKEN_TTL_SECONDS` (60 seconds to 24 hours). Short-lived access tokens limit the exposure window if a bearer token is stolen.

`JWT_SECRET` must be at least 32 characters. Production startup fails when it is missing. Store the production secret in a secret manager or deployment platform secret, not in source control or a container image. A local-only development fallback exists so the project can run without secret provisioning during local development.

This project does not issue refresh tokens or maintain a per-token revocation list. For a larger identity system, refresh-token rotation, explicit logout/revocation, key rotation, and possibly asymmetric signing/JWKS should be designed according to the consumers and deployment topology.

## Security decisions

- Passwords are never stored in plaintext.
- Passwords are hashed using Argon2id with explicit memory, iteration, and parallelism parameters.
- Passwords must be 15-128 characters.
- Passwords must include at least one uppercase letter, one lowercase letter, one number, and one special character.
- Username and email uniqueness are case-insensitive.
- Inactive accounts cannot authenticate or use previously issued access tokens.
- Changing `password_changed_at` invalidates previously issued access tokens immediately.
- Failed authentication returns the same `401` response for nonexistent users, inactive users, and incorrect passwords.
- Login attempts are rate-limited. When Redis is available, the limiter uses Redis so limits work across multiple API instances.
- User-creation requests are also rate-limited.
- Successful logins do not consume the failed-login rate-limit quota.
- JWT verification pins the expected signing algorithm and validates issuer, audience, and expiry.
- Protected endpoints require `Authorization: Bearer <token>` and return a generic `401` for missing, malformed, invalid, expired, or stale tokens.
- `helmet` sets common HTTP security headers.
- Express's `X-Powered-By` header is disabled.
- JSON request bodies are size-limited.
- Write requests require `Content-Type: application/json`.
- Zod schemas reject unexpected request fields.
- Internal exceptions are not exposed to callers.
- Error responses include a request ID for correlation without exposing sensitive data.
- Server header/request/keep-alive timeouts are set explicitly.
- Startup fails if Redis cannot be reached instead of accepting traffic in a broken state.
- Graceful shutdown stops accepting traffic and closes Redis cleanly.

## Local development

Requirements:

- Node.js 22+
- Docker (for local Redis)

Start Redis:

```bash
docker compose up -d
```

Install dependencies and start the API:

```bash
npm install
npm run dev
```

The local base URL is `http://localhost:3000`.

### Optional local JWT configuration

The built-in development secret is intentionally only for local use. To use your own local secret, either export it in your shell or place it in a local `.env` file:

```bash
export JWT_SECRET="$(openssl rand -base64 48)"
npm run dev
```

You can also configure:

```text
JWT_ISSUER=user-auth-api
JWT_AUDIENCE=user-auth-api-clients
JWT_ACCESS_TOKEN_TTL_SECONDS=900
```

### Create a user

Use a password that satisfies the complexity requirements, for example:

```bash
curl -i -X POST http://localhost:3000/v1/users \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@example.com","password":"Correct Horse Battery 9!"}'
```

### Authenticate and get a JWT

```bash
curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"Correct Horse Battery 9!"}'
```

Successful authentication returns:

```json
{
  "message": "Authentication successful.",
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": {
    "username": "alice",
    "email": "alice@example.com",
    "is_active": true
  }
}
```

Copy the returned `<jwt>` from the `access_token` property, then call the protected endpoint:

```bash
curl -i http://localhost:3000/v1/users/me \
  -H "Authorization: Bearer <jwt>"
```

### Inspect the Redis user hash

```bash
docker compose exec redis redis-cli HGETALL auth:user:alice
```

## Build and test

```bash
npm run build
npm test
```

Run the compiled application with:

```bash
NODE_ENV=production \
JWT_SECRET='<production-secret-from-secret-manager>' \
npm start
```

## Production deployment requirements

1. Terminate HTTPS/TLS at a trusted ingress/load balancer or service mesh and never expose bearer tokens over plaintext HTTP on the public internet.
2. Generate a high-entropy `JWT_SECRET` and provide it through a secret manager. Do not reuse development values, commit it, log it, or expose it to frontend code.
3. Keep the same JWT secret, issuer, and audience across replicas that need to issue/verify the same tokens. Plan a key-rotation strategy before rotating a production signing secret because changing it invalidates all outstanding access tokens.
4. Keep Redis on a private network. Use Redis authentication/ACLs and TLS where your managed Redis service supports them. Never expose port 6379 publicly.
5. Set `REDIS_URL` through your platform's secret/configuration system. Do not commit credentials.
6. Set `NODE_ENV=production`. Production startup intentionally rejects a missing `JWT_SECRET`.
7. Set `TRUST_PROXY=true` only when the API is actually behind a trusted reverse proxy that sets client IP headers. This is important for IP-based rate limiting.
8. Use Redis persistence/replication/backups appropriate to your recovery requirements because Redis is the system of record in this exercise.
9. Run multiple API instances behind a health-checking load balancer for availability. Redis-backed rate limiting is shared across instances.
10. Collect stdout/stderr JSON logs in your observability platform and alert on elevated `401`, `429`, `5xx`, readiness failures, and Redis errors. Never log Authorization headers or JWT values.
11. Restrict ingress, egress, and Redis access using security groups/firewall rules and least privilege.
12. Add a managed breached-password service or maintained blocklist for a full identity product.
13. For systems that require long-lived sessions, add refresh-token rotation and revocation rather than increasing the access-token lifetime significantly.
14. If many independent services only need to verify tokens, consider asymmetric signing plus JWKS so verifiers do not need access to the signing secret.

## OpenAPI versioning

`openapi.yaml` declares:

```yaml
servers:
  - url: /v1
```

and defines resource paths such as `/users`, `/auth/login`, and `/users/me`. The resulting endpoints are `/v1/users`, `/v1/auth/login`, and `/v1/users/me`. This avoids repeating the version prefix on every path while keeping the server host dynamic.
