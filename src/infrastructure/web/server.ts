import type { RedisClientType } from 'redis';
import { createApp } from './expressApp.js';
import { createRedisClient } from '../../infrastructure/redis/client.js';
import { RedisUserRepository } from '../../features/user/infrastructure/RedisUserRepository.js';
import { config } from '../../config/index.js';

const redis = createRedisClient();

redis.on('error', (err) => {
    console.error(JSON.stringify({ level: 'error', component: 'redis', message: err.message }));
});

await redis.connect();

const repository = new RedisUserRepository(redis as unknown as RedisClientType);
const app = createApp({ repository, redis: redis as unknown as RedisClientType });

const server = app.listen(config.port, () => {
    console.log(JSON.stringify({ level: 'info', message: 'User auth API started', port: config.port }));
});

server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;

let shuttingDown = false;
async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ level: 'info', message: 'Shutting down', signal }));

    server.close(async (err) => {
        try {
            if (redis.isOpen) await redis.quit();
        } finally {
            process.exit(err ? 1 : 0);
        }
    });

    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
