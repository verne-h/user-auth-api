import type { JWTPayload } from 'jose';

export type AccessTokenClaims = JWTPayload & {
    sub: string;
    pwd_changed_at: string;
};

export type IssuedAccessToken = {
    accessToken: string;
    expiresIn: number;
};
