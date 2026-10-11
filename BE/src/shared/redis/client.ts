import { createClient } from 'redis';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

const client = env.REDIS_URL
  ? createClient({
      url: env.REDIS_URL,
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: (retries) => Math.min(1000, 100 + retries * 100),
      },
      disableOfflineQueue: true,
    })
  : undefined;
// Redis errors can contain connection credentials. Never pass the raw error to the logger.
client?.on('error', () => {});
let connecting: Promise<unknown> | undefined;
async function bounded<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Redis operation timed out')), 2000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export async function redisClient() {
  if (!client)
    throw new AppError(503, 'ADMISSION_UNAVAILABLE', 'Dịch vụ kiểm soát tải chưa được cấu hình.');
  if (!client.isOpen) {
    connecting ??= client.connect().finally(() => {
      connecting = undefined;
    });
    await bounded(connecting);
  }
  if (!client.isReady)
    throw new AppError(
      503,
      'ADMISSION_UNAVAILABLE',
      'Dịch vụ kiểm soát tải tạm thời không khả dụng.',
    );
  return client;
}
export async function redisCommand(args: string[]) {
  try {
    const redis = await redisClient();
    return await redis.sendCommand(args, { timeout: 2000 });
  } catch {
    throw new AppError(
      503,
      'ADMISSION_UNAVAILABLE',
      'Dịch vụ kiểm soát tải tạm thời không khả dụng.',
    );
  }
}
export async function closeRedis() {
  if (client?.isOpen) client.destroy();
}
