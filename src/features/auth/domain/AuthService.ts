import crypto from 'node:crypto';
import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import { config } from '../../../config/index.js';
import type { User } from '../../user/domain/User.js';
import type { AccessTokenClaims, IssuedAccessToken } from './AuthClaims.js';

const JWT_ALGORITHM = 'HS256' as const;
const signingKey = new TextEncoder().encode(config.jwtSecret);

export async function issueAccessToken(user: User): Promise<IssuedAccessToken> {
    const accessToken = await new SignJWT({ pwd_changed_at: user.passwordChangedAt })
        .setProtectedHeader({ alg: JWT_ALGORITHM, typ: 'JWT' })
        .setSubject(user.username)
        .setIssuer(config.jwtIssuer)
        .setAudience(config.jwtAudience)
        .setJti(crypto.randomUUID())
        .setIssuedAt()
        .setExpirationTime(`${config.jwtAccessTokenTtlSeconds}s`)
        .sign(signingKey);

    return {
        accessToken,
        expiresIn: config.jwtAccessTokenTtlSeconds,
    };
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, signingKey, {
        algorithms: [JWT_ALGORITHM],
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
    });

    if (
        typeof payload.sub !== 'string' ||
        payload.sub.length === 0 ||
        typeof payload.pwd_changed_at !== 'string' ||
        payload.pwd_changed_at.length === 0 ||
        typeof payload.iat !== 'number' ||
        typeof payload.exp !== 'number' ||
        typeof payload.jti !== 'string'
    ) {
        throw new Error('JWT is missing required claims.');
    }

    return payload as AccessTokenClaims;
}
