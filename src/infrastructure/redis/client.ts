import { createClient } from 'redis';
import { config } from '../../config/index.js';

export function createRedisClient() {
    return createClient({
        url: config.redisUrl,
        socket: {
            reconnectStrategy: (retries) => Math.min(retries * 100, 3_000),
        },
    });
}
